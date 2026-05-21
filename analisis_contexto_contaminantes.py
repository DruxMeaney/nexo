#!/usr/bin/env python3
"""
Analisis auditable de contaminantes en articulos PDF.

El objetivo no es solo contar palabras, sino estimar si un contaminante parece
ser la exposicion/ensayo del articulo o si aparece como mencion de contexto.

Salidas principales:
  - menciones_auditables.csv: una fila por mencion encontrada, con seccion y contexto.
  - resumen_contaminantes_por_articulo.csv: conteo y clasificacion por articulo/contaminante.
  - resumen_articulos.csv: contaminantes principales por articulo.
  - resumen_categorias.csv: agregados por familia de contaminante.
  - graficas/*.svg: graficas generadas sin dependencias externas de graficacion.
"""

from __future__ import annotations

import argparse
import bisect
import csv
import html
import json
import math
import re
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader

try:
    import openpyxl
except Exception:  # pragma: no cover - el script puede correr sin Excel
    openpyxl = None


SECTION_PATTERNS = [
    ("title_abstract", r"(?im)^\s*(abstract|resumen)\b"),
    ("introduction", r"(?im)^\s*(\d+\.?\s*)?(introduction|introducci[oó]n)\b"),
    ("methods", r"(?im)^\s*(\d+\.?\s*)?((materials?\s+and\s+methods?)|(methods?)|(methodology)|(experimental\s+procedures?)|(study\s+population)|(participants?\s+and\s+methods?)|(materiales\s+y\s+m[eé]todos)|(m[eé]todos))\b"),
    ("results", r"(?im)^\s*(\d+\.?\s*)?(results?|resultados)\b"),
    ("discussion", r"(?im)^\s*(\d+\.?\s*)?(discussion|discusi[oó]n)\b"),
    ("conclusion", r"(?im)^\s*(\d+\.?\s*)?(conclusions?|conclusiones?)\b"),
    ("references", r"(?im)^\s*(references|referencias|bibliography|literature\s+cited)\b"),
]

SECTION_SCORE = {
    "title_abstract": 4,
    "methods": 5,
    "results": 3,
    "discussion": 2,
    "conclusion": 2,
    "introduction": 1,
    "other": 1,
    "references": -2,
}

EXPOSURE_CUES = re.compile(
    r"\b("
    r"expos(?:ed|ure|icion|ición|iciones)|treated|treatment|administered|administration|"
    r"dose|doses|dosage|concentration|concentrations|levels?|measured|measurement|"
    r"serum|urine|urinary|blood|brain|drinking\s+water|well[-\s]?water|waterborne|"
    r"contaminated\s+water|contaminated\s+drinking\s+water|groups?|control\s+group|"
    r"risk|hazard|odds\s+ratio|relative\s+risk|hazard\s+ratio|associated|association|"
    r"oral|gavage|ad\s+libitum|in\s+vivo|in\s+vitro|model|assay|ensayo|grupo|control"
    r")\b",
    re.IGNORECASE,
)

DOSE_CUES = re.compile(
    r"(\b\d+(?:[\.,]\d+)?\s*(mg/l|ug/l|µg/l|μg/l|ng/l|ppm|ppb|mg/kg|µm|μm|um|nm|g/l)\b|"
    r"\b(ng/l|µg/l|μg/l|mg/l|ppm|ppb|mg/kg|µm|μm)\b)",
    re.IGNORECASE,
)

BACKGROUND_CUES = re.compile(
    r"\b("
    r"review|revisi[oó]n|previous\s+studies|prior\s+studies|literature|reported|"
    r"has\s+been\s+associated|have\s+been\s+associated|background|antecedentes|"
    r"hypothesis|suggested|se\s+ha\s+reportado|estudios\s+previos"
    r")\b",
    re.IGNORECASE,
)

REVIEW_CUES = re.compile(
    r"\b(review|systematic\s+review|narrative\s+review|meta[-\s]?analysis|"
    r"revisi[oó]n|metaan[aá]lisis)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Contaminant:
    canonico: str
    familia: str
    patrones: tuple[re.Pattern, ...]
    generico: bool = False


@dataclass
class Mention:
    article_id: str
    pdf_path: str
    page: int
    title: str
    article_kind: str
    contaminant: str
    family: str
    matched_text: str
    section: str
    start: int
    end: int
    exposure_cue: bool
    dose_cue: bool
    background_cue: bool
    context: str
    generic_term: bool


def natural_key(path: Path) -> tuple[str, int]:
    match = re.match(r"([A-Za-z]+)(\d+)$", path.stem)
    if not match:
        return (path.stem, 0)
    return (match.group(1), int(match.group(2)))


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def load_lexicon(path: Path) -> list[Contaminant]:
    data = json.loads(path.read_text(encoding="utf-8"))
    contaminants: list[Contaminant] = []
    for item in data["contaminantes"]:
        patterns = tuple(re.compile(pattern, re.IGNORECASE) for pattern in item["patrones"])
        contaminants.append(
            Contaminant(
                canonico=item["canonico"],
                familia=item["familia"],
                patrones=patterns,
                generico=bool(item.get("generico", False)),
            )
        )
    return contaminants


def read_metadata_from_excel(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists() or openpyxl is None:
        return {}

    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    header_index = 0
    for index, row in enumerate(rows[:10]):
        values = [str(value).strip().lower() if value is not None else "" for value in row]
        if "doi" in values:
            header_index = index
            break

    raw_headers = rows[header_index]
    headers: list[str] = []
    for index, value in enumerate(raw_headers, start=1):
        headers.append(str(value).strip() if value not in (None, "") else f"col{index}")

    records: dict[str, dict[str, str]] = {}
    for row in rows[header_index + 1 :]:
        if not any(value is not None for value in row):
            continue
        article_id = None
        for value in row[:4]:
            if value is None:
                continue
            candidate = str(value).strip()
            if re.fullmatch(r"[A-Za-z]+\d+", candidate):
                article_id = candidate
                break
        if not article_id:
            continue
        record = {}
        for index, header in enumerate(headers):
            value = row[index] if index < len(row) else None
            record[header] = "" if value is None else str(value)
        records[article_id] = record
    return records


def load_metadata_sources(value: str) -> list[tuple[Path, dict[str, dict[str, str]]]]:
    sources: list[tuple[Path, dict[str, dict[str, str]]]] = []
    for raw_path in (value or "").split(","):
        path = Path(raw_path.strip())
        if not raw_path.strip() or not path.exists():
            continue
        sources.append((path, read_metadata_from_excel(path)))
    return sources


def title_tokens(title: str) -> set[str]:
    blocked = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "between",
        "relation",
        "study",
        "effects",
        "effect",
        "water",
        "disease",
        "exposure",
        "contaminants",
        "contaminantes",
    }
    tokens = {
        token.lower()
        for token in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñβα]+", title)
        if len(token) >= 5 and token.lower() not in blocked
    }
    return tokens


def choose_excel_record(
    article_id: str,
    text: str,
    sources: list[tuple[Path, dict[str, dict[str, str]]]],
) -> dict[str, str]:
    candidates = [records[article_id] for _, records in sources if article_id in records]
    if not candidates:
        return {}
    if len(candidates) == 1:
        return candidates[0]

    searchable_text = text[:12000].lower()
    best_record = candidates[0]
    best_score = -1
    for record in candidates:
        candidate_title = normalize_space(record.get("Paper name", "") or record.get("col3", ""))
        tokens = title_tokens(candidate_title)
        score = sum(1 for token in tokens if token.lower() in searchable_text)
        if score > best_score:
            best_score = score
            best_record = record
    return best_record


def extract_pdf_text(pdf_path: Path) -> tuple[str, list[int], str, list[str]]:
    reader = PdfReader(str(pdf_path), strict=False)
    metadata_title = ""
    try:
        metadata_title = normalize_space((reader.metadata or {}).get("/Title", "") or "")
    except Exception:
        metadata_title = ""

    page_texts: list[str] = []
    page_starts: list[int] = []
    full_parts: list[str] = []
    cursor = 0
    for page in reader.pages:
        page_starts.append(cursor)
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        page_texts.append(text)
        full_parts.append(text)
        cursor += len(text) + 2
    return "\n\n".join(full_parts), page_starts, metadata_title, page_texts


def guess_title(text: str, metadata_title: str, excel_record: dict[str, str] | None) -> str:
    if excel_record:
        for key in ("Paper name", "col3", ""):
            if key in excel_record and normalize_space(excel_record[key]):
                return normalize_space(excel_record[key])

    if metadata_title and len(metadata_title) >= 10:
        blocked = ("microsoft", "elsevier", "springer", "wiley", "frontiers")
        if not metadata_title.lower().startswith(blocked):
            return metadata_title[:240]

    lines = [normalize_space(line) for line in text.splitlines()[:80]]
    lines = [line for line in lines if len(line) >= 12]
    bad_fragments = [
        "journal homepage",
        "www.",
        "http",
        "doi:",
        "copyright",
        "accepted",
        "received",
        "available online",
        "issn",
        "volume",
    ]
    for line in lines:
        lower = line.lower()
        if any(fragment in lower for fragment in bad_fragments):
            continue
        if len(line) <= 220:
            return line
    return ""


def detect_article_kind(title: str, text: str, excel_record: dict[str, str] | None) -> str:
    study_type = normalize_space((excel_record or {}).get("Study type", ""))
    haystack = f"{title} {study_type}"
    if REVIEW_CUES.search(haystack):
        return "revision_o_sintesis"
    if re.search(r"\b(case[-\s]?control|caso[-\s]?control|cohort|cohorte|cross[-\s]?sectional|transversal|longitudinal|registry|registro|ecological|ecol[oó]gico|epidemiol[oó]gico|observacional)\b", haystack, re.IGNORECASE):
        return "epidemiologico_observacional"
    if re.search(r"\b(preclinical|precl[ií]nico|basic|experimental|in\s+vivo|in\s+vitro|zebrafish|mouse|mice|rat|cell\s+line|larvae|experimental)\b", haystack, re.IGNORECASE):
        return "preclinico_experimental"
    first_text = text[:1200]
    if re.search(r"\b(in\s+vivo|in\s+vitro|zebrafish|mouse|mice|rat|cell\s+line|larvae|experimental)\b", first_text, re.IGNORECASE):
        return "preclinico_experimental"
    return "no_determinado"


def section_markers(text: str) -> list[tuple[int, str]]:
    markers: list[tuple[int, str]] = [(0, "title_abstract")]
    for section, pattern in SECTION_PATTERNS:
        for match in re.finditer(pattern, text):
            markers.append((match.start(), section))
    markers.sort(key=lambda item: item[0])
    deduped: list[tuple[int, str]] = []
    for marker in markers:
        if deduped and marker[0] == deduped[-1][0]:
            deduped[-1] = marker
        else:
            deduped.append(marker)
    return deduped


def section_for_position(markers: list[tuple[int, str]], position: int, text_length: int) -> str:
    if position < min(3500, max(1200, int(text_length * 0.04))):
        return "title_abstract"
    starts = [marker[0] for marker in markers]
    index = bisect.bisect_right(starts, position) - 1
    if index < 0:
        return "other"
    return markers[index][1]


def page_for_position(page_starts: list[int], position: int) -> int:
    index = bisect.bisect_right(page_starts, position) - 1
    return max(1, index + 1)


def context_window(text: str, start: int, end: int, radius: int = 220) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    return normalize_space(text[left:right])


def iter_mentions(
    text: str,
    pdf_path: Path,
    article_id: str,
    page_starts: list[int],
    title: str,
    article_kind: str,
    contaminants: Iterable[Contaminant],
) -> Iterable[Mention]:
    markers = section_markers(text)
    for contaminant in contaminants:
        seen_spans: set[tuple[int, int]] = set()
        for pattern in contaminant.patrones:
            for match in pattern.finditer(text):
                span = (match.start(), match.end())
                if span in seen_spans:
                    continue
                seen_spans.add(span)
                context = context_window(text, match.start(), match.end())
                yield Mention(
                    article_id=article_id,
                    pdf_path=str(pdf_path),
                    page=page_for_position(page_starts, match.start()),
                    title=title,
                    article_kind=article_kind,
                    contaminant=contaminant.canonico,
                    family=contaminant.familia,
                    matched_text=match.group(0),
                    section=section_for_position(markers, match.start(), len(text)),
                    start=match.start(),
                    end=match.end(),
                    exposure_cue=bool(EXPOSURE_CUES.search(context)),
                    dose_cue=bool(DOSE_CUES.search(context)),
                    background_cue=bool(BACKGROUND_CUES.search(context)),
                    context=context,
                    generic_term=contaminant.generico,
                )


def mention_score(mention: Mention) -> int:
    score = SECTION_SCORE.get(mention.section, 1)
    if mention.exposure_cue:
        score += 4
    if mention.dose_cue:
        score += 5
    if mention.background_cue:
        score -= 1
    if mention.generic_term:
        score -= 1
    return score


def classify_group(mentions: list[Mention], score: int) -> str:
    sections = Counter(mention.section for mention in mentions)
    exposure_mentions = sum(mention.exposure_cue for mention in mentions)
    dose_mentions = sum(mention.dose_cue for mention in mentions)
    informative_sections = sections["title_abstract"] + sections["methods"] + sections["results"] + sections["discussion"] + sections["conclusion"]
    central_sections = sections["title_abstract"] + sections["methods"] + sections["results"]
    intro_reference_only = (
        sections["introduction"] + sections["references"] == len(mentions)
        and informative_sections == 0
    )
    central_evidence = (
        sections["methods"] > 0
        or sections["results"] > 0
        or sections["title_abstract"] >= 2
        or (sections["title_abstract"] >= 1 and dose_mentions >= 1)
    )

    if not mentions:
        return "sin_menciones"
    if mentions[0].article_kind == "revision_o_sintesis":
        return "revision_o_sintesis"
    if sections["references"] == len(mentions):
        return "solo_referencias"
    if intro_reference_only and exposure_mentions == 0 and dose_mentions == 0:
        return "mencion_de_contexto"
    if (
        score >= 12
        and central_sections > 0
        and central_evidence
        and (exposure_mentions > 0 or dose_mentions > 0 or sections["methods"] > 0)
    ):
        return "trabajado_como_exposicion_o_ensayo"
    if score >= 6 and informative_sections > 0:
        return "posible_secundario"
    return "mencion_de_contexto"


def summarize_mentions(mentions: list[Mention], max_contexts: int) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    grouped: dict[tuple[str, str], list[Mention]] = defaultdict(list)
    for mention in mentions:
        grouped[(mention.article_id, mention.contaminant)].append(mention)

    contaminant_rows: list[dict[str, object]] = []
    article_groups: dict[str, list[dict[str, object]]] = defaultdict(list)
    for (article_id, contaminant), group in sorted(grouped.items()):
        group_score = sum(mention_score(mention) for mention in group)
        section_counts = Counter(mention.section for mention in group)
        exposure_count = sum(mention.exposure_cue for mention in group)
        dose_count = sum(mention.dose_cue for mention in group)
        background_count = sum(mention.background_cue for mention in group)
        classification = classify_group(group, group_score)

        example_contexts = []
        sorted_examples = sorted(
            group,
            key=lambda item: (
                0 if item.section in {"title_abstract", "methods", "results"} else 1,
                -int(item.exposure_cue),
                -int(item.dose_cue),
                item.page,
            ),
        )
        for mention in sorted_examples[:max_contexts]:
            example_contexts.append(f"p.{mention.page} [{mention.section}] {mention.context}")

        row = {
            "article_id": article_id,
            "pdf_path": group[0].pdf_path,
            "title": group[0].title,
            "article_kind": group[0].article_kind,
            "familia": group[0].family,
            "contaminante": contaminant,
            "clasificacion": classification,
            "score_contextual": group_score,
            "menciones_totales": len(group),
            "menciones_title_abstract": section_counts["title_abstract"],
            "menciones_introduction": section_counts["introduction"],
            "menciones_methods": section_counts["methods"],
            "menciones_results": section_counts["results"],
            "menciones_discussion": section_counts["discussion"],
            "menciones_conclusion": section_counts["conclusion"],
            "menciones_references": section_counts["references"],
            "menciones_other": section_counts["other"],
            "menciones_con_cue_exposicion": exposure_count,
            "menciones_con_cue_dosis": dose_count,
            "menciones_con_cue_fondo": background_count,
            "ejemplos_contexto": " || ".join(example_contexts),
        }
        contaminant_rows.append(row)
        article_groups[article_id].append(row)

    article_rows: list[dict[str, object]] = []
    for article_id, rows in sorted(article_groups.items()):
        title = str(rows[0]["title"])
        kind = str(rows[0]["article_kind"])
        worked = [row for row in rows if row["clasificacion"] == "trabajado_como_exposicion_o_ensayo"]
        possible = [row for row in rows if row["clasificacion"] == "posible_secundario"]
        reviews = [row for row in rows if row["clasificacion"] == "revision_o_sintesis"]
        context = [row for row in rows if row["clasificacion"] in {"mencion_de_contexto", "solo_referencias"}]

        def top_names(items: list[dict[str, object]], limit: int = 8) -> str:
            sorted_items = sorted(items, key=lambda row: (int(row["score_contextual"]), int(row["menciones_totales"])), reverse=True)
            return "; ".join(f"{row['contaminante']} ({row['familia']})" for row in sorted_items[:limit])

        article_rows.append(
            {
                "article_id": article_id,
                "title": title,
                "article_kind": kind,
                "contaminantes_trabajados": top_names(worked),
                "contaminantes_posibles_secundarios": top_names(possible),
                "contaminantes_en_revision": top_names(reviews),
                "contaminantes_solo_contexto": top_names(context),
                "n_contaminantes_trabajados": len(worked),
                "n_contaminantes_posibles": len(possible),
                "n_contaminantes_contexto": len(context),
                "menciones_totales": sum(int(row["menciones_totales"]) for row in rows),
            }
        )

    category_counter: dict[tuple[str, str], set[str]] = defaultdict(set)
    category_mentions: Counter[tuple[str, str]] = Counter()
    for row in contaminant_rows:
        key = (str(row["familia"]), str(row["clasificacion"]))
        category_counter[key].add(str(row["article_id"]))
        category_mentions[key] += int(row["menciones_totales"])

    category_rows: list[dict[str, object]] = []
    families = sorted({family for family, _ in category_counter.keys()})
    classifications = [
        "trabajado_como_exposicion_o_ensayo",
        "posible_secundario",
        "revision_o_sintesis",
        "mencion_de_contexto",
        "solo_referencias",
    ]
    for family in families:
        row: dict[str, object] = {"familia": family}
        for classification in classifications:
            key = (family, classification)
            row[f"articulos_{classification}"] = len(category_counter.get(key, set()))
            row[f"menciones_{classification}"] = category_mentions.get(key, 0)
        row["articulos_total"] = len(set().union(*(category_counter.get((family, c), set()) for c in classifications)))
        row["menciones_total"] = sum(category_mentions.get((family, c), 0) for c in classifications)
        category_rows.append(row)

    return contaminant_rows, article_rows, category_rows


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else []
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def svg_bar_chart(title: str, items: list[tuple[str, float]], output_path: Path, width: int = 1100, bar_height: int = 28) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not items:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return

    items = items[:30]
    left = 310
    right = 60
    top = 70
    bottom = 40
    height = top + bottom + len(items) * bar_height
    max_value = max(value for _, value in items) or 1
    chart_width = width - left - right
    palette = ["#176B87", "#C2410C", "#4D7C0F", "#7C3AED", "#B45309", "#0F766E"]

    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        "<rect width='100%' height='100%' fill='#ffffff'/>",
        f"<text x='24' y='36' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='#111827'>{html.escape(title)}</text>",
    ]
    for index, (label, value) in enumerate(items):
        y = top + index * bar_height
        bar_width = max(2, chart_width * (value / max_value))
        color = palette[index % len(palette)]
        parts.append(f"<text x='24' y='{y + 18}' font-family='Arial, sans-serif' font-size='13' fill='#111827'>{html.escape(label[:48])}</text>")
        parts.append(f"<rect x='{left}' y='{y + 5}' width='{bar_width:.1f}' height='18' fill='{color}' rx='2'/>")
        parts.append(f"<text x='{left + bar_width + 8}' y='{y + 19}' font-family='Arial, sans-serif' font-size='12' fill='#374151'>{value:g}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def svg_stacked_chart(title: str, rows: list[dict[str, object]], output_path: Path, width: int = 1200, bar_height: int = 34) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        output_path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return

    keys = [
        ("articulos_trabajado_como_exposicion_o_ensayo", "Trabajado", "#176B87"),
        ("articulos_posible_secundario", "Posible", "#D97706"),
        ("articulos_revision_o_sintesis", "Revision", "#6D28D9"),
        ("articulos_mencion_de_contexto", "Contexto", "#64748B"),
        ("articulos_solo_referencias", "Referencias", "#9CA3AF"),
    ]
    rows = sorted(rows, key=lambda row: int(row.get("articulos_total", 0)), reverse=True)
    left = 330
    right = 90
    top = 92
    bottom = 50
    height = top + bottom + len(rows) * bar_height
    chart_width = width - left - right
    max_value = max(int(row.get("articulos_total", 0)) for row in rows) or 1

    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>",
        "<rect width='100%' height='100%' fill='#ffffff'/>",
        f"<text x='24' y='36' font-family='Arial, sans-serif' font-size='22' font-weight='700' fill='#111827'>{html.escape(title)}</text>",
    ]
    legend_x = 24
    for _, label, color in keys:
        parts.append(f"<rect x='{legend_x}' y='56' width='12' height='12' fill='{color}'/>")
        parts.append(f"<text x='{legend_x + 18}' y='67' font-family='Arial, sans-serif' font-size='12' fill='#374151'>{html.escape(label)}</text>")
        legend_x += 118

    for index, row in enumerate(rows):
        y = top + index * bar_height
        label = str(row["familia"])
        parts.append(f"<text x='24' y='{y + 22}' font-family='Arial, sans-serif' font-size='13' fill='#111827'>{html.escape(label[:50])}</text>")
        x = left
        for key, _, color in keys:
            value = int(row.get(key, 0))
            if value <= 0:
                continue
            segment_width = chart_width * (value / max_value)
            parts.append(f"<rect x='{x:.1f}' y='{y + 8}' width='{segment_width:.1f}' height='20' fill='{color}' rx='2'/>")
            if segment_width > 24:
                parts.append(f"<text x='{x + segment_width / 2:.1f}' y='{y + 22}' text-anchor='middle' font-family='Arial, sans-serif' font-size='11' fill='#ffffff'>{value}</text>")
            x += segment_width
        parts.append(f"<text x='{left + chart_width + 8}' y='{y + 22}' font-family='Arial, sans-serif' font-size='12' fill='#374151'>{row.get('articulos_total', 0)}</text>")
    parts.append("</svg>")
    output_path.write_text("\n".join(parts), encoding="utf-8")


def write_markdown_report(
    output_path: Path,
    pdf_count: int,
    no_text: list[str],
    mentions: list[Mention],
    contaminant_rows: list[dict[str, object]],
    category_rows: list[dict[str, object]],
    args: argparse.Namespace,
) -> None:
    worked = [row for row in contaminant_rows if row["clasificacion"] == "trabajado_como_exposicion_o_ensayo"]
    possible = [row for row in contaminant_rows if row["clasificacion"] == "posible_secundario"]
    context = [row for row in contaminant_rows if row["clasificacion"] in {"mencion_de_contexto", "solo_referencias"}]
    scores = [int(row["score_contextual"]) for row in contaminant_rows]
    median_score = statistics.median(scores) if scores else 0

    lines = [
        "# Reporte del algoritmo contextual de contaminantes",
        "",
        "## Resumen",
        "",
        f"- PDFs analizados: {pdf_count}",
        f"- PDFs sin texto extraible: {len(no_text)}" + (f" ({', '.join(no_text)})" if no_text else ""),
        f"- Menciones encontradas: {len(mentions)}",
        f"- Pares articulo-contaminante clasificados como trabajados: {len(worked)}",
        f"- Pares articulo-contaminante clasificados como posibles secundarios: {len(possible)}",
        f"- Pares articulo-contaminante clasificados como contexto/referencias: {len(context)}",
        f"- Score contextual mediano: {median_score}",
        "",
        "## Regla de decision",
        "",
        "Cada mencion se evalua por seccion del articulo y por palabras de contexto cercanas.",
        "Las menciones en titulo/resumen, metodos, resultados y discusion pesan mas que las menciones en introduccion o referencias.",
        "Tambien suben el score las pistas de exposicion, ensayo, medicion, dosis o unidades como mg/L, ppm o ug/L.",
        "",
        "Clasificacion principal:",
        "",
        "- `trabajado_como_exposicion_o_ensayo`: el contaminante aparece en secciones informativas y con pistas de exposicion, medicion o dosis.",
        "- `posible_secundario`: hay evidencia contextual, pero no suficiente para tratarlo como exposicion central sin revision humana.",
        "- `mencion_de_contexto`: aparece principalmente como antecedente, comparacion o mencion general.",
        "- `revision_o_sintesis`: el articulo parece ser una revision; se separa porque no corresponde a ensayo primario.",
        "- `solo_referencias`: la mencion aparece unicamente en referencias.",
        "",
        "## Parametros",
        "",
        f"- Carpeta de PDFs: `{args.pdf_dir}`",
        f"- Lexico: `{args.lexicon}`",
        f"- Excel de metadatos: `{args.metadata_xlsx or ''}`",
        f"- Contextos por resumen: {args.max_contexts}",
        "",
        "## Archivos generados",
        "",
        "- `menciones_auditables.csv`: una fila por mencion, con pagina, seccion y ventana de contexto.",
        "- `resumen_contaminantes_por_articulo.csv`: resumen y clasificacion por articulo-contaminante.",
        "- `resumen_articulos.csv`: vista por articulo.",
        "- `resumen_categorias.csv`: vista por familia de contaminante.",
        "- `graficas/*.svg`: graficas vectoriales.",
        "",
        "## Familias con mas articulos trabajados",
        "",
    ]
    for row in sorted(category_rows, key=lambda item: int(item.get("articulos_trabajado_como_exposicion_o_ensayo", 0)), reverse=True)[:12]:
        lines.append(
            f"- {row['familia']}: {row.get('articulos_trabajado_como_exposicion_o_ensayo', 0)} trabajados, "
            f"{row.get('articulos_posible_secundario', 0)} posibles, {row.get('articulos_mencion_de_contexto', 0)} contexto"
        )
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Cuenta contaminantes en PDFs y estima contexto de uso.")
    parser.add_argument("--pdf-dir", default="Articulos", help="Carpeta con PDFs.")
    parser.add_argument("--lexicon", default="contaminantes_lexico.json", help="Archivo JSON con el diccionario de contaminantes.")
    parser.add_argument(
        "--metadata-xlsx",
        default="ArticulosTotales.xlsx,Base de articulos completa.xlsx",
        help="Excel opcional con metadatos por ID. Se pueden pasar varios separados por coma; se elige el que mejor coincida con el texto del PDF.",
    )
    parser.add_argument("--output-dir", default="salidas_contexto_contaminantes", help="Carpeta de salida.")
    parser.add_argument("--max-contexts", type=int, default=3, help="Numero de ejemplos de contexto en el resumen.")
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    output_dir = Path(args.output_dir)
    contaminants = load_lexicon(Path(args.lexicon))
    metadata_sources = load_metadata_sources(args.metadata_xlsx)

    mentions: list[Mention] = []
    pdf_diagnostics: list[dict[str, object]] = []
    no_text: list[str] = []

    pdf_paths = sorted(pdf_dir.glob("*.pdf"), key=natural_key)
    for pdf_path in pdf_paths:
        article_id = pdf_path.stem
        text, page_starts, metadata_title, page_texts = extract_pdf_text(pdf_path)
        excel_record = choose_excel_record(article_id, text, metadata_sources)
        title = guess_title(text, metadata_title, excel_record)
        article_kind = detect_article_kind(title, text, excel_record)
        word_count = len(re.findall(r"\b\w+\b", text))
        if word_count < 50:
            no_text.append(article_id)
        article_mentions = list(
            iter_mentions(text, pdf_path, article_id, page_starts, title, article_kind, contaminants)
        )
        mentions.extend(article_mentions)
        pdf_diagnostics.append(
            {
                "article_id": article_id,
                "pdf_path": str(pdf_path),
                "title": title,
                "article_kind": article_kind,
                "pages": len(page_texts),
                "word_count_estimate": word_count,
                "mentions_found": len(article_mentions),
                "text_extractable": "No" if word_count < 50 else "Si",
            }
        )

    mention_rows = [
        {
            "article_id": mention.article_id,
            "pdf_path": mention.pdf_path,
            "page": mention.page,
            "title": mention.title,
            "article_kind": mention.article_kind,
            "familia": mention.family,
            "contaminante": mention.contaminant,
            "matched_text": mention.matched_text,
            "section": mention.section,
            "score_mencion": mention_score(mention),
            "exposure_cue": "Si" if mention.exposure_cue else "No",
            "dose_cue": "Si" if mention.dose_cue else "No",
            "background_cue": "Si" if mention.background_cue else "No",
            "generic_term": "Si" if mention.generic_term else "No",
            "context": mention.context,
        }
        for mention in mentions
    ]

    contaminant_rows, article_rows, category_rows = summarize_mentions(mentions, args.max_contexts)

    write_csv(output_dir / "diagnostico_pdfs.csv", pdf_diagnostics)
    write_csv(output_dir / "menciones_auditables.csv", mention_rows)
    write_csv(output_dir / "resumen_contaminantes_por_articulo.csv", contaminant_rows)
    write_csv(output_dir / "resumen_articulos.csv", article_rows)
    write_csv(output_dir / "resumen_categorias.csv", category_rows)

    worked_counter = Counter()
    for row in contaminant_rows:
        if row["clasificacion"] == "trabajado_como_exposicion_o_ensayo":
            worked_counter[str(row["contaminante"])] += 1
    svg_bar_chart(
        "Contaminantes clasificados como trabajados",
        worked_counter.most_common(25),
        output_dir / "graficas" / "contaminantes_trabajados.svg",
    )

    section_counter = Counter(mention.section for mention in mentions)
    svg_bar_chart(
        "Menciones por seccion del articulo",
        section_counter.most_common(),
        output_dir / "graficas" / "menciones_por_seccion.svg",
    )

    svg_stacked_chart(
        "Familias por tipo de clasificacion",
        category_rows,
        output_dir / "graficas" / "familias_por_clasificacion.svg",
    )

    write_markdown_report(
        output_dir / "reporte_metodologico.md",
        len(pdf_paths),
        no_text,
        mentions,
        contaminant_rows,
        category_rows,
        args,
    )

    print(f"PDFs analizados: {len(pdf_paths)}")
    print(f"Menciones encontradas: {len(mentions)}")
    print(f"Pares articulo-contaminante: {len(contaminant_rows)}")
    print(f"PDFs sin texto extraible: {', '.join(no_text) if no_text else 'ninguno'}")
    print(f"Salidas: {output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
