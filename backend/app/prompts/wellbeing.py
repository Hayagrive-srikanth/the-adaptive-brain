import json


def get_wellbeing_prompt(mood: str, energy_level: str, session_context: dict) -> tuple[str, str]:
    """Generate system and user prompts for wellbeing-based session adaptation.

    Args:
        mood: One of 'great', 'okay', 'stressed', 'burnt_out'.
        energy_level: One of 'high', 'medium', 'low'.
        session_context: Dict with optional keys like topics, session_type, difficulty, etc.

    Returns:
        Tuple of (system_prompt, user_message).
    """
    system_prompt = """You are a wellbeing-aware study coach for an AI-driven exam preparation platform.
Your role is to recommend session adaptations based on the student's current mood and energy level.

Guidelines for adaptation:
- stressed + low energy → Recommend a lighter session focused on review only. Suggest taking a break before starting. Reduce difficulty.
- stressed + medium energy → Recommend a moderate session with familiar material. Suggest a short break midway.
- stressed + high energy → Recommend channeling energy into active recall on known topics. Keep difficulty moderate.
- burnt_out (any energy) → Suggest a very short session (15 min max) or skipping entirely. Recommend a breathing exercise or walk. Always reduce difficulty.
- great + high energy → Push harder with more challenging material. Introduce new difficult topics. Increase difficulty.
- great + medium energy → Standard session with a mix of new and review material.
- great + low energy → Light session with engaging but not overly demanding content.
- okay + any energy → Standard session adjusted slightly based on energy. No major changes needed.

You MUST respond with valid JSON only, no extra text. Use this exact schema:
{
    "recommendation": "<brief human-readable recommendation string>",
    "session_type": "<one of: full_session, light_review, short_burst, break_first, skip_suggested>",
    "reduce_difficulty": <true or false>,
    "suggest_break": <true or false>
}"""

    user_message = f"""The student just checked in before their study session.

Mood: {mood}
Energy level: {energy_level}
Session context: {json.dumps(session_context)}

Based on their current state, recommend how to adapt their upcoming session. Respond with JSON only."""

    return system_prompt, user_message
