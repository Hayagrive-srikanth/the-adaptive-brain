import json
import time
import logging
from typing import Optional
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Map: Opus -> GPT-4o, Sonnet -> GPT-4o-mini, Haiku -> GPT-4o-mini
MODEL_OPUS = "gpt-4o"
MODEL_SONNET = "gpt-4o-mini"
MODEL_HAIKU = "gpt-4o-mini"

MAX_RETRIES = 3
BASE_DELAY = 1.0


def _call_llm(
    model: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                delay = BASE_DELAY * (2 ** attempt)
                time.sleep(delay)
            else:
                raise


def call_opus(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """Originally Claude Opus, now using GPT-4o."""
    return _call_llm(MODEL_OPUS, system_prompt, user_message, max_tokens)


def call_sonnet(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """Originally Claude Sonnet, now using GPT-4o-mini."""
    return _call_llm(MODEL_SONNET, system_prompt, user_message, max_tokens)


def call_haiku(system_prompt: str, user_message: str, max_tokens: int = 2048) -> str:
    """Originally Claude Haiku, now using GPT-4o-mini."""
    return _call_llm(MODEL_HAIKU, system_prompt, user_message, max_tokens)


def parse_json_response(response_text: str) -> dict:
    try:
        # Try to find JSON in the response
        text = response_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except json.JSONDecodeError:
        # Try to find JSON object or array in the text
        for start_char, end_char in [("{", "}"), ("[", "]")]:
            start = response_text.find(start_char)
            end = response_text.rfind(end_char)
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(response_text[start:end + 1])
                except json.JSONDecodeError:
                    continue
        logger.error(f"Failed to parse JSON from response: {response_text[:200]}")
        return {}
