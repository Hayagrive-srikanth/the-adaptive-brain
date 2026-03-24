import logging
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings
from app.services.ai_engine import call_opus, call_sonnet, parse_json_response
from app.prompts.quiz_generation import get_quiz_generation_prompt
from app.prompts.answer_evaluation import get_answer_evaluation_prompt
from app.prompts.rephrase import get_rephrase_prompt
from app.prompts.mock_exam import get_mock_exam_prompt, get_exam_scoring_prompt

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def generate_questions(
    topic_id: str,
    count: int = 5,
    difficulty: str = "medium",
    user_profile: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Generate quiz questions for a topic using Claude Opus."""
    try:
        topic = supabase.table("topics").select("*").eq("id", topic_id).single().execute()
        topic_data = topic.data

        # Get source text
        source_text = _get_topic_source_text(topic_data)

        system_prompt, user_message = get_quiz_generation_prompt(
            topic_name=topic_data["name"],
            topic_description=topic_data.get("description", ""),
            source_text=source_text,
            count=count,
            difficulty=difficulty,
            user_profile=user_profile or {},
        )

        response = call_opus(system_prompt, user_message, max_tokens=4096)
        questions_data = parse_json_response(response)

        if isinstance(questions_data, dict):
            questions_data = questions_data.get("questions", [])

        stored_questions = []
        for q in questions_data:
            result = supabase.table("quiz_questions").insert({
                "topic_id": topic_id,
                "question_type": q.get("question_type", "multiple_choice"),
                "question_text": q.get("question_text", ""),
                "options": q.get("options"),
                "correct_answer": q.get("correct_answer", ""),
                "explanation": q.get("explanation", ""),
                "difficulty": difficulty,
                "hint_layers": q.get("hint_layers", []),
            }).execute()
            if result.data:
                stored_questions.append(result.data[0])

        return stored_questions
    except Exception as e:
        logger.error(f"Error generating quiz questions: {e}")
        raise


def evaluate_answer(question_id: str, user_answer: str) -> Dict[str, Any]:
    """Evaluate a user's answer to a quiz question."""
    try:
        question = supabase.table("quiz_questions").select("*").eq(
            "id", question_id
        ).single().execute()
        q = question.data

        question_type = q.get("question_type", "")
        correct_answer = q.get("correct_answer", "")

        # For MCQ and true/false, match by key, value, or text
        if question_type in ("multiple_choice", "true_false"):
            user_ans = user_answer.strip().lower()
            correct_ans = correct_answer.strip().lower()

            # Direct match (e.g., "B" == "B" or full text match)
            is_correct = user_ans == correct_ans

            # If correct_answer is a key like "B", check if user sent the option text
            if not is_correct:
                options = q.get("options", {})
                if isinstance(options, dict):
                    # correct_answer is a key like "B" — check if user_answer matches that option's value
                    correct_value = options.get(correct_answer, "").strip().lower()
                    is_correct = user_ans == correct_value
                    # Also check if user sent a key and correct_answer is a value
                    for key, val in options.items():
                        if user_ans == val.strip().lower() and key.strip().lower() == correct_ans:
                            is_correct = True
                            break
                elif isinstance(options, list):
                    # correct_answer might be an index or the actual text
                    for opt in options:
                        if opt.strip().lower() == user_ans and opt.strip().lower() == correct_ans:
                            is_correct = True
                            break

            explanation = q.get("explanation", "")
        else:
            # For fill-in-blank and short answer, use Claude for semantic evaluation
            system_prompt, user_message = get_answer_evaluation_prompt(
                question_text=q.get("question_text", ""),
                correct_answer=correct_answer,
                user_answer=user_answer,
            )
            response = call_sonnet(system_prompt, user_message, max_tokens=1024)
            eval_result = parse_json_response(response)

            is_correct = eval_result.get("correct", False)
            explanation = eval_result.get("feedback", q.get("explanation", ""))

        # Update question stats
        supabase.table("quiz_questions").update({
            "times_shown": q.get("times_shown", 0) + 1,
            "times_correct": q.get("times_correct", 0) + (1 if is_correct else 0),
        }).eq("id", question_id).execute()

        return {
            "correct": is_correct,
            "explanation": explanation,
            "correct_answer": correct_answer if not is_correct else None,
            "rephrasing_needed": not is_correct,
        }
    except Exception as e:
        logger.error(f"Error evaluating answer: {e}")
        raise


def update_mastery(topic_id: str) -> float:
    """Update mastery percentage based on quiz performance."""
    try:
        # Get all attempts for this topic's questions
        questions = supabase.table("quiz_questions").select("id").eq(
            "topic_id", topic_id
        ).execute()

        if not questions.data:
            return 0.0

        question_ids = [q["id"] for q in questions.data]
        attempts = supabase.table("quiz_attempts").select("correct").in_(
            "question_id", question_ids
        ).execute()

        if not attempts.data:
            return 0.0

        total = len(attempts.data)
        correct = sum(1 for a in attempts.data if a.get("correct"))
        mastery = (correct / total) * 100 if total > 0 else 0

        # Update topic mastery
        supabase.table("topics").update({
            "mastery_percentage": mastery,
            "status": "mastered" if mastery >= 80 else "in_progress" if mastery > 0 else "not_started",
        }).eq("id", topic_id).execute()

        # Update project readiness score
        topic = supabase.table("topics").select("project_id").eq("id", topic_id).single().execute()
        if topic.data:
            _update_readiness_score(topic.data["project_id"])

        return mastery
    except Exception as e:
        logger.error(f"Error updating mastery: {e}")
        return 0.0


def _update_readiness_score(project_id: str):
    """Recalculate and update project readiness score."""
    try:
        topics = supabase.table("topics").select("mastery_percentage").eq(
            "project_id", project_id
        ).execute()

        if not topics.data:
            return

        avg_mastery = sum(t["mastery_percentage"] for t in topics.data) / len(topics.data)

        supabase.table("projects").update({
            "readiness_score": avg_mastery,
        }).eq("id", project_id).execute()
    except Exception as e:
        logger.error(f"Error updating readiness score: {e}")


def get_questions(topic_id: str) -> List[Dict[str, Any]]:
    """Get existing quiz questions for a topic."""
    try:
        result = supabase.table("quiz_questions").select("*").eq(
            "topic_id", topic_id
        ).execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching questions: {e}")
        return []


def _get_topic_source_text(topic_data: Dict[str, Any]) -> str:
    """Get the source material text for a topic."""
    try:
        source_ids = topic_data.get("source_material_ids", [])
        if not source_ids:
            materials = supabase.table("source_materials").select("ocr_text").eq(
                "project_id", topic_data["project_id"]
            ).eq("processing_status", "completed").execute()
            return "\n\n".join(m["ocr_text"] for m in (materials.data or []) if m.get("ocr_text"))

        materials = supabase.table("source_materials").select("ocr_text").in_("id", source_ids).execute()
        return "\n\n".join(m["ocr_text"] for m in (materials.data or []) if m.get("ocr_text"))
    except Exception:
        return ""


def rephrase_question(
    question_id: str,
    attempt_count: int,
    user_profile: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a rephrased explanation and new question after an incorrect answer.

    Determines rephrase level from attempt_count:
      - 1 = Level 1 (different wording, same format)
      - 2 = Level 2 (switch modality, analogies, simpler vocabulary)
      - 3+ = Level 3 (full walkthrough from basics)

    After a successful rephrase-then-correct-answer cycle, creates an SM2 card
    for spaced repetition if sm2_engine is available.

    Args:
        question_id: UUID of the question the student got wrong.
        attempt_count: How many times the student has attempted this question.
        user_profile: The student's profile dict for adaptation.

    Returns:
        Dict with rephrased_explanation and new_question.
    """
    try:
        # Determine rephrase level
        if attempt_count <= 1:
            level = 1
        elif attempt_count == 2:
            level = 2
        else:
            level = 3

        # Fetch the original question
        question = supabase.table("quiz_questions").select("*").eq(
            "id", question_id
        ).single().execute()
        q = question.data

        if not q:
            raise ValueError(f"Question {question_id} not found")

        system_prompt, user_message = get_rephrase_prompt(
            level=level,
            question_text=q.get("question_text", ""),
            correct_answer=q.get("correct_answer", ""),
            explanation=q.get("explanation", ""),
            user_profile=user_profile,
        )

        response = call_sonnet(system_prompt, user_message, max_tokens=2048)
        rephrase_data = parse_json_response(response)

        if not rephrase_data:
            return {
                "rephrased_explanation": q.get("explanation", ""),
                "new_question": None,
                "level": level,
            }

        # Store the new rephrased question if one was generated
        new_q = rephrase_data.get("new_question")
        if new_q:
            result = supabase.table("quiz_questions").insert({
                "topic_id": q.get("topic_id"),
                "question_type": new_q.get("question_type", "multiple_choice"),
                "question_text": new_q.get("question_text", ""),
                "options": new_q.get("options"),
                "correct_answer": new_q.get("correct_answer", ""),
                "explanation": new_q.get("explanation", ""),
                "difficulty": q.get("difficulty", "medium"),
                "hint_layers": new_q.get("hint_layers", []),
                "parent_question_id": question_id,
            }).execute()

            if result.data:
                new_q["id"] = result.data[0]["id"]

        return {
            "rephrased_explanation": rephrase_data.get("rephrased_explanation", ""),
            "new_question": new_q,
            "level": level,
            "analogy_used": rephrase_data.get("analogy_used"),
            "building_blocks": rephrase_data.get("building_blocks"),
            "mnemonic": rephrase_data.get("mnemonic"),
        }
    except Exception as e:
        logger.error(f"Error rephrasing question: {e}")
        raise


def get_question_hint(question_id: str, hint_index: int) -> Optional[str]:
    """Get a specific hint for a question by index.

    Args:
        question_id: UUID of the question.
        hint_index: Zero-based index into the hint_layers array.

    Returns:
        The hint text at that index, or None if not available.
    """
    try:
        question = supabase.table("quiz_questions").select("hint_layers").eq(
            "id", question_id
        ).single().execute()

        if not question.data:
            return None

        hints = question.data.get("hint_layers", [])
        if 0 <= hint_index < len(hints):
            return hints[hint_index]
        return None
    except Exception as e:
        logger.error(f"Error fetching hint: {e}")
        return None


# ============================================
# Phase 3: Mock Exam Generation & Scoring
# ============================================


def generate_mock_exam(
    project_id: str,
    user_profile: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a comprehensive mock exam covering all topics in the project.

    Fetches all topics, includes previously failed questions for rephrasing,
    weights toward weak topics, and returns a full exam structure.

    Args:
        project_id: The project UUID.
        user_profile: The student's profile dict for adaptation.

    Returns:
        Dict with exam structure including sections, questions, time limits, rubric.
    """
    try:
        # Fetch all topics for the project
        topics_result = supabase.table("topics").select(
            "id, name, description, mastery_percentage, difficulty, status, path_order"
        ).eq("project_id", project_id).order("path_order").execute()

        topics = topics_result.data or []

        if not topics:
            raise ValueError("No topics found for this project")

        # For each topic, fetch recently failed questions for rephrasing
        for topic in topics:
            failed_result = supabase.table("quiz_questions").select(
                "question_text, correct_answer"
            ).eq("topic_id", topic["id"]).execute()

            # Get questions that were answered incorrectly more than correctly
            failed_questions = []
            if failed_result.data:
                for q in failed_result.data:
                    attempts = supabase.table("quiz_attempts").select(
                        "correct"
                    ).eq("question_id", q.get("id", "")).execute()
                    if attempts.data:
                        incorrect = sum(1 for a in attempts.data if not a.get("correct"))
                        if incorrect > 0:
                            failed_questions.append(q)

            topic["failed_questions"] = failed_questions[:5]

        # Build the prompt
        system_prompt, user_message = get_mock_exam_prompt(topics, user_profile)

        # Call Claude Opus for exam generation
        response = call_opus(system_prompt, user_message, max_tokens=8192)
        exam_data = parse_json_response(response)

        if not exam_data or "sections" not in exam_data:
            raise ValueError("Failed to generate valid exam structure")

        # Store the exam in the database
        exam_record = supabase.table("mock_exams").insert({
            "project_id": project_id,
            "exam_data": exam_data,
            "total_points": exam_data.get("total_points", 0),
            "total_time_minutes": exam_data.get("total_time_minutes", 60),
            "status": "generated",
        }).execute()

        exam_id = exam_record.data[0]["id"] if exam_record.data else None
        exam_data["exam_id"] = exam_id

        return exam_data
    except Exception as e:
        logger.error(f"Error generating mock exam: {e}")
        raise


def score_mock_exam(
    exam_id: str,
    answers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Score a submitted mock exam with detailed feedback.

    Args:
        exam_id: The mock exam UUID.
        answers: List of dicts with question_index, section_index, and student_answer.

    Returns:
        Dict with detailed scoring, feedback, and study recommendations.
    """
    try:
        # Fetch the exam
        exam_result = supabase.table("mock_exams").select("*").eq(
            "id", exam_id
        ).single().execute()

        exam = exam_result.data
        if not exam:
            raise ValueError(f"Mock exam {exam_id} not found")

        exam_data = exam.get("exam_data", {})

        # Build the scoring payload
        questions_for_scoring = []
        for section_idx, section in enumerate(exam_data.get("sections", [])):
            for q_idx, question in enumerate(section.get("questions", [])):
                # Find the matching student answer
                student_answer = ""
                for ans in answers:
                    if ans.get("section_index") == section_idx and ans.get("question_index") == q_idx:
                        student_answer = ans.get("student_answer", "")
                        break

                questions_for_scoring.append({
                    "section_name": section.get("section_name", ""),
                    "question_index": q_idx,
                    "section_index": section_idx,
                    "question_type": question.get("question_type", ""),
                    "question_text": question.get("question_text", ""),
                    "correct_answer": question.get("correct_answer", ""),
                    "points": question.get("points", 1),
                    "student_answer": student_answer,
                })

        # Build scoring prompt
        scoring_system_prompt, _ = get_exam_scoring_prompt()

        import json
        scoring_user_message = json.dumps({
            "exam_id": exam_id,
            "questions": questions_for_scoring,
            "grade_boundaries": exam_data.get("grade_boundaries", {
                "A": 90, "B": 80, "C": 70, "D": 60, "F": 0,
            }),
        })

        # Call Claude Opus for scoring
        response = call_opus(scoring_system_prompt, scoring_user_message, max_tokens=8192)
        scoring_result = parse_json_response(response)

        if not scoring_result:
            raise ValueError("Failed to parse scoring response")

        # Update exam record with results
        supabase.table("mock_exams").update({
            "status": "scored",
            "score": scoring_result.get("total_score", 0),
            "percentage": scoring_result.get("percentage", 0),
            "grade": scoring_result.get("grade", ""),
            "scoring_result": scoring_result,
            "answers": answers,
        }).eq("id", exam_id).execute()

        # Update topic mastery based on exam performance
        _update_mastery_from_exam(exam_data, scoring_result)

        return scoring_result
    except Exception as e:
        logger.error(f"Error scoring mock exam: {e}")
        raise


def _update_mastery_from_exam(
    exam_data: Dict[str, Any],
    scoring_result: Dict[str, Any],
) -> None:
    """Update topic mastery percentages based on mock exam results."""
    try:
        for section_score in scoring_result.get("section_scores", []):
            # Find the matching section in exam data to get topic IDs
            section_name = section_score.get("section_name", "")
            for section in exam_data.get("sections", []):
                if section.get("section_name") == section_name:
                    topic_ids = section.get("topic_ids", [])
                    section_pct = 0
                    possible = section_score.get("possible", 0)
                    if possible > 0:
                        section_pct = (section_score.get("score", 0) / possible) * 100

                    for tid in topic_ids:
                        # Blend exam score with existing mastery
                        topic = supabase.table("topics").select(
                            "mastery_percentage"
                        ).eq("id", tid).single().execute()

                        if topic.data:
                            current = topic.data.get("mastery_percentage", 0)
                            # Weighted average: 60% existing, 40% exam
                            new_mastery = (current * 0.6) + (section_pct * 0.4)
                            supabase.table("topics").update({
                                "mastery_percentage": round(new_mastery, 1),
                            }).eq("id", tid).execute()
                    break
    except Exception as e:
        logger.error(f"Error updating mastery from exam: {e}")
