import logging
from typing import Dict, Any, List
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def build_graph(project_id: str) -> Dict[str, Any]:
    """Build a knowledge graph for a project with nodes (topics) and edges (relationships).

    Nodes represent topics with their mastery levels and descriptions.
    Edges represent:
      1. Prerequisite relationships (from topic ordering/dependencies)
      2. Semantic similarity connections (from vector embedding cosine similarity)
      3. Cross-material connections (topics sharing source materials)

    Args:
        project_id: The project UUID.

    Returns:
        Dict with 'nodes' and 'edges' lists for graph visualization.
    """
    try:
        # Fetch all topics for the project
        topics_result = supabase.table("topics").select(
            "id, name, description, mastery_percentage, difficulty, status, path_order, "
            "source_material_ids, embedding"
        ).eq("project_id", project_id).order("path_order").execute()

        topics = topics_result.data or []

        if not topics:
            return {"nodes": [], "edges": [], "metadata": {"topic_count": 0}}

        # Build nodes
        nodes = []
        for topic in topics:
            nodes.append({
                "id": topic["id"],
                "label": topic["name"],
                "description": topic.get("description", ""),
                "mastery_percentage": topic.get("mastery_percentage", 0),
                "difficulty": topic.get("difficulty", "medium"),
                "status": topic.get("status", "not_started"),
                "path_order": topic.get("path_order", 0),
                "size": _node_size_from_mastery(topic.get("mastery_percentage", 0)),
                "color": _node_color_from_status(topic.get("status", "not_started")),
            })

        # Build edges
        edges = []

        # 1. Prerequisite edges (sequential path order implies prerequisites)
        prerequisite_edges = _build_prerequisite_edges(topics)
        edges.extend(prerequisite_edges)

        # 2. Semantic similarity edges (from embeddings)
        similarity_edges = _build_similarity_edges(topics)
        edges.extend(similarity_edges)

        # 3. Cross-material edges (topics sharing source materials)
        cross_material_edges = _build_cross_material_edges(topics)
        edges.extend(cross_material_edges)

        # Deduplicate edges
        seen = set()
        unique_edges = []
        for edge in edges:
            key = tuple(sorted([edge["source"], edge["target"]])) + (edge["type"],)
            if key not in seen:
                seen.add(key)
                unique_edges.append(edge)

        return {
            "nodes": nodes,
            "edges": unique_edges,
            "metadata": {
                "topic_count": len(nodes),
                "edge_count": len(unique_edges),
                "prerequisite_edges": sum(1 for e in unique_edges if e["type"] == "prerequisite"),
                "similarity_edges": sum(1 for e in unique_edges if e["type"] == "similarity"),
                "cross_material_edges": sum(1 for e in unique_edges if e["type"] == "cross_material"),
            },
        }
    except Exception as e:
        logger.error(f"Error building knowledge graph: {e}")
        raise


def find_connections(topic_id: str) -> List[Dict[str, Any]]:
    """Find related topics across the project for a given topic.

    Uses prerequisite ordering, shared source materials, and embedding similarity
    to discover connections.

    Args:
        topic_id: The topic UUID.

    Returns:
        List of related topic dicts with relationship type and strength.
    """
    try:
        # Get the topic and its project
        topic_result = supabase.table("topics").select(
            "id, name, project_id, path_order, source_material_ids, embedding"
        ).eq("id", topic_id).single().execute()

        topic = topic_result.data
        if not topic:
            return []

        project_id = topic["project_id"]

        # Get all other topics in the project
        other_topics_result = supabase.table("topics").select(
            "id, name, description, mastery_percentage, difficulty, status, "
            "path_order, source_material_ids, embedding"
        ).eq("project_id", project_id).neq("id", topic_id).execute()

        other_topics = other_topics_result.data or []

        connections = []

        for other in other_topics:
            relationship_types = []
            strength = 0.0

            # Check prerequisite relationship (adjacent path order)
            path_diff = abs((other.get("path_order") or 0) - (topic.get("path_order") or 0))
            if path_diff == 1:
                relationship_types.append("prerequisite")
                strength += 0.8
            elif path_diff <= 3:
                relationship_types.append("nearby")
                strength += 0.4

            # Check shared source materials
            topic_sources = set(topic.get("source_material_ids") or [])
            other_sources = set(other.get("source_material_ids") or [])
            shared = topic_sources & other_sources
            if shared:
                relationship_types.append("shared_material")
                strength += 0.5 * (len(shared) / max(len(topic_sources | other_sources), 1))

            # Check embedding similarity
            topic_embedding = topic.get("embedding")
            other_embedding = other.get("embedding")
            if topic_embedding and other_embedding:
                similarity = _cosine_similarity(topic_embedding, other_embedding)
                if similarity > 0.5:
                    relationship_types.append("semantic_similarity")
                    strength += similarity * 0.7

            if relationship_types:
                connections.append({
                    "topic_id": other["id"],
                    "topic_name": other["name"],
                    "description": other.get("description", ""),
                    "mastery_percentage": other.get("mastery_percentage", 0),
                    "relationship_types": relationship_types,
                    "strength": min(strength, 1.0),
                })

        # Sort by connection strength
        connections.sort(key=lambda c: c["strength"], reverse=True)
        return connections

    except Exception as e:
        logger.error(f"Error finding connections for topic {topic_id}: {e}")
        raise


def _build_prerequisite_edges(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build edges based on sequential topic ordering (path_order)."""
    edges = []
    sorted_topics = sorted(topics, key=lambda t: t.get("path_order", 0))

    for i in range(len(sorted_topics) - 1):
        current = sorted_topics[i]
        next_topic = sorted_topics[i + 1]
        edges.append({
            "source": current["id"],
            "target": next_topic["id"],
            "type": "prerequisite",
            "weight": 1.0,
            "label": "prerequisite",
        })

    return edges


def _build_similarity_edges(
    topics: List[Dict[str, Any]],
    threshold: float = 0.55,
) -> List[Dict[str, Any]]:
    """Build edges based on embedding cosine similarity above threshold."""
    edges = []

    for i, topic_a in enumerate(topics):
        emb_a = topic_a.get("embedding")
        if not emb_a:
            continue

        for j in range(i + 1, len(topics)):
            topic_b = topics[j]
            emb_b = topic_b.get("embedding")
            if not emb_b:
                continue

            similarity = _cosine_similarity(emb_a, emb_b)
            if similarity >= threshold:
                edges.append({
                    "source": topic_a["id"],
                    "target": topic_b["id"],
                    "type": "similarity",
                    "weight": round(similarity, 3),
                    "label": f"similarity ({similarity:.0%})",
                })

    return edges


def _build_cross_material_edges(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build edges between topics that share source materials."""
    edges = []

    for i, topic_a in enumerate(topics):
        sources_a = set(topic_a.get("source_material_ids") or [])
        if not sources_a:
            continue

        for j in range(i + 1, len(topics)):
            topic_b = topics[j]
            sources_b = set(topic_b.get("source_material_ids") or [])
            if not sources_b:
                continue

            shared = sources_a & sources_b
            if shared:
                overlap = len(shared) / len(sources_a | sources_b)
                edges.append({
                    "source": topic_a["id"],
                    "target": topic_b["id"],
                    "type": "cross_material",
                    "weight": round(overlap, 3),
                    "label": f"shared material ({len(shared)})",
                })

    return edges


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = sum(a * a for a in vec_a) ** 0.5
    norm_b = sum(b * b for b in vec_b) ** 0.5

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)


def _node_size_from_mastery(mastery: float) -> int:
    """Map mastery percentage to node size for visualization."""
    if mastery >= 80:
        return 40
    elif mastery >= 50:
        return 30
    elif mastery > 0:
        return 20
    return 15


def _node_color_from_status(status: str) -> str:
    """Map topic status to a color for visualization."""
    colors = {
        "mastered": "#22c55e",       # green
        "in_progress": "#f59e0b",    # amber
        "not_started": "#94a3b8",    # slate
        "needs_review": "#ef4444",   # red
    }
    return colors.get(status, "#94a3b8")
