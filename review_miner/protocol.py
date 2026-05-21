"""Protocol loader: read a folder saved by the Next.js wizard.

The protocol folder layout (built in `src/lib/protocol/folder.ts`):

    {slug}/
      protocol.json                # identity + analysis params + manifest
      variables/
        variable_a.json            # v2 taxonomy for variable A
        variable_b.json            # v2 taxonomy for variable B
      cues/
        exposure.json              # { "id": "...", "patterns": [...] }
        dose.json
        association.json
        strong_association.json
        speculative.json
        negation.json
        review.json
        human.json
        in_vivo.json
        in_vitro.json
      sections.json                # { activeProfile, weights, headers }

Internally the pipeline uses two stable entity slots: ``"a"`` and ``"b"``.
Display labels for charts and report headers are pulled from the protocol —
not hardcoded — so the pipeline works for any two-variable systematic
review (contaminants/diseases, drugs/adverse-effects, species/ecosystems...).

JSON keys are accepted in either camelCase (the format the wizard writes)
or snake_case (matching the legacy `review_miner_*.json` files). This lets
human-edited files coexist with wizard exports.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .schema import LexiconEntity


VARIABLE_SLOTS = ("a", "b")
CUE_FAMILIES = (
    "exposure",
    "dose",
    "association",
    "strong_association",
    "speculative",
    "negation",
    "review",
    "human",
    "in_vivo",
    "in_vitro",
)

DEFAULT_SECTION_WEIGHTS: dict[str, int] = {
    "title": 5,
    "abstract": 4,
    "methods": 6,
    "results": 5,
    "discussion": 2,
    "conclusion": 2,
    "introduction": 1,
    "references": -3,
    "other": 1,
}

# Filename suffix per cue family inside `cues/`. Mirrors the JS exporter.
CUE_FILENAMES: dict[str, str] = {
    "exposure": "exposure.json",
    "dose": "dose.json",
    "association": "association.json",
    "strong_association": "strong_association.json",
    "speculative": "speculative.json",
    "negation": "negation.json",
    "review": "review.json",
    "human": "human.json",
    "in_vivo": "in_vivo.json",
    "in_vitro": "in_vitro.json",
}


# --------------------------------------------------------------------------- #
# Dataclasses                                                                 #
# --------------------------------------------------------------------------- #


@dataclass
class ProtocolIdentity:
    name: str = ""
    description: str = ""
    author: str = ""
    corpus_language: str = "bilingual"


@dataclass
class VariableInfo:
    slot: str  # "a" or "b"
    display_name_es: str
    display_name_en: str
    mode: str  # "flat" | "hierarchical"

    @property
    def display_name(self) -> str:
        """Best non-empty label, preferring Spanish (matches existing UI)."""
        return self.display_name_es or self.display_name_en or self.slot.upper()


@dataclass
class CueSet:
    """Compiled regex lists for every cue family used by the pipeline.

    Every family is a list of compiled patterns. Empty lists are valid and
    the pipeline tolerates them — a missing family simply contributes
    nothing to scoring. This lets users selectively disable a family.
    """

    exposure: list[re.Pattern[str]] = field(default_factory=list)
    dose: list[re.Pattern[str]] = field(default_factory=list)
    association: list[re.Pattern[str]] = field(default_factory=list)
    strong_association: list[re.Pattern[str]] = field(default_factory=list)
    speculative: list[re.Pattern[str]] = field(default_factory=list)
    negation: list[re.Pattern[str]] = field(default_factory=list)
    review: list[re.Pattern[str]] = field(default_factory=list)
    human: list[re.Pattern[str]] = field(default_factory=list)
    in_vivo: list[re.Pattern[str]] = field(default_factory=list)
    in_vitro: list[re.Pattern[str]] = field(default_factory=list)

    def any_match(self, family: str, text: str) -> bool:
        """True if any pattern in the named family matches ``text``."""
        patterns = getattr(self, family, [])
        return any(p.search(text) for p in patterns)


@dataclass
class SectionConfig:
    """Section detection patterns and weights from the protocol."""

    headers: dict[str, list[re.Pattern[str]]] = field(default_factory=dict)
    weights: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_SECTION_WEIGHTS))
    active_profile: str = "baseline_current"

    def weight_of(self, section_name: str) -> int:
        return self.weights.get(section_name, self.weights.get("other", 1))


@dataclass
class AnalysisParams:
    context_radius: int = 260
    kwic_radius: int = 160
    relation_distance: int = 900
    kmeans_k: int = 4
    validation_sample_size: int = 200


@dataclass
class Protocol:
    """Everything the pipeline needs to run a protocol-driven review.

    `lexicon_a` and `lexicon_b` carry `LexiconEntity` instances with their
    `entity_type` field set to ``"a"`` and ``"b"`` respectively. The rest of
    the pipeline branches on that field when scoring/classifying.
    """

    identity: ProtocolIdentity = field(default_factory=ProtocolIdentity)
    variable_a: VariableInfo = field(default_factory=lambda: VariableInfo("a", "", "", "hierarchical"))
    variable_b: VariableInfo = field(default_factory=lambda: VariableInfo("b", "", "", "hierarchical"))
    lexicon_a: list[LexiconEntity] = field(default_factory=list)
    lexicon_b: list[LexiconEntity] = field(default_factory=list)
    cues: CueSet = field(default_factory=CueSet)
    sections: SectionConfig = field(default_factory=SectionConfig)
    analysis: AnalysisParams = field(default_factory=AnalysisParams)
    source_path: str = ""  # absolute path to the folder, for logging

    def variable_for(self, slot: str) -> VariableInfo:
        return self.variable_a if slot == "a" else self.variable_b

    def all_entities(self) -> list[LexiconEntity]:
        return list(self.lexicon_a) + list(self.lexicon_b)


# --------------------------------------------------------------------------- #
# Helpers (lenient key access)                                                #
# --------------------------------------------------------------------------- #


def _first_str(obj: Any, *keys: str, default: str = "") -> str:
    """Return the first non-empty string value among the given keys."""
    if not isinstance(obj, dict):
        return default
    for key in keys:
        value = obj.get(key)
        if isinstance(value, str) and value:
            return value
    return default


def _bool(obj: Any, *keys: str, default: bool = False) -> bool:
    if not isinstance(obj, dict):
        return default
    for key in keys:
        if key in obj:
            return bool(obj[key])
    return default


def _list_of_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _compile_patterns(patterns: list[str]) -> list[re.Pattern[str]]:
    compiled: list[re.Pattern[str]] = []
    for raw in patterns:
        try:
            compiled.append(re.compile(raw, flags=re.IGNORECASE))
        except re.error:
            # Skip invalid patterns silently — the wizard already warns the
            # user, and we don't want one bad regex to break the run.
            continue
    return compiled


# --------------------------------------------------------------------------- #
# Loaders                                                                     #
# --------------------------------------------------------------------------- #


def load_protocol(folder: str | Path) -> Protocol:
    """Read a protocol folder and return a fully-populated :class:`Protocol`.

    Missing files fall back to defaults; the function only raises if the
    folder itself does not exist or `protocol.json` is unreadable.
    """

    folder_path = Path(folder).expanduser().resolve()
    if not folder_path.is_dir():
        raise FileNotFoundError(f"Protocol folder not found: {folder_path}")

    manifest = _read_json(folder_path / "protocol.json", required=True)
    identity = _parse_identity(manifest)
    analysis = _parse_analysis(manifest)

    variable_a_meta = _parse_variable_metadata("a", folder_path)
    variable_b_meta = _parse_variable_metadata("b", folder_path)

    lexicon_a = _load_variable_lexicon("a", folder_path, variable_a_meta)
    lexicon_b = _load_variable_lexicon("b", folder_path, variable_b_meta)

    cues = _load_cues(folder_path)
    sections = _load_sections(folder_path)

    return Protocol(
        identity=identity,
        variable_a=variable_a_meta,
        variable_b=variable_b_meta,
        lexicon_a=lexicon_a,
        lexicon_b=lexicon_b,
        cues=cues,
        sections=sections,
        analysis=analysis,
        source_path=str(folder_path),
    )


def _read_json(path: Path, required: bool = False) -> Any:
    if not path.exists():
        if required:
            raise FileNotFoundError(f"Required file missing: {path}")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as cause:
        if required:
            raise ValueError(f"Could not parse {path}: {cause}") from cause
        return None


def _parse_identity(manifest: Any) -> ProtocolIdentity:
    if not isinstance(manifest, dict):
        return ProtocolIdentity()
    identity = manifest.get("identity") or {}
    return ProtocolIdentity(
        name=_first_str(identity, "name"),
        description=_first_str(identity, "description"),
        author=_first_str(identity, "author"),
        corpus_language=_first_str(identity, "corpusLanguage", "corpus_language", default="bilingual"),
    )


def _parse_analysis(manifest: Any) -> AnalysisParams:
    defaults = AnalysisParams()
    if not isinstance(manifest, dict):
        return defaults
    analysis = manifest.get("analysis") or {}
    if not isinstance(analysis, dict):
        return defaults
    return AnalysisParams(
        context_radius=int(analysis.get("contextRadius", analysis.get("context_radius", defaults.context_radius)) or defaults.context_radius),
        kwic_radius=int(analysis.get("kwicRadius", analysis.get("kwic_radius", defaults.kwic_radius)) or defaults.kwic_radius),
        relation_distance=int(analysis.get("relationDistance", analysis.get("relation_distance", defaults.relation_distance)) or defaults.relation_distance),
        kmeans_k=int(analysis.get("kmeansK", analysis.get("kmeans_k", defaults.kmeans_k)) or defaults.kmeans_k),
        validation_sample_size=int(analysis.get("validationSampleSize", analysis.get("validation_sample_size", defaults.validation_sample_size)) or defaults.validation_sample_size),
    )


def _parse_variable_metadata(slot: str, folder: Path) -> VariableInfo:
    payload = _read_json(folder / "variables" / f"variable_{slot}.json")
    metadata = (payload or {}).get("metadata") if isinstance(payload, dict) else None
    return VariableInfo(
        slot=slot,
        display_name_es=_first_str(metadata, "displayNameEs", "display_name_es", "name_es"),
        display_name_en=_first_str(metadata, "displayNameEn", "display_name_en", "name_en"),
        mode=_first_str(metadata, "mode", default="hierarchical"),
    )


def _load_variable_lexicon(slot: str, folder: Path, info: VariableInfo) -> list[LexiconEntity]:
    payload = _read_json(folder / "variables" / f"variable_{slot}.json")
    if not isinstance(payload, dict):
        return []
    taxonomy = payload.get("taxonomy")
    if not isinstance(taxonomy, list):
        # Legacy fallback: a flat `entities` array next to the slot file.
        legacy = payload.get("entities")
        if isinstance(legacy, list):
            return [_legacy_entity_to_lexicon(item, slot) for item in legacy if _legacy_entity_to_lexicon(item, slot)]
        return []
    entities: list[LexiconEntity] = []
    _flatten_taxonomy(taxonomy, parent_label="", slot=slot, out=entities)
    return entities


def _legacy_entity_to_lexicon(item: Any, slot: str) -> LexiconEntity | None:
    if not isinstance(item, dict):
        return None
    label_es = _first_str(item, "label_es", "labelEs")
    label_en = _first_str(item, "label_en", "labelEn")
    if not (label_es or label_en):
        return None
    patterns = _compile_patterns(_list_of_str(item.get("patterns")))
    if not patterns:
        return None
    return LexiconEntity(
        entity_id=_first_str(item, "id") or label_es.lower() or label_en.lower(),
        label_es=label_es,
        label_en=label_en,
        category=_first_str(item, "category"),
        entity_type=slot,
        generic=bool(item.get("generic", False)),
        patterns=tuple(patterns),
    )


def _flatten_taxonomy(
    nodes: list[Any],
    parent_label: str,
    slot: str,
    out: list[LexiconEntity],
) -> None:
    for node in nodes:
        if not isinstance(node, dict):
            continue
        kind = _first_str(node, "kind")
        label_es = _first_str(node, "labelEs", "label_es")
        label_en = _first_str(node, "labelEn", "label_en")
        if kind == "term":
            patterns = _compile_patterns(_list_of_str(node.get("patterns")))
            if not patterns or not (label_es or label_en):
                continue
            out.append(
                LexiconEntity(
                    entity_id=_first_str(node, "id") or label_es.lower() or label_en.lower(),
                    label_es=label_es,
                    label_en=label_en,
                    category=parent_label,
                    entity_type=slot,
                    generic=_bool(node, "generic"),
                    patterns=tuple(patterns),
                )
            )
        elif kind == "category":
            children = node.get("children")
            if isinstance(children, list):
                # Prefer the Spanish label as the category string; fall back
                # to English, then to the parent path. The pipeline groups
                # by this string in summaries and figures.
                child_label = label_es or label_en or parent_label
                _flatten_taxonomy(children, parent_label=child_label, slot=slot, out=out)


def _load_cues(folder: Path) -> CueSet:
    cues = CueSet()
    cues_dir = folder / "cues"
    for family in CUE_FAMILIES:
        filename = CUE_FILENAMES[family]
        payload = _read_json(cues_dir / filename)
        if not isinstance(payload, dict):
            # Accept a bare JSON array of strings as a shorthand too.
            if isinstance(payload, list):
                patterns = _list_of_str(payload)
            else:
                continue
        else:
            patterns = _list_of_str(payload.get("patterns"))
        setattr(cues, family, _compile_patterns(patterns))
    return cues


def _load_sections(folder: Path) -> SectionConfig:
    payload = _read_json(folder / "sections.json")
    if not isinstance(payload, dict):
        return SectionConfig()
    weights_raw = payload.get("weights") if isinstance(payload.get("weights"), dict) else {}
    headers_raw = payload.get("headers") if isinstance(payload.get("headers"), dict) else {}
    weights: dict[str, int] = {}
    for key, value in DEFAULT_SECTION_WEIGHTS.items():
        weights[key] = int(weights_raw.get(key, value))
    headers: dict[str, list[re.Pattern[str]]] = {}
    for key in DEFAULT_SECTION_WEIGHTS.keys():
        patterns = _list_of_str(headers_raw.get(key))
        headers[key] = _compile_patterns(patterns)
    return SectionConfig(
        headers=headers,
        weights=weights,
        active_profile=_first_str(payload, "activeProfile", "active_profile", default="baseline_current"),
    )
