from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class LexiconEntity:
    """A dictionary entity compiled from a controlled lexicon.

    ``entity_type`` is the protocol slot — ``"a"`` or ``"b"`` — used by the
    pipeline to keep both variables straight. Display labels (``label_es``
    and ``label_en``) and ``category`` carry the strings the protocol author
    chose; the pipeline never reinterprets them.
    """

    entity_id: str
    label_es: str
    label_en: str
    category: str
    entity_type: str
    generic: bool
    patterns: tuple[object, ...]


@dataclass
class Article:
    """Article text and metadata used by the pipeline."""

    article_id: str
    source_path: str
    title: str = ""
    year: str = ""
    doi: str = ""
    metadata_study_type: str = ""
    text: str = ""
    pages: int = 0
    word_count: int = 0
    text_extractable: bool = True
    article_kind: str = "no_determinado"
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass
class SectionSpan:
    name: str
    start: int
    end: int


@dataclass
class Mention:
    """Single entity mention with surrounding context and cues."""

    article_id: str
    source_path: str
    entity_type: str  # "a" or "b"
    entity_id: str
    label_es: str
    label_en: str
    category: str
    matched_text: str
    section: str
    start: int
    end: int
    page: int
    context: str
    sentence: str
    is_generic: bool
    cue_exposure: bool = False
    cue_dose: bool = False
    cue_association: bool = False
    cue_speculative: bool = False
    cue_negation: bool = False


@dataclass
class EntitySummary:
    """Article-level summary for one entity (variable A or B)."""

    article_id: str
    entity_type: str  # "a" or "b"
    entity_id: str
    label_es: str
    label_en: str
    category: str
    n_mentions: int
    sections: dict[str, int]
    role: str = ""
    study_context: str = ""
    confidence: str = ""
    confidence_score: int = 0
    evidence_text: str = ""
    inference_basis: str = ""


@dataclass
class Relation:
    """Evidence-backed relation between one Variable-A and one Variable-B entity.

    The naming is intentionally generic — the legacy fields named after
    "contaminant" / "disease" have been replaced by ``entity_a_*`` /
    ``entity_b_*``. Downstream code reads the protocol to recover human
    display labels for charts and reports.
    """

    article_id: str
    entity_a_id: str
    entity_a_label: str
    entity_a_category: str
    entity_b_id: str
    entity_b_label: str
    entity_b_category: str
    association: str
    confidence: str
    confidence_score: int
    section: str
    evidence_text: str
    extraction_or_inference: str
    study_context: str
