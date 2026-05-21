"""Mention extraction with protocol-driven cues.

The five mention-level cue families (exposure, dose, association,
speculative, negation) are now loaded from the protocol rather than baked
into module-level regex constants. The relations module reads the same
:class:`CueSet` to apply the ``strong_association`` family.
"""

from __future__ import annotations

from collections import defaultdict

from .protocol import CueSet, SectionConfig
from .schema import Article, LexiconEntity, Mention
from .sections import detect_sections, section_for_position
from .text import context_window, page_for_position, sentence_at


def extract_mentions(
    article: Article,
    entities: list[LexiconEntity],
    cues: CueSet,
    sections: SectionConfig,
    context_radius: int = 260,
) -> list[Mention]:
    """Find every dictionary mention in ``article.text``.

    For each match we:
      * estimate the section it falls in (using protocol-defined headers)
      * pull a context window of ``context_radius`` chars on each side
      * flag which cue families fire inside that context window

    Cues with empty pattern lists simply contribute ``False`` — protocols
    can disable a family by removing all of its patterns.
    """

    spans = detect_sections(article.text, sections)
    mentions: list[Mention] = []
    seen: set[tuple[str, int, int]] = set()
    for entity in entities:
        for pattern in entity.patterns:
            for match in pattern.finditer(article.text):
                key = (entity.entity_id, match.start(), match.end())
                if key in seen:
                    continue
                seen.add(key)
                section = section_for_position(spans, match.start())
                sentence = sentence_at(article.text, match.start(), match.end())
                context = context_window(article.text, match.start(), match.end(), radius=context_radius)
                mentions.append(
                    Mention(
                        article_id=article.article_id,
                        source_path=article.source_path,
                        entity_type=entity.entity_type,
                        entity_id=entity.entity_id,
                        label_es=entity.label_es,
                        label_en=entity.label_en,
                        category=entity.category,
                        matched_text=match.group(0),
                        section=section,
                        start=match.start(),
                        end=match.end(),
                        page=page_for_position(article.text, match.start(), article.pages),
                        context=context,
                        sentence=sentence,
                        is_generic=entity.generic,
                        cue_exposure=cues.any_match("exposure", context),
                        cue_dose=cues.any_match("dose", context),
                        cue_association=cues.any_match("association", context),
                        cue_speculative=cues.any_match("speculative", context),
                        cue_negation=cues.any_match("negation", context),
                    )
                )
    return sorted(mentions, key=lambda item: (item.start, item.entity_type, item.entity_id))


def group_mentions_by_article_entity(
    mentions: list[Mention],
) -> dict[tuple[str, str, str], list[Mention]]:
    grouped: dict[tuple[str, str, str], list[Mention]] = defaultdict(list)
    for mention in mentions:
        grouped[(mention.article_id, mention.entity_type, mention.entity_id)].append(mention)
    return grouped
