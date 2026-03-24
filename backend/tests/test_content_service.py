"""Tests for content_service (generate_content_block, get_content_blocks, recommend_formats)."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_TOPIC_ID,
    TEST_TOPIC_DATA,
    TEST_PROJECT_ID,
    TEST_USER_PROFILE,
)


# ---------------------------------------------------------------------------
# generate_content_block()
# ---------------------------------------------------------------------------

class TestGenerateContentBlock:
    @patch("app.services.content_service.get_content_prompt")
    @patch("app.services.content_service.parse_json_response")
    @patch("app.services.content_service.call_sonnet")
    @patch("app.services.content_service.supabase")
    def test_generate_summary_content(
        self, mock_sb, mock_sonnet, mock_parse, mock_prompt
    ):
        """generate_content_block for 'summary' type stores and returns content."""
        mock_prompt.return_value = ("system prompt", "user message")
        mock_sonnet.return_value = '{"title": "Chemical Bonding Summary", "content": "..."}'
        mock_parse.return_value = {
            "title": "Chemical Bonding Summary",
            "content": "Bonds are formed when...",
            "type": "summary",
        }

        content_block = {
            "id": "cb-uuid-1",
            "topic_id": TEST_TOPIC_ID,
            "content_type": "summary",
            "content_body": {"title": "Chemical Bonding Summary", "content": "Bonds are formed when..."},
            "format_metadata": {},
            "generated_by": "sonnet",
            "duration_estimate_minutes": 10,
        }
        mock_sb.table.return_value = _make_query_mock(data=[content_block])

        # topic query needs to return topic data
        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "topics":
                return _make_query_mock(data=TEST_TOPIC_DATA)
            elif name == "source_materials":
                return _make_query_mock(data=[{"ocr_text": "Source text here"}])
            elif name == "content_blocks":
                return _make_query_mock(data=[content_block])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.services.content_service import generate_content_block
        result = generate_content_block(TEST_TOPIC_ID, TEST_USER_PROFILE, "summary")

        assert result["content_type"] == "summary"
        assert result["topic_id"] == TEST_TOPIC_ID

    @patch("app.services.content_service.get_content_prompt")
    @patch("app.services.content_service.parse_json_response")
    @patch("app.services.content_service.call_sonnet")
    @patch("app.services.content_service.supabase")
    def test_generate_micro_lesson_content(
        self, mock_sb, mock_sonnet, mock_parse, mock_prompt
    ):
        """generate_content_block for 'micro_lesson' type uses correct duration."""
        mock_prompt.return_value = ("system prompt", "user message")
        mock_sonnet.return_value = '{"title": "Micro Lesson"}'
        mock_parse.return_value = {"title": "Micro Lesson", "content": "Quick lesson"}

        content_block = {
            "id": "cb-uuid-2",
            "topic_id": TEST_TOPIC_ID,
            "content_type": "micro_lesson",
            "content_body": {"title": "Micro Lesson"},
            "format_metadata": {},
            "generated_by": "sonnet",
            "duration_estimate_minutes": 5,
        }

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "topics":
                return _make_query_mock(data=TEST_TOPIC_DATA)
            elif name == "source_materials":
                return _make_query_mock(data=[{"ocr_text": "Material text"}])
            elif name == "content_blocks":
                return _make_query_mock(data=[content_block])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.services.content_service import generate_content_block
        result = generate_content_block(TEST_TOPIC_ID, TEST_USER_PROFILE, "micro_lesson")

        assert result["content_type"] == "micro_lesson"
        assert result["duration_estimate_minutes"] == 5

    @patch("app.services.content_service.get_content_prompt")
    @patch("app.services.content_service.parse_json_response")
    @patch("app.services.content_service.call_sonnet")
    @patch("app.services.content_service.supabase")
    def test_generate_content_fallback_on_empty_parse(
        self, mock_sb, mock_sonnet, mock_parse, mock_prompt
    ):
        """When parse_json_response returns empty, raw response is used as content."""
        mock_prompt.return_value = ("system prompt", "user message")
        mock_sonnet.return_value = "Plain text response that is not JSON"
        mock_parse.return_value = {}  # Empty dict triggers fallback

        content_block = {
            "id": "cb-uuid-3",
            "topic_id": TEST_TOPIC_ID,
            "content_type": "summary",
            "content_body": {"title": "Chemical Bonding", "content": "Plain text response", "type": "summary"},
            "format_metadata": {},
            "generated_by": "sonnet",
            "duration_estimate_minutes": 10,
        }

        def table_side_effect(name):
            if name == "topics":
                return _make_query_mock(data=TEST_TOPIC_DATA)
            elif name == "source_materials":
                return _make_query_mock(data=[])
            elif name == "content_blocks":
                return _make_query_mock(data=[content_block])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.services.content_service import generate_content_block
        result = generate_content_block(TEST_TOPIC_ID, TEST_USER_PROFILE, "summary")

        assert result is not None


# ---------------------------------------------------------------------------
# get_content_blocks()
# ---------------------------------------------------------------------------

class TestGetContentBlocks:
    @patch("app.services.content_service.supabase")
    def test_get_content_blocks_success(self, mock_sb):
        """get_content_blocks returns list of existing blocks."""
        blocks = [
            {"id": "cb-1", "topic_id": TEST_TOPIC_ID, "content_type": "summary"},
            {"id": "cb-2", "topic_id": TEST_TOPIC_ID, "content_type": "micro_lesson"},
        ]
        mock_sb.table.return_value = _make_query_mock(data=blocks)

        from app.services.content_service import get_content_blocks
        result = get_content_blocks(TEST_TOPIC_ID)

        assert len(result) == 2
        assert result[0]["content_type"] == "summary"

    @patch("app.services.content_service.supabase")
    def test_get_content_blocks_empty(self, mock_sb):
        """get_content_blocks returns empty list when no blocks exist."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import get_content_blocks
        result = get_content_blocks(TEST_TOPIC_ID)

        assert result == []

    @patch("app.services.content_service.supabase")
    def test_get_content_blocks_error_returns_empty(self, mock_sb):
        """get_content_blocks returns empty list on exception."""
        mock_sb.table.side_effect = Exception("DB error")

        from app.services.content_service import get_content_blocks
        result = get_content_blocks(TEST_TOPIC_ID)

        assert result == []


# ---------------------------------------------------------------------------
# recommend_formats()
# ---------------------------------------------------------------------------

class TestRecommendFormats:
    @patch("app.services.content_service.supabase")
    def test_recommend_visual_learner(self, mock_sb):
        """Visual learner gets concept_map, flashcard_deck first."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import recommend_formats
        profile = {**TEST_USER_PROFILE, "learning_modality": "visual"}
        result = recommend_formats(TEST_TOPIC_ID, profile)

        assert "concept_map" in result
        assert "flashcard_deck" in result
        assert result.index("concept_map") < result.index("summary")

    @patch("app.services.content_service.supabase")
    def test_recommend_audio_learner(self, mock_sb):
        """Audio learner gets audio_lesson first."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import recommend_formats
        profile = {**TEST_USER_PROFILE, "learning_modality": "audio"}
        result = recommend_formats(TEST_TOPIC_ID, profile)

        assert result[0] == "audio_lesson"

    @patch("app.services.content_service.supabase")
    def test_recommend_reading_learner(self, mock_sb):
        """Reading learner gets summary first."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import recommend_formats
        profile = {**TEST_USER_PROFILE, "learning_modality": "reading"}
        result = recommend_formats(TEST_TOPIC_ID, profile)

        assert result[0] == "summary"

    @patch("app.services.content_service.supabase")
    def test_recommend_filters_existing(self, mock_sb):
        """Already-generated content types are filtered out."""
        existing_blocks = [{"content_type": "summary"}, {"content_type": "micro_lesson"}]
        mock_sb.table.return_value = _make_query_mock(data=existing_blocks)

        from app.services.content_service import recommend_formats
        profile = {**TEST_USER_PROFILE, "learning_modality": "mixed"}
        result = recommend_formats(TEST_TOPIC_ID, profile)

        assert "summary" not in result
        assert "micro_lesson" not in result

    @patch("app.services.content_service.supabase")
    def test_recommend_short_attention_prioritizes_bite_sized(self, mock_sb):
        """Short attention span prioritizes micro_lesson and flashcard_deck."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import recommend_formats
        profile = {
            **TEST_USER_PROFILE,
            "learning_modality": "mixed",
            "attention_span_minutes": 5,
        }
        result = recommend_formats(TEST_TOPIC_ID, profile)

        # Bite-sized formats should be at the front
        bite_sized = {"micro_lesson", "flashcard_deck", "mnemonic_devices"}
        first_items = set(result[:3])
        assert len(first_items & bite_sized) >= 2

    @patch("app.services.content_service.supabase")
    def test_recommend_unknown_modality_uses_mixed(self, mock_sb):
        """Unknown modality falls back to mixed recommendations."""
        mock_sb.table.return_value = _make_query_mock(data=[])

        from app.services.content_service import recommend_formats
        profile = {**TEST_USER_PROFILE, "learning_modality": "unknown_modality"}
        result = recommend_formats(TEST_TOPIC_ID, profile)

        # Should get the mixed list
        assert len(result) > 0
        assert "summary" in result
