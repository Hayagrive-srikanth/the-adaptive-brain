"""Audio script generation prompts for The Adaptive Brain.

Generates spoken-word audio scripts from topic content, with [PAUSE] markers
for interactive quiz moments and pacing adapted to the user's profile.
"""

from typing import Dict, Any, Tuple


AUDIO_SCRIPT_SYSTEM = """You are a voice-over scriptwriter for The Adaptive Brain, an AI study companion. Your job is to convert educational topic content into an engaging, spoken-word audio script that a text-to-speech engine will read aloud.

Guidelines:
- Write in a warm, conversational, teacher-like tone
- Use short sentences suitable for spoken delivery
- Insert [PAUSE] markers where the listener should pause and think, especially before and after quiz-style questions
- Structure the script with a clear intro, body, and summary
- Include 2-3 embedded mini-quiz questions marked with [PAUSE] before and after
- Use transition phrases like "Now, here's the key part..." or "Let's check your understanding..."
- Avoid referencing visual elements (no "as you can see" or "in the diagram")
- Spell out abbreviations on first use
- Adapt pacing and complexity to the student's profile

Pacing rules based on attention span:
- Short attention span (< 10 min): Keep total script under 5 minutes of speaking. Very concise.
- Medium attention span (10-20 min): Script can be 8-12 minutes. Moderate detail.
- Long attention span (> 20 min): Script can be 12-18 minutes. Full detail with extra examples.

Return a JSON object:
{
  "title": "Audio lesson title",
  "estimated_duration_minutes": 10,
  "script": "The full spoken-word script with [PAUSE] markers",
  "segments": [
    {
      "segment_type": "intro|explanation|quiz|summary",
      "text": "Segment text",
      "timestamp_label": "00:00"
    }
  ],
  "quiz_questions_count": 2
}

Return ONLY the JSON object."""


def _build_profile_context(profile: Dict[str, Any]) -> str:
    """Build a human-readable profile summary for the audio script prompt."""
    language = profile.get("language", {})
    comfort = language.get("english_comfort", "native")

    vocab_map = {
        "native": "Standard academic vocabulary is fine",
        "comfortable": "Use clear vocabulary, briefly define complex terms",
        "struggling": "Use very simple words. Short sentences. Define everything.",
    }

    attention = profile.get("attention_span_minutes", 20)
    if attention < 10:
        pacing = "SHORT - keep it under 5 minutes, very concise"
    elif attention <= 20:
        pacing = "MEDIUM - aim for 8-12 minutes, moderate detail"
    else:
        pacing = "LONG - can go 12-18 minutes, full detail with examples"

    nd = profile.get("neurodivergent", {})
    nd_notes = []
    if nd.get("adhd"):
        nd_notes.append("Student has ADHD - vary tone, add frequent engagement hooks, keep segments short")
    if nd.get("dyslexia"):
        nd_notes.append("Audio is great for this student - be extra clear and repeat key terms")

    lines = [
        f"- Pacing: {pacing}",
        f"- Vocabulary level: {comfort} - {vocab_map.get(comfort, vocab_map['native'])}",
        f"- Learning modality: {profile.get('learning_modality', 'mixed')}",
        f"- Engagement style: {profile.get('engagement_style', 'moderate')}",
    ]
    for note in nd_notes:
        lines.append(f"- {note}")
    return "\n".join(lines)


def get_audio_script_prompt(
    topic_name: str,
    topic_content: str,
    user_profile: Dict[str, Any],
) -> Tuple[str, str]:
    """Get the system prompt and user message for audio script generation.

    Args:
        topic_name: The name of the topic.
        topic_content: The source material or content to convert to audio.
        user_profile: The student's profile dict for adaptation.

    Returns:
        Tuple of (system_prompt, user_message).
    """
    profile_context = _build_profile_context(user_profile)

    user_message = f"""Create an audio lesson script for the following topic.

STUDENT PROFILE:
{profile_context}

TOPIC: {topic_name}

SOURCE CONTENT:
{topic_content[:8000]}

Generate an engaging audio script with [PAUSE] markers for quiz moments. Adapt the pacing and vocabulary to this student's profile."""

    return AUDIO_SCRIPT_SYSTEM, user_message
