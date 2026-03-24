import logging
import hashlib
import numpy as np
from typing import List, Optional
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def generate_embedding(text: str) -> List[float]:
    """
    Generate a 1536-dimensional embedding from text.
    Uses a simple hash-based approach for prototype.
    In production, replace with Voyage AI, OpenAI embeddings, or sentence-transformers.
    """
    try:
        # Simple deterministic embedding for prototype
        # This creates a consistent 1536-dim vector from text content
        text_hash = hashlib.sha512(text.encode("utf-8")).hexdigest()

        # Create base vector from hash
        np.random.seed(int(text_hash[:8], 16) % (2**31))
        embedding = np.random.randn(1536).tolist()

        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = (np.array(embedding) / norm).tolist()

        return embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return [0.0] * 1536


def search_similar(
    query_embedding: List[float],
    project_id: str,
    table: str = "source_materials",
    limit: int = 5,
) -> List[dict]:
    """
    Search for similar items using vector similarity.
    Uses cosine similarity via pgvector.
    """
    try:
        # Use Supabase RPC for vector similarity search
        result = supabase.rpc(
            "match_documents",
            {
                "query_embedding": query_embedding,
                "match_count": limit,
                "filter_project_id": project_id,
                "target_table": table,
            },
        ).execute()

        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error searching similar documents: {e}")
        return []
