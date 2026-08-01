"""Shared fixtures for the scientific regression suite.

Everything the suite needs lives under ``tests/fixtures``:

  * ``fixtures/protocol/`` — a miniature protocol folder with the same
    layout the wizard writes (``protocol.json``, ``variables/``, ``cues/``,
    ``sections.json``). Tests never read the shipped example protocol, so a
    change to ``config/protocols/`` cannot silently rewrite the expected
    values of a test.
  * ``fixtures/corpus/`` — six short synthetic articles as ``.txt``. The
    pipeline accepts ``.txt`` (``io.INPUT_SUFFIXES``), so no PDF and nothing
    copyrighted is committed, and the suite does not depend on the author's
    gitignored corpus.

The fixtures are session-scoped and read-only: a test that needs to mutate
an :class:`Article` must build its own with ``build_article``.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest


TESTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TESTS_DIR.parent

# `python -m pytest` already puts the repo root on `sys.path`; a bare
# `pytest` invocation does not. Adding it here keeps both entry points
# working without an installed package or a hardcoded absolute path.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

FIXTURES_DIR = TESTS_DIR / "fixtures"
PROTOCOL_DIR = FIXTURES_DIR / "protocol"
CORPUS_DIR = FIXTURES_DIR / "corpus"

from review_miner.classify import detect_article_kind, summarize_entity  # noqa: E402
from review_miner.extract import extract_mentions, group_mentions_by_article_entity  # noqa: E402
from review_miner.io import guess_title, load_articles  # noqa: E402
from review_miner.protocol import Protocol, load_protocol  # noqa: E402
from review_miner.relations import build_relations  # noqa: E402
from review_miner.schema import Article, EntitySummary, Mention, Relation  # noqa: E402


# Article ids of the fixture corpus, i.e. the file stems. Declared here so a
# renamed or deleted fixture fails loudly instead of shrinking the corpus a
# test believes it is covering.
CORPUS_IDS = (
    "A1_imrad_completo_es",
    "A2_encabezado_corrido_en",
    "A3_falsos_encabezados_en",
    "A4_referencias_en_tabla_es",
    "A5_entidades_lejanas_en",
    "A6_misma_seccion_en",
)


# --------------------------------------------------------------------------- #
# Protocol and corpus                                                         #
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="session")
def protocol_dir() -> Path:
    return PROTOCOL_DIR


@pytest.fixture(scope="session")
def corpus_dir() -> Path:
    return CORPUS_DIR


@pytest.fixture(scope="session")
def protocol(protocol_dir: Path) -> Protocol:
    """The fixture protocol, loaded exactly as the pipeline loads one."""

    return load_protocol(protocol_dir)


@pytest.fixture(scope="session")
def corpus(corpus_dir: Path, protocol: Protocol) -> dict[str, Article]:
    """Every fixture article, keyed by id, with ``article_kind`` resolved.

    Mirrors the first two steps of :func:`review_miner.pipeline.run_pipeline`
    so the objects the tests inspect are the objects the pipeline builds.
    """

    articles = load_articles(corpus_dir)
    assert [a.article_id for a in articles] == sorted(CORPUS_IDS), (
        "the fixture corpus changed; update CORPUS_IDS in conftest.py"
    )
    for article in articles:
        article.article_kind = detect_article_kind(article, protocol.cues)
        assert article.text_extractable, f"{article.article_id} is too short to be mined"
    return {article.article_id: article for article in articles}


@pytest.fixture(scope="session")
def article(corpus: dict[str, Article]):
    """``article("A1_imrad_completo_es")`` -> the loaded :class:`Article`."""

    def _article(article_id: str) -> Article:
        assert article_id in corpus, f"unknown fixture article: {article_id}"
        return corpus[article_id]

    return _article


# --------------------------------------------------------------------------- #
# Pipeline stages over a single article                                       #
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="session")
def mentions_of(protocol: Protocol):
    """Run the real extractor with the fixture protocol's parameters."""

    def _mentions_of(article: Article) -> list[Mention]:
        return extract_mentions(
            article=article,
            entities=protocol.all_entities(),
            cues=protocol.cues,
            sections=protocol.sections,
            context_radius=protocol.analysis.context_radius,
        )

    return _mentions_of


@pytest.fixture(scope="session")
def summaries_of(protocol: Protocol):
    """``{(entity_type, entity_id): EntitySummary}`` for one article."""

    def _summaries_of(
        article: Article, mentions: list[Mention]
    ) -> dict[tuple[str, str], EntitySummary]:
        grouped = group_mentions_by_article_entity(mentions)
        return {
            (entity_type, entity_id): summarize_entity(
                article, group, protocol.cues, protocol.sections
            )
            for (_, entity_type, entity_id), group in grouped.items()
        }

    return _summaries_of


@pytest.fixture(scope="session")
def relations_of(protocol: Protocol, mentions_of, summaries_of):
    """Relations for one article, honouring an overridden ``relation_distance``."""

    def _relations_of(article: Article, relation_distance: int | None = None) -> list[Relation]:
        mentions = mentions_of(article)
        distance = (
            protocol.analysis.relation_distance if relation_distance is None else relation_distance
        )
        return build_relations(
            article=article,
            mentions_a=[m for m in mentions if m.entity_type == "a"],
            mentions_b=[m for m in mentions if m.entity_type == "b"],
            summaries=summaries_of(article, mentions),
            cues=protocol.cues,
            sections=protocol.sections,
            relation_distance=distance,
        )

    return _relations_of


# --------------------------------------------------------------------------- #
# Factories for hand-built inputs                                             #
# --------------------------------------------------------------------------- #


@pytest.fixture
def build_article(protocol: Protocol):
    """Build an :class:`Article` from raw text, as ``io.load_articles`` would.

    Used by the tests that need a single controlled sentence instead of a
    whole fixture file (association ladder, ``relation_distance`` sweep,
    article-kind table).
    """

    def _build_article(
        text: str,
        article_id: str = "SYN",
        title: str | None = None,
        metadata_study_type: str = "",
        detect_kind: bool = True,
    ) -> Article:
        resolved_title = guess_title(text, "", {}) if title is None else title
        article = Article(
            article_id=article_id,
            source_path=f"<memoria>/{article_id}.txt",
            title=resolved_title,
            metadata_study_type=metadata_study_type,
            text=text,
            pages=1,
            word_count=len(text.split()),
        )
        if detect_kind:
            article.article_kind = detect_article_kind(article, protocol.cues)
        return article

    return _build_article


@pytest.fixture
def build_mention():
    """Build one :class:`Mention` with only the fields scoring depends on.

    Every cue flag defaults to ``False`` so a test states exactly the cues
    it means to exercise, and an added cue in the future cannot silently
    change an expected score.
    """

    def _build_mention(
        section: str,
        *,
        entity_type: str = "a",
        entity_id: str = "e1",
        matched_text: str = "plomo",
        start: int = 0,
        cue_exposure: bool = False,
        cue_dose: bool = False,
        cue_association: bool = False,
        cue_speculative: bool = False,
        cue_negation: bool = False,
        is_generic: bool = False,
    ) -> Mention:
        return Mention(
            article_id="SYN",
            source_path="<memoria>/SYN.txt",
            entity_type=entity_type,
            entity_id=entity_id,
            label_es=matched_text,
            label_en=matched_text,
            category="categoria",
            matched_text=matched_text,
            section=section,
            start=start,
            end=start + len(matched_text),
            page=1,
            context=matched_text,
            sentence=matched_text,
            is_generic=is_generic,
            cue_exposure=cue_exposure,
            cue_dose=cue_dose,
            cue_association=cue_association,
            cue_speculative=cue_speculative,
            cue_negation=cue_negation,
        )

    return _build_mention
