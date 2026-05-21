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
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    fragment = text[left:right]
    local_start = start - left
    sentences = list(SENTENCE_BOUNDARY.split(fragment))
    cursor = 0
    for sentence in sentences:
        sentence_start = cursor
        sentence_end = cursor + len(sentence)
        if sentence_start <= local_start <= sentence_end:
            return normalize_space(sentence)
        cursor = sentence_end + 1
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
    """Estimate page number from form-feed if present; otherwise by proportional text length."""

    if "\f" in text:
        return text[:position].count("\f") + 1
    if pages <= 1 or not text:
        return 1
    return max(1, min(pages, int(position / max(1, len(text)) * pages) + 1))
