"""Legacy lexicon loader.

Most callers should use :func:`review_miner.protocol.load_protocol` now,
which understands the v2 folder format produced by the wizard. This module
remains for older scripts (and the existing ``run_review_miner.py``) that
still pass a pair of legacy JSON files. It accepts either:

  - Legacy shape: ``{ "entities": [ { id, label_es, label_en, category, patterns, generic } ] }``
  - v2 wrapper:   ``{ "metadata": ..., "taxonomy": [ {kind: "term"|"category", ...} ] }``

In both cases the result is a flat list of compiled :class:`LexiconEntity`
records with their ``entity_type`` field set to the caller-supplied slot.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .schema import LexiconEntity


def load_lexicon(path: str | Path, entity_type: str) -> list[LexiconEntity]:
    """Load a single lexicon JSON and tag every entity with ``entity_type``."""

    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("taxonomy"), list):
        out: list[LexiconEntity] = []
        _flatten_taxonomy(data["taxonomy"], parent_label="", entity_type=entity_type, out=out)
        return out
    return _load_legacy(data, entity_type)


def load_all_lexicons(
    variable_a_path: str | Path,
    variable_b_path: str | Path,
) -> tuple[list[LexiconEntity], list[LexiconEntity]]:
    """Convenience wrapper that loads both variable lexicons using "a"/"b" slots."""

    return load_lexicon(variable_a_path, "a"), load_lexicon(variable_b_path, "b")


# --------------------------------------------------------------------------- #
# Internals                                                                   #
# --------------------------------------------------------------------------- #


def _compile(patterns: list[str]) -> tuple[re.Pattern[str], ...]:
    compiled: list[re.Pattern[str]] = []
    for raw in patterns:
        try:
            compiled.append(re.compile(raw, flags=re.IGNORECASE))
        except re.error:
            continue
    return tuple(compiled)


def _string(obj: Any, *keys: str, default: str = "") -> str:
    if not isinstance(obj, dict):
        return default
    for key in keys:
        value = obj.get(key)
        if isinstance(value, str) and value:
            return value
    return default


def _list_of_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _load_legacy(data: Any, entity_type: str) -> list[LexiconEntity]:
    if not isinstance(data, dict):
        return []
    entities = data.get("entities")
    if not isinstance(entities, list):
        return []
    out: list[LexiconEntity] = []
    for item in entities:
        if not isinstance(item, dict):
            continue
        label_es = _string(item, "label_es", "labelEs")
        label_en = _string(item, "label_en", "labelEn")
        patterns = _compile(_list_of_str(item.get("patterns")))
        if not patterns or not (label_es or label_en):
            continue
        out.append(
            LexiconEntity(
                entity_id=_string(item, "id") or label_es.lower() or label_en.lower(),
                label_es=label_es,
                label_en=label_en,
                category=_string(item, "category"),
                entity_type=entity_type,
                generic=bool(item.get("generic", False)),
                patterns=patterns,
            )
        )
    return out


def _flatten_taxonomy(
    nodes: list[Any],
    parent_label: str,
    entity_type: str,
    out: list[LexiconEntity],
) -> None:
    for node in nodes:
        if not isinstance(node, dict):
            continue
        kind = _string(node, "kind")
        label_es = _string(node, "labelEs", "label_es")
        label_en = _string(node, "labelEn", "label_en")
        if kind == "term":
            patterns = _compile(_list_of_str(node.get("patterns")))
            if not patterns or not (label_es or label_en):
                continue
            out.append(
                LexiconEntity(
                    entity_id=_string(node, "id") or label_es.lower() or label_en.lower(),
                    label_es=label_es,
                    label_en=label_en,
                    category=parent_label,
                    entity_type=entity_type,
                    generic=bool(node.get("generic", False)),
                    patterns=patterns,
                )
            )
        elif kind == "category":
            children = node.get("children")
            if isinstance(children, list):
                child_label = label_es or label_en or parent_label
                _flatten_taxonomy(children, child_label, entity_type, out)
