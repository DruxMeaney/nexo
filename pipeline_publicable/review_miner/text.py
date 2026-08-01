from __future__ import annotations

import re


SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])")


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def context_window(text: str, start: int, end: int, radius: int = 260) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    return normalize_space(text[left:right])


def sentence_at(text: str, start: int, end: int, radius: int = 900) -> str:
    """Sentence containing ``start``, taken from a window around the match.

    The boundary regex consumes ``\\s+`` — one to N whitespace characters —
    so the sentence offsets come from ``finditer`` and not from assuming a
    single-character separator: a blank line between paragraphs (or the
    ``\\f`` page break `io.extract_pdf` writes) would otherwise shift every
    following sentence and return the wrong one. Because the offsets are
    exact, the returned sentence is the one that really spans ``start`` —
    which matters because it is exported as ``Mention.sentence`` and quoted
    as relation evidence. A ``start`` that lands inside a separator belongs
    to the sentence that follows it.
    """

    left = max(0, start - radius)
    right = min(len(text), end + radius)
    fragment = text[left:right]
    local_start = start - left
    bounds: list[tuple[int, int]] = []
    cursor = 0
    for boundary in SENTENCE_BOUNDARY.finditer(fragment):
        bounds.append((cursor, boundary.start()))
        cursor = boundary.end()
    bounds.append((cursor, len(fragment)))
    for sentence_start, sentence_end in bounds:
        # A position that falls inside a separator belongs to the sentence
        # that follows it, hence the second condition.
        if sentence_end <= sentence_start:
            continue
        if sentence_start <= local_start < sentence_end or sentence_start > local_start:
            sentence = normalize_space(fragment[sentence_start:sentence_end])
            if sentence:
                return sentence
            break
    return context_window(text, start, end, radius=180)


def split_sentences(text: str) -> list[tuple[int, int, str]]:
    out = []
    cursor = 0
    for part in SENTENCE_BOUNDARY.split(text or ""):
        start = (text or "").find(part, cursor)
        if start < 0:
            start = cursor
        end = start + len(part)
        cleaned = normalize_space(part)
        if cleaned:
            out.append((start, end, cleaned))
        cursor = end
    return out


def page_for_position(text: str, position: int, pages: int) -> int:
    """Exact page number from the form-feed page markers written by `io.extract_pdf`.

    PDFs carry one ``\\f`` per page break, so the count is the real page.
    Sources without markers (plain text, Markdown) are single-page; the
    proportional estimate below is only a last resort for multi-page text
    that lost its markers, and it assumes pages of equal length.
    """

    if "\f" in text:
        page = text[: max(0, position)].count("\f") + 1
        return min(page, pages) if pages > 0 else page
    if pages <= 1 or not text:
        return 1
    return max(1, min(pages, int(position / max(1, len(text)) * pages) + 1))
