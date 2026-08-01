"""Section detection driven by the protocol's header patterns.

The detector walks the article text once, matches every section's regex
list, keeps only the matches that actually look like a header line, and
builds a sorted list of :class:`SectionSpan` boundaries. Each mention then
resolves its section by binary-searching the span list.

Two rules keep the boundaries honest on PDF-extracted text:

  * a match only opens a section when it sits alone on a short line —
    wrapped body lines constantly start with words like ``method`` or
    ``results`` and would otherwise relabel the rest of the article;
  * ``references`` is terminal — bibliographies are full of cited titles
    beginning with ``Results``/``Methods``, and before this rule those
    citations turned the reference list into a high-weight section.
"""

from __future__ import annotations

import bisect
import re

from .protocol import SectionConfig
from .schema import SectionSpan


# These section names are special:
#   - ``title`` is the segment before the first detected header (no regex).
#   - ``other`` is the catch-all bucket for unclassified text.
CENTRAL_SECTIONS = {"title", "abstract", "methods", "results"}
INFORMATIVE_SECTIONS = {
    "title",
    "abstract",
    "methods",
    "results",
    "discussion",
    "conclusion",
    "introduction",
}
# Informative but not central: an entity seen only in these sections is
# narrative background, never a measured study variable. ``classify``
# gates the "intro/discussion only" role on this set.
PERIPHERAL_SECTIONS = INFORMATIVE_SECTIONS - CENTRAL_SECTIONS

# Once the bibliography starts, no later header is trusted.
TERMINAL_SECTION = "references"

# A real header sits alone on a short line. The protocol patterns anchor on
# ``^``, but PDF extraction wraps body text so every wrapped line is a line
# start: 60 characters is generous for a numbered header ("3.2 Materials
# and Methods") and clearly below a wrapped body line (~75-95 chars in the
# two-column layouts of this corpus).
MAX_HEADER_LINE_CHARS = 60

# Precedence when two markers land on the same offset: the synthetic
# ``title`` sentinel loses to any real header (its zero-length span is
# dropped below), and the rest tie-break by name, so the result never
# depends on set iteration order.
_MARKER_PRECEDENCE = {"title": 0}


def _line_bounds(text: str, position: int) -> tuple[int, int]:
    """Return the ``(start, end)`` offsets of the line holding ``position``."""

    start = text.rfind("\n", 0, position) + 1
    end = text.find("\n", position)
    return start, len(text) if end < 0 else end


def _is_typographically_marked(word: str, line: str) -> bool:
    """True when the header word is set off the way a printed header is.

    Length alone does not separate a header from prose. PDF extraction wraps
    body text, and a wrapped line can easily be short *and* start with a
    section word — ``"results showed that inflammation was severe"`` is 43
    characters, well under :data:`MAX_HEADER_LINE_CHARS`, and would otherwise
    open a ``results`` section that relabels the rest of the article and
    raises its weight from 2 to 5.

    Capitalisation is the signal that survives extraction: journals set
    headers in title case or small caps, never in running lowercase. A
    lowercase match is therefore accepted only when the word IS the line, with
    nothing else on it — that admits the occasional journal printing a bare
    ``abstract`` while still rejecting a wrapped clause that happens to end on
    ``result.``, whose line carries a period the bare header never has.
    """

    if word[:1].isupper():
        return True
    return line.casefold() == word.casefold()


def _is_run_in_header(text: str, match: re.Match[str]) -> bool:
    """True when the header word is followed by a separator, e.g. ``Discussion.``

    Journals often run the first paragraph onto the header line
    (``"Abstract: We examined..."``, ``"Discussion. This study reveals..."``).
    Such a line is long, so the line-length test alone would reject a genuine
    header. What separates it from a false positive is the punctuation: a real
    run-in header closes with ``.``/``:``/dash before the prose, whereas a body
    line simply continues the sentence (``"method yields crucial data..."``).
    """

    tail = text[match.end() : match.end() + 2]
    return bool(tail) and tail[0] in ".:—–-"


def _header_line_start(text: str, match: re.Match[str]) -> int:
    """Return the offset of the header line, or ``-1`` if this is no header.

    The protocol patterns start with ``^\\s*``, and ``\\s`` also matches
    newlines, so ``match.start()`` can sit on a blank line above the real
    text. We walk forward to the first non-space character of the match and
    judge the line that character lives on.

    A header qualifies when it starts its line AND either sits alone on a short
    line or closes with run-in punctuation.
    """

    position = match.start()
    while position < match.end() and text[position].isspace():
        position += 1
    line_start, line_end = _line_bounds(text, position)
    if text[line_start:position].strip():
        return -1  # matched inside a running sentence, not at a line start
    line = text[line_start:line_end].strip()
    if not line:
        return -1
    if not _is_typographically_marked(text[position : match.end()].strip(), line):
        return -1  # running prose that merely begins with a header word
    if len(line) > MAX_HEADER_LINE_CHARS and not _is_run_in_header(text, match):
        return -1  # a body line that merely begins with a header word
    return line_start


def _truncate_at_references(markers: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Keep the real bibliography as terminal, ignoring earlier false hits.

    The bibliography is the *last* ``references`` header in a paper. Earlier
    matches are spurious — a table column headed "References", a running
    footer, a cited journal name. Truncating at the first match would discard
    genuine Conclusions/Methods prose that follows it, so we anchor on the last
    match instead: earlier ``references`` markers are dropped outright, and
    everything after the real one is discarded.
    """

    last = -1
    for index, (_, name) in enumerate(markers):
        if name == TERMINAL_SECTION:
            last = index
    if last < 0:
        return markers
    kept = [m for i, m in enumerate(markers[:last]) if m[1] != TERMINAL_SECTION]
    return kept + [markers[last]]


def detect_sections(text: str, config: SectionConfig) -> list[SectionSpan]:
    """Return ordered spans covering ``text`` using ``config.headers``."""

    body = text or ""
    markers: list[tuple[int, str]] = [(0, "title")]
    for name, patterns in config.headers.items():
        if name in {"title", "other"}:
            continue
        for pattern in patterns:
            for match in pattern.finditer(body):
                line_start = _header_line_start(body, match)
                if line_start < 0:
                    continue
                markers.append((line_start, name))
    markers = sorted(
        set(markers),
        key=lambda item: (item[0], _MARKER_PRECEDENCE.get(item[1], 1), item[1]),
    )
    markers = _truncate_at_references(markers)

    spans: list[SectionSpan] = []
    for index, (start, name) in enumerate(markers):
        end = markers[index + 1][0] if index + 1 < len(markers) else len(body)
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
