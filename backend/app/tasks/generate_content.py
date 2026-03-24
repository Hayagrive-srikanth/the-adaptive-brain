import logging
from typing import List, Dict, Any
from app.celery_app import celery_app
from app.services.content_service import generate_content_block

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2)
def generate_content_blocks(
    self,
    topic_id: str,
    user_profile: Dict[str, Any],
    content_types: List[str],
):
    """Generate content blocks for a topic in specified formats."""
    try:
        results = []
        for content_type in content_types:
            try:
                block = generate_content_block(topic_id, user_profile, content_type)
                results.append({
                    "content_type": content_type,
                    "status": "completed",
                    "block_id": block.get("id"),
                })
            except Exception as e:
                logger.error(
                    f"Error generating {content_type} for topic {topic_id}: {e}"
                )
                results.append({
                    "content_type": content_type,
                    "status": "failed",
                    "error": str(e),
                })

        return {
            "topic_id": topic_id,
            "results": results,
        }
    except Exception as e:
        logger.error(f"Error in generate_content_blocks task: {e}")
        raise self.retry(exc=e, countdown=60)
