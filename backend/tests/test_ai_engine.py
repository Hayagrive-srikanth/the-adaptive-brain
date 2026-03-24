"""Tests for AI engine (app.services.ai_engine) — OpenAI-based LLM calls and JSON parsing."""

import pytest
from unittest.mock import patch, MagicMock


def _make_openai_response(content: str):
    """Helper to create a mock OpenAI chat completion response."""
    choice = MagicMock()
    choice.message.content = content
    response = MagicMock()
    response.choices = [choice]
    return response


# ---------------------------------------------------------------------------
# call_opus / call_sonnet / call_haiku — model routing
# ---------------------------------------------------------------------------

class TestCallOpus:
    @patch("app.services.ai_engine.client")
    def test_call_opus_uses_gpt4o(self, mock_client):
        """call_opus() routes to gpt-4o model."""
        mock_client.chat.completions.create.return_value = _make_openai_response("response text")

        from app.services.ai_engine import call_opus
        result = call_opus("system", "user message")

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == "gpt-4o"
        assert result == "response text"

    @patch("app.services.ai_engine.client")
    def test_call_opus_passes_max_tokens(self, mock_client):
        """call_opus() forwards the max_tokens parameter."""
        mock_client.chat.completions.create.return_value = _make_openai_response("ok")

        from app.services.ai_engine import call_opus
        call_opus("sys", "msg", max_tokens=2048)

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["max_tokens"] == 2048


class TestCallSonnet:
    @patch("app.services.ai_engine.client")
    def test_call_sonnet_uses_gpt4o_mini(self, mock_client):
        """call_sonnet() routes to gpt-4o-mini model."""
        mock_client.chat.completions.create.return_value = _make_openai_response("mini response")

        from app.services.ai_engine import call_sonnet
        result = call_sonnet("system", "user message")

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == "gpt-4o-mini"
        assert result == "mini response"


class TestCallHaiku:
    @patch("app.services.ai_engine.client")
    def test_call_haiku_uses_gpt4o_mini(self, mock_client):
        """call_haiku() routes to gpt-4o-mini model."""
        mock_client.chat.completions.create.return_value = _make_openai_response("haiku response")

        from app.services.ai_engine import call_haiku
        result = call_haiku("system", "user message")

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == "gpt-4o-mini"
        assert result == "haiku response"

    @patch("app.services.ai_engine.client")
    def test_call_haiku_default_max_tokens(self, mock_client):
        """call_haiku() defaults to max_tokens=2048."""
        mock_client.chat.completions.create.return_value = _make_openai_response("ok")

        from app.services.ai_engine import call_haiku
        call_haiku("sys", "msg")

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["max_tokens"] == 2048


# ---------------------------------------------------------------------------
# Retry logic
# ---------------------------------------------------------------------------

class TestRetryLogic:
    @patch("app.services.ai_engine.time.sleep")
    @patch("app.services.ai_engine.client")
    def test_retry_on_first_failure_then_success(self, mock_client, mock_sleep):
        """API failure on first attempt retries and succeeds on second."""
        mock_client.chat.completions.create.side_effect = [
            Exception("API error"),
            _make_openai_response("recovered"),
        ]

        from app.services.ai_engine import call_opus
        result = call_opus("sys", "msg")

        assert result == "recovered"
        assert mock_client.chat.completions.create.call_count == 2
        mock_sleep.assert_called_once()

    @patch("app.services.ai_engine.time.sleep")
    @patch("app.services.ai_engine.client")
    def test_retry_exhausted_raises(self, mock_client, mock_sleep):
        """All retries exhausted raises the exception."""
        mock_client.chat.completions.create.side_effect = Exception("persistent error")

        from app.services.ai_engine import call_opus
        with pytest.raises(Exception, match="persistent error"):
            call_opus("sys", "msg")

        assert mock_client.chat.completions.create.call_count == 3  # MAX_RETRIES

    @patch("app.services.ai_engine.time.sleep")
    @patch("app.services.ai_engine.client")
    def test_retry_exponential_backoff(self, mock_client, mock_sleep):
        """Retry uses exponential backoff delays (1s, 2s)."""
        mock_client.chat.completions.create.side_effect = [
            Exception("err1"),
            Exception("err2"),
            _make_openai_response("ok"),
        ]

        from app.services.ai_engine import call_opus
        result = call_opus("sys", "msg")

        assert result == "ok"
        # First retry: delay = 1.0 * 2^0 = 1.0
        # Second retry: delay = 1.0 * 2^1 = 2.0
        delays = [call.args[0] for call in mock_sleep.call_args_list]
        assert delays == [1.0, 2.0]


# ---------------------------------------------------------------------------
# parse_json_response()
# ---------------------------------------------------------------------------

class TestParseJsonResponse:
    def test_clean_json(self):
        """Parses clean JSON string."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response('{"key": "value", "num": 42}')

        assert result == {"key": "value", "num": 42}

    def test_json_wrapped_in_code_block(self):
        """Parses JSON wrapped in ```json ... ``` markers."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response('```json\n{"topics": ["math"]}\n```')

        assert result == {"topics": ["math"]}

    def test_json_wrapped_in_plain_code_block(self):
        """Parses JSON wrapped in ``` ... ``` markers (no json label)."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response('```\n{"count": 5}\n```')

        assert result == {"count": 5}

    def test_json_embedded_in_text(self):
        """Extracts JSON object embedded in surrounding text."""
        from app.services.ai_engine import parse_json_response
        text = 'Here is the result: {"score": 85, "grade": "B"} hope that helps!'
        result = parse_json_response(text)

        assert result == {"score": 85, "grade": "B"}

    def test_json_array_embedded_in_text(self):
        """Extracts JSON array embedded in surrounding text."""
        from app.services.ai_engine import parse_json_response
        text = 'Topics found: [{"name": "Bonding"}, {"name": "Reactions"}] end.'
        result = parse_json_response(text)

        assert isinstance(result, list)
        assert len(result) == 2

    def test_invalid_json_returns_empty_dict(self):
        """Invalid JSON returns empty dict."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response("This is not JSON at all.")

        assert result == {}

    def test_empty_string_returns_empty_dict(self):
        """Empty string returns empty dict."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response("")

        assert result == {}

    def test_json_with_whitespace(self):
        """JSON with leading/trailing whitespace is parsed correctly."""
        from app.services.ai_engine import parse_json_response
        result = parse_json_response('   \n  {"status": "ok"}  \n  ')

        assert result == {"status": "ok"}
