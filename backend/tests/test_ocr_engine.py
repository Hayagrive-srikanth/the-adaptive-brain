"""Tests for OCR/text extraction engine (app.services.ocr_engine)."""

import pytest
from unittest.mock import patch, MagicMock, PropertyMock


# ---------------------------------------------------------------------------
# process_document() — PDF
# ---------------------------------------------------------------------------

class TestProcessDocumentPdf:
    @patch("app.services.ocr_engine.fitz")
    def test_process_pdf_text_based(self, mock_fitz):
        """PDF with extractable text returns concatenated page text."""
        mock_page = MagicMock()
        mock_page.get_text.return_value = "Chapter 1: Introduction"

        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=2)
        mock_doc.load_page.return_value = mock_page

        mock_fitz.open.return_value = mock_doc

        from app.services.ocr_engine import process_document
        result = process_document("/fake/path.pdf", "pdf")

        assert "Chapter 1: Introduction" in result
        mock_doc.close.assert_called_once()

    @patch("app.services.ocr_engine.settings")
    @patch("app.services.ocr_engine.fitz")
    def test_process_pdf_image_based_no_ocr(self, mock_fitz, mock_settings):
        """Image-based PDF without OCR configured returns placeholder text."""
        mock_settings.HUNYUAN_OCR_PATH = ""

        mock_page = MagicMock()
        mock_page.get_text.return_value = ""  # No extractable text

        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=1)
        mock_doc.load_page.return_value = mock_page

        mock_fitz.open.return_value = mock_doc

        from app.services.ocr_engine import process_document
        result = process_document("/fake/scan.pdf", "pdf")

        assert "OCR not configured" in result
        mock_doc.close.assert_called_once()


# ---------------------------------------------------------------------------
# process_document() — DOCX
# ---------------------------------------------------------------------------

class TestProcessDocumentDocx:
    @patch("app.services.ocr_engine.DocxDocument")
    def test_process_docx(self, mock_docx_cls):
        """DOCX extraction returns paragraph text."""
        mock_para1 = MagicMock()
        mock_para1.text = "First paragraph"
        mock_para2 = MagicMock()
        mock_para2.text = "Second paragraph"

        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para1, mock_para2]
        mock_doc.tables = []

        mock_docx_cls.return_value = mock_doc

        from app.services.ocr_engine import process_document
        result = process_document("/fake/notes.docx", "docx")

        assert "First paragraph" in result
        assert "Second paragraph" in result

    @patch("app.services.ocr_engine.DocxDocument")
    def test_process_docx_with_tables(self, mock_docx_cls):
        """DOCX extraction includes table content."""
        mock_cell1 = MagicMock()
        mock_cell1.text = "Cell A"
        mock_cell2 = MagicMock()
        mock_cell2.text = "Cell B"

        mock_row = MagicMock()
        mock_row.cells = [mock_cell1, mock_cell2]

        mock_table = MagicMock()
        mock_table.rows = [mock_row]

        mock_doc = MagicMock()
        mock_doc.paragraphs = []
        mock_doc.tables = [mock_table]

        mock_docx_cls.return_value = mock_doc

        from app.services.ocr_engine import process_document
        result = process_document("/fake/table.docx", "docx")

        assert "Cell A" in result
        assert "Cell B" in result


# ---------------------------------------------------------------------------
# process_document() — PPTX
# ---------------------------------------------------------------------------

class TestProcessDocumentPptx:
    @patch("app.services.ocr_engine.Presentation")
    def test_process_pptx(self, mock_pptx_cls):
        """PPTX extraction returns slide text."""
        mock_para = MagicMock()
        mock_para.text = "Slide Title Text"

        mock_text_frame = MagicMock()
        mock_text_frame.paragraphs = [mock_para]

        mock_shape = MagicMock()
        mock_shape.has_text_frame = True
        mock_shape.text_frame = mock_text_frame
        mock_shape.has_table = False

        mock_slide = MagicMock()
        mock_slide.shapes = [mock_shape]

        mock_prs = MagicMock()
        mock_prs.slides = [mock_slide]

        mock_pptx_cls.return_value = mock_prs

        from app.services.ocr_engine import process_document
        result = process_document("/fake/slides.pptx", "pptx")

        assert "Slide Title Text" in result
        assert "Slide 1" in result


# ---------------------------------------------------------------------------
# process_document() — unsupported type
# ---------------------------------------------------------------------------

class TestProcessDocumentUnsupported:
    def test_unsupported_file_type_returns_empty_string(self):
        """Unsupported file type returns an empty string."""
        from app.services.ocr_engine import process_document
        result = process_document("/fake/file.xyz", "xyz")

        assert result == ""


# ---------------------------------------------------------------------------
# _process_pdf() — direct tests
# ---------------------------------------------------------------------------

class TestProcessPdfDirect:
    @patch("app.services.ocr_engine.fitz")
    def test_process_pdf_multiple_pages(self, mock_fitz):
        """Multi-page PDF with text on each page is concatenated."""
        pages = []
        for i in range(3):
            p = MagicMock()
            p.get_text.return_value = f"Page {i + 1} content"
            pages.append(p)

        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=3)
        mock_doc.load_page.side_effect = lambda n: pages[n]
        mock_fitz.open.return_value = mock_doc

        from app.services.ocr_engine import _process_pdf
        result = _process_pdf("/fake/multi.pdf")

        assert "Page 1" in result
        assert "Page 2" in result
        assert "Page 3" in result
        mock_doc.close.assert_called_once()


# ---------------------------------------------------------------------------
# get_page_count()
# ---------------------------------------------------------------------------

class TestGetPageCount:
    @patch("app.services.ocr_engine.fitz")
    def test_page_count_pdf(self, mock_fitz):
        """PDF page count uses fitz doc length."""
        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=15)
        mock_fitz.open.return_value = mock_doc

        from app.services.ocr_engine import get_page_count
        assert get_page_count("/fake/doc.pdf", "pdf") == 15

    @patch("app.services.ocr_engine.Presentation")
    def test_page_count_pptx(self, mock_pptx_cls):
        """PPTX page count equals slide count."""
        mock_prs = MagicMock()
        mock_prs.slides = [MagicMock(), MagicMock(), MagicMock()]
        mock_pptx_cls.return_value = mock_prs

        from app.services.ocr_engine import get_page_count
        assert get_page_count("/fake/slides.pptx", "pptx") == 3

    def test_page_count_docx(self):
        """DOCX always returns page count of 1."""
        from app.services.ocr_engine import get_page_count
        assert get_page_count("/fake/doc.docx", "docx") == 1

    def test_page_count_unknown_type(self):
        """Unknown file type defaults to page count of 1."""
        from app.services.ocr_engine import get_page_count
        assert get_page_count("/fake/file.abc", "abc") == 1
