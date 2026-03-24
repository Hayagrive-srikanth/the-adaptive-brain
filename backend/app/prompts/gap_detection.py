import json


def get_gap_detection_prompt(topics: list, source_text: str) -> tuple[str, str]:
    """Generate system and user prompts for topic gap detection using Claude Opus.

    Args:
        topics: List of dicts with topic info (e.g. [{name, description, mastery_level}, ...]).
        source_text: The source material text to compare against.

    Returns:
        Tuple of (system_prompt, user_message).
    """
    system_prompt = """You are an expert curriculum analyst for an AI-driven exam preparation platform.
Your task is to analyze the topics a student is studying against the source material to identify gaps in coverage.

Look for:
1. Topics mentioned in the source material that are NOT covered by any existing topic.
2. Topics that are covered superficially but deserve deeper treatment based on the source material.
3. Important prerequisite topics that are implied by the source material but missing entirely.
4. Cross-cutting themes or connections between topics that should be explicitly addressed.

Severity levels:
- "high": Critical topic missing that is likely to appear on the exam or is a prerequisite for other topics.
- "medium": Important topic that would strengthen understanding but may not be directly tested.
- "low": Nice-to-have topic that provides additional context or depth.

You MUST respond with valid JSON only, no extra text. Use this exact schema:
{
    "gaps": [
        {
            "topic_name": "<name of the missing or undertaught topic>",
            "severity": "<high, medium, or low>",
            "recommendation": "<specific recommendation for how to address this gap>"
        }
    ]
}

If no gaps are found, return: {"gaps": []}"""

    user_message = f"""Analyze the following study topics against the source material to identify coverage gaps.

Current topics being studied:
{json.dumps(topics, indent=2)}

Source material excerpt:
{source_text[:8000]}

Identify any topics that are missing, undertaught, or insufficiently covered. Respond with JSON only."""

    return system_prompt, user_message
