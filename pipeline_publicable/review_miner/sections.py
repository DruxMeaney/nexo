"""Section detection driven by the protocol's header patterns.

The detector walks the article text once, matches every section's regex
list, and builds a sorted list of :class:`SectionSpan` boundaries. Each
mention then resolves its section by binary-searching the span list.
"""

from __future__ import annotations

import bisect

from .protocol import SectionConfig
from .schema import SectionSpan


# These section names are special:
#   - ``title`` is the segment before the first detected header (no regex).
#   - ``other`` is the catch-all bucket for unclassified text.
CENTRAL_SECTIONS = {"title", "abstract", "methods", "results"}
INFORMATIVE_SECTIONS = {"title", "abstract", "methods", "results", "discussion", "conclusion"}


def detect_sections(text: str, config: SectionConfig) -> list[SectionSpan]:
    """Return ordered spans covering ``text`` using ``config.headers``."""

    markers: list[tuple[int, str]] = [(0, "title")]
    for name, patterns in config.headers.items():
        if name in {"title", "other"}:
            continue
        for pattern in patterns:
            for match in pattern.finditer(text or ""):
                markers.append((match.start(), name))
    markers = sorted(set(markers), key=lambda item: item[0])

    if not markers:
        return [SectionSpan("title", 0, len(text))]

    spans: list[SectionSpan] = []
    for index, (start, name) in enumerate(markers):
        end = markers[index + 1][0] if index + 1 < len(markers) else len(text)
        if end > start:
            spans.append(SectionSpan(name=name, start=start, end=end))
    return spans


def section_for_position(spans: list[SectionSpan], position: int) -> str:
    if not spans:
        return "other"
    starts = [span.start for span in spans]
    index = bisect.bisect_right(starts, position) - 1
    if index < 0:
        return "other"
    return spans[index].name


def section_weight(section: str, config: SectionConfig) -> int:
    """Look up the weight for ``section`` in the protocol's config."""

    return config.weight_of(section)
