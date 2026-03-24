import json
from typing import Dict, Any, List, Tuple


MOCK_EXAM_SYSTEM_PROMPT = """You are an expert exam designer for The Adaptive Brain, an AI study companion. Your task is to generate a comprehensive mock exam that covers ALL topics in the student's project, simulating a real exam experience.

Design principles:
1. **Full Coverage**: Every topic in the project MUST have at least one question. No topic should be left out.
2. **Weakness Weighting**: Topics with lower mastery percentages should receive MORE questions and harder question types. Topics with high mastery get fewer, but still present.
3. **Failed Question Recycling**: Previously failed questions should be rephrased and included (different wording, same concept).
4. **Mixed Question Types**: Use a variety of question formats:
   - "multiple_choice": 4 options (A, B, C, D), exactly one correct
   - "short_answer": Requires a brief written response (1-3 sentences)
   - "essay": Requires a detailed written response (paragraph+), tests deep understanding
   - "case_based": Presents a scenario/case study, then asks analysis questions
5. **Progressive Difficulty**: Start with easier questions, build to harder ones within each section.
6. **Real Exam Feel**: Include realistic time pressure and section structure.

For each section, provide:
- Section name (topic or topic group)
- Time limit in minutes
- Questions with type, text, options (if MCQ), correct answer, explanation, and point value

Scoring rubric guidelines:
- MCQ: 1-2 points each (no partial credit)
- Short answer: 3-5 points each (partial credit possible)
- Essay: 8-15 points each (rubric with criteria)
- Case-based: 5-10 points each (multi-part scoring)

Return a JSON object with this structure:
{
  "exam_title": "Mock Exam: [Project Name]",
  "total_time_minutes": <number>,
  "total_points": <number>,
  "sections": [
    {
      "section_name": "Section 1: [Topic/Group]",
      "topic_ids": ["<topic_id>", ...],
      "time_limit_minutes": <number>,
      "section_points": <number>,
      "questions": [
        {
          "question_type": "multiple_choice",
          "question_text": "...",
          "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
          "correct_answer": "B",
          "explanation": "...",
          "points": 2,
          "topic_id": "<topic_id>",
          "difficulty": "medium",
          "is_rephrased_from_failed": false
        }
      ]
    }
  ],
  "scoring_rubric": {
    "multiple_choice": {"points_range": "1-2", "partial_credit": false},
    "short_answer": {"points_range": "3-5", "partial_credit": true, "criteria": ["Accuracy", "Completeness", "Clarity"]},
    "essay": {"points_range": "8-15", "partial_credit": true, "criteria": ["Thesis", "Evidence", "Analysis", "Organization", "Depth"]},
    "case_based": {"points_range": "5-10", "partial_credit": true, "criteria": ["Problem identification", "Analysis", "Solution", "Justification"]}
  },
  "grade_boundaries": {
    "A": 90,
    "B": 80,
    "C": 70,
    "D": 60,
    "F": 0
  }
}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text."""


EXAM_SCORING_SYSTEM_PROMPT = """You are an expert exam grader for The Adaptive Brain, an AI study companion. You will score a student's mock exam answers with detailed, constructive feedback.

Scoring guidelines:
1. **Multiple Choice**: Binary correct/incorrect. Award full points or zero.
2. **Short Answer**: Score on accuracy, completeness, and clarity. Partial credit is allowed.
3. **Essay**: Score using the rubric criteria (Thesis, Evidence, Analysis, Organization, Depth). Provide specific feedback on each criterion.
4. **Case-Based**: Score each part of the response. Evaluate problem identification, analysis quality, solution viability, and justification.

For each answer, provide:
- Points awarded (out of max points)
- Whether it's correct (boolean)
- Detailed feedback explaining the score
- Specific suggestions for improvement
- Key concepts the student should review if incorrect

Return a JSON object:
{
  "exam_id": "<exam_id>",
  "total_score": <number>,
  "total_possible": <number>,
  "percentage": <number>,
  "grade": "A/B/C/D/F",
  "section_scores": [
    {
      "section_name": "...",
      "score": <number>,
      "possible": <number>,
      "question_results": [
        {
          "question_index": 0,
          "points_awarded": <number>,
          "points_possible": <number>,
          "correct": true/false,
          "feedback": "Detailed feedback...",
          "improvement_suggestions": "What to review...",
          "concepts_to_review": ["concept1", "concept2"]
        }
      ]
    }
  ],
  "overall_feedback": "Summary of performance...",
  "strengths": ["Strong area 1", "Strong area 2"],
  "weaknesses": ["Weak area 1", "Weak area 2"],
  "recommended_review_topics": ["topic_id_1", "topic_id_2"],
  "study_recommendations": "Personalized study advice..."
}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text."""


def get_mock_exam_prompt(
    topics: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
) -> Tuple[str, str]:
    """Build the system prompt and user message for mock exam generation.

    Args:
        topics: List of topic dicts with id, name, description, mastery_percentage,
                difficulty, and optionally failed_questions.
        user_profile: The student's profile dict with learning preferences.

    Returns:
        Tuple of (system_prompt, user_message).
    """
    # Sort topics by mastery so weak ones are prominent
    sorted_topics = sorted(topics, key=lambda t: t.get("mastery_percentage", 0))

    topics_summary = []
    for t in sorted_topics:
        mastery = t.get("mastery_percentage", 0)
        entry = {
            "topic_id": t.get("id", ""),
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "mastery_percentage": mastery,
            "difficulty": t.get("difficulty", "medium"),
            "status": t.get("status", "not_started"),
        }
        # Include failed questions for rephrasing
        failed = t.get("failed_questions", [])
        if failed:
            entry["failed_questions_to_rephrase"] = [
                {"question_text": fq.get("question_text", ""), "correct_answer": fq.get("correct_answer", "")}
                for fq in failed[:5]  # Limit to 5 per topic
            ]
        topics_summary.append(entry)

    user_message = json.dumps({
        "instruction": "Generate a comprehensive mock exam covering ALL of the following topics. "
                       "Weight more questions toward topics with lower mastery. "
                       "Rephrase any failed questions provided. "
                       "Mix question types across sections.",
        "topics": topics_summary,
        "user_profile": {
            "learning_style": user_profile.get("learning_style", "visual"),
            "difficulty_preference": user_profile.get("difficulty_preference", "medium"),
            "language": user_profile.get("language", "en"),
        },
        "total_topics": len(topics_summary),
    }, indent=2)

    return MOCK_EXAM_SYSTEM_PROMPT, user_message


def get_exam_scoring_prompt() -> Tuple[str, str]:
    """Return the system prompt for scoring mock exam answers.

    The user message should be constructed by the caller with the exam
    questions, correct answers, and the student's submitted answers.

    Returns:
        Tuple of (system_prompt, user_message_template_instructions).
    """
    instructions = (
        "Provide the exam data as a JSON object with keys: "
        "'exam_id', 'questions' (list with question_text, question_type, correct_answer, "
        "points, student_answer), and 'grade_boundaries'."
    )
    return EXAM_SCORING_SYSTEM_PROMPT, instructions
