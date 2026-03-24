import logging
from app.celery_app import celery_app
from app.config import settings
from app.services.ai_engine import call_opus, parse_json_response
from app.services.embedding_engine import generate_embedding
from app.services.study_plan_service import generate_plan
from app.prompts.topic_extraction import get_topic_extraction_prompt
from supabase import create_client

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@celery_app.task(bind=True, max_retries=2)
def generate_study_plan(self, project_id: str):
    """Extract topics from materials and generate a study plan."""
    try:
        # 1. Fetch project details
        project = supabase.table("projects").select("*").eq(
            "id", project_id
        ).single().execute()
        project_data = project.data

        if not project_data:
            logger.error(f"Project {project_id} not found")
            return

        # 2. Fetch user profile
        user = supabase.table("users").select("profile").eq(
            "id", project_data["user_id"]
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        # 3. Fetch all completed source materials
        materials = supabase.table("source_materials").select("*").eq(
            "project_id", project_id
        ).eq("processing_status", "completed").execute()

        if not materials.data:
            logger.warning(f"No completed materials for project {project_id}")
            return

        # 4. Combine all OCR text
        combined_text = "\n\n".join(
            m["ocr_text"] for m in materials.data if m.get("ocr_text")
        )

        if not combined_text.strip():
            logger.warning(f"No text extracted from materials for project {project_id}")
            return

        # 5. Extract topics using AI
        system_prompt, user_message = get_topic_extraction_prompt(
            ocr_text=combined_text,
            material_metadata=f"Project: {project_data['name']}, Comfort: {project_data.get('comfort_level', 'intermediate')}",
        )

        response = call_opus(system_prompt, user_message, max_tokens=8192)
        topics_data = parse_json_response(response)

        if isinstance(topics_data, dict):
            topics_list = topics_data.get("topics", [])
        elif isinstance(topics_data, list):
            topics_list = topics_data
        else:
            topics_list = []

        if not topics_list:
            logger.error("No topics extracted from materials")
            return

        # 6. Store topics in database
        # First, build a name-to-id map for prerequisites
        stored_topics = []
        name_to_id = {}

        for i, topic in enumerate(topics_list):
            embedding = generate_embedding(
                f"{topic.get('name', '')} {topic.get('description', '')}"
            )

            material_ids = [m["id"] for m in materials.data]

            result = supabase.table("topics").insert({
                "project_id": project_id,
                "name": topic.get("name", f"Topic {i + 1}"),
                "description": topic.get("description", ""),
                "difficulty": topic.get("difficulty", "intermediate"),
                "prerequisite_ids": [],  # Will update after all topics created
                "estimated_minutes": topic.get("estimated_minutes", 30),
                "path_order": i + 1,
                "source_material_ids": material_ids,
                "embedding": embedding,
            }).execute()

            if result.data:
                stored = result.data[0]
                stored_topics.append(stored)
                name_to_id[topic.get("name", "")] = stored["id"]

        # 7. Update prerequisite IDs (resolve names to IDs)
        for i, topic in enumerate(topics_list):
            prereq_names = topic.get("prerequisite_names", [])
            prereq_ids = [name_to_id[name] for name in prereq_names if name in name_to_id]

            if prereq_ids and i < len(stored_topics):
                supabase.table("topics").update({
                    "prerequisite_ids": prereq_ids,
                }).eq("id", stored_topics[i]["id"]).execute()
                stored_topics[i]["prerequisite_ids"] = prereq_ids

        # 8. Generate study plan
        plan = generate_plan(
            project_id=project_id,
            topics=stored_topics,
            user_profile=user_profile,
            exam_date=project_data["exam_date"],
            hours_per_day=float(project_data.get("hours_per_day", 2)),
            comfort_level=project_data.get("comfort_level", "intermediate"),
        )

        logger.info(
            f"Study plan generated for project {project_id}: "
            f"{len(stored_topics)} topics, {plan.get('total_days', 0)} days"
        )

        return {
            "status": "completed",
            "project_id": project_id,
            "topics_count": len(stored_topics),
            "plan_id": plan.get("plan_id"),
        }

    except Exception as e:
        logger.error(f"Error generating study plan for project {project_id}: {e}")
        raise self.retry(exc=e, countdown=120)
