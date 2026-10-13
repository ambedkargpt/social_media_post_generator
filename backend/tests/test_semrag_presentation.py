"""Reader-facing presentation of SemRAG answers: no internal ids, no Markdown, clean citations.

    pytest backend/tests/test_semrag_presentation.py
"""

from backend.semrag.presentation import (
    PILL_MAX, _citations, clean_passage, excerpt, pill_label, reference, sources_to_show, to_display_text,
)


def test_every_pill_label_fits_the_pill():
    labels = [pill_label(cid) for cid in _citations()]
    assert labels and max(len(l) for l in labels) <= PILL_MAX


def test_reference_reads_as_a_book_citation():
    assert reference("v1_chunk_0215") == "Annihilation of Caste, Vol. 1, p. 67"
    assert reference("v1_chunk_1158") == "States and Minorities, Vol. 1, pp. 428–429"


def test_unknown_chunk_falls_back_to_the_series_and_volume():
    assert reference("not_a_real_chunk", 2) == "Writings and Speeches, Vol. 2"
    assert "chunk" not in pill_label("not_a_real_chunk", 2).lower()


def test_no_label_ever_shows_an_internal_id():
    for cid in list(_citations())[:400]:
        assert "chunk" not in pill_label(cid).lower()
        assert "chunk" not in reference(cid).lower()


def test_passage_debris_is_removed():
    raw = ("it was certainly the cinema and the 23 ON BUDGET 23 theatre. z:\\\\ ambedkar\\\\vol-02\\\\vol2-02.indd "
           "MK SJ+YS 21-9-2013/YS-8-11-2013 More text __ABBR_21__ here.")
    out = clean_passage(raw)
    assert "cinema and the theatre" in out
    assert "indd" not in out and "ABBR" not in out and "ON BUDGET" not in out


def test_excerpt_starts_on_a_sentence_and_never_cuts_a_word():
    text = ("the end of a previous sentence. Caste is not a physical object like a wall of bricks. "
            "Caste is a notion, it is a state of the mind. " * 4)
    out = excerpt(text, limit=120)
    assert out.startswith("Caste is not")
    assert out.endswith(".") or out.endswith("…")


def test_reply_markdown_becomes_plain_text_and_paragraphs_survive():
    md = ("Based on the provided context, Ambedkar argued **caste is a state of mind**.\n\n"
          "### Key points\n- He said *inter-marriage* is the remedy.\n- Second point.\n\n---\n1. Numbered stays.")
    out = to_display_text(md)
    assert "**" not in out and "#" not in out and "---" not in out
    assert out.startswith("Ambedkar argued caste is a state of mind.")
    assert "\n\nKey points\n• He said inter-marriage is the remedy.\n• Second point." in out
    assert "1. Numbered stays." in out


def test_reply_internal_ids_are_removed_without_leaving_debris():
    out = to_display_text('Caste "prevents common activity" (v1_chunk_0150). See [Chunk v2_chunk_0012] and (Source 3).')
    assert "chunk" not in out.lower() and "source 3" not in out.lower()
    assert "()" not in out and "[]" not in out
    assert out == 'Caste "prevents common activity". See and.'
    assert to_display_text("He argued this in 1936 (v1_chunk_0215, v1_chunk_0216).") == "He argued this in 1936."


def test_real_citations_and_ordinary_brackets_are_kept():
    text = ('"The real remedy for breaking Caste is inter-marriage." (Annihilation of Caste, Vol. 1, p. 67) '
            "Article 17 (abolition of untouchability) followed.")
    assert to_display_text(text) == text


def _src(work, vol, page):
    return {"video_title": f"{work} · Vol {vol} p. {page}", "snippet": "…",
            "_ref": {"work": work, "volume": vol, "first_page": str(page)}}


def test_only_cited_sources_are_shown():
    a, b = _src("With the Simon Commission", 2, 324), _src("With the Simon Commission", 2, 327)
    reply = 'He said "the Executive cannot act as a unified body" (With the Simon Commission, Vol. 2, p. 324).'
    assert sources_to_show(reply, [a, b]) == [a]


def test_a_page_range_citation_still_matches():
    a = _src("States and Minorities", 1, 428)
    assert sources_to_show("(States and Minorities, Vol. 1, pp. 428–429)", [a]) == [a]


def test_no_sources_beside_a_not_covered_answer():
    a = _src("Thoughts on Linguistic States", 1, 170)
    reply = "Dr. Ambedkar's writings in this collection do not address this directly."
    assert sources_to_show(reply, [a]) == []


def test_grounded_reply_without_inline_citations_keeps_all_sources():
    a, b = _src("Annihilation of Caste", 1, 67), _src("Annihilation of Caste", 1, 68)
    assert sources_to_show("He held that inter-marriage is the real remedy.", [a, b]) == [a, b]
