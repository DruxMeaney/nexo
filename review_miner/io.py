from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader

try:
    import openpyxl
except Exception:  # pragma: no cover
    openpyxl = None

from .schema import Article


DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+\b", flags=re.IGNORECASE)
YEAR_RE = re.compile(r"\b(19[5-9]\d|20[0-3]\d)\b")


def natural_key(path: Path) -> tuple[str, int, str]:
    match = re.match(r"([A-Za-z]+)(\d+)$", path.stem)
    if match:
        return (match.group(1), int(match.group(2)), "")
    return (path.stem, 0, path.suffix)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def clean_pdf_text(text: str) -> str:
    """Light cleanup that preserves evidence text while reducing PDF extraction noise."""

    text = (text or "").replace("\x00", " ")
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf(path: Path) -> tuple[str, int, str]:
    reader = PdfReader(str(path), strict=False)
    metadata_title = ""
    try:
        metadata_title = normalize_space((reader.metadata or {}).get("/Title", "") or "")
    except Exception:
        metadata_title = ""
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    return clean_pdf_text("\n\n".join(parts)), len(reader.pages), metadata_title


def extract_text_file(path: Path) -> tuple[str, int, str]:
    return path.read_text(encoding="utf-8", errors="ignore"), 1, ""


def discover_input_files(input_dir: str | Path) -> list[Path]:
    root = Path(input_dir)
    files: list[Path] = []
    for suffix in ("*.pdf", "*.txt", "*.md"):
        files.extend(root.glob(suffix))
    return sorted(files, key=natural_key)


def read_metadata_sources(paths: str | None) -> list[dict[str, dict[str, str]]]:
    if not paths:
        return []
    sources = []
    for raw in paths.split(","):
        raw = raw.strip()
        if not raw:
            continue
        path = Path(raw)
        if not path.exists():
            continue
        if path.suffix.lower() in {".xlsx", ".xlsm"}:
            sources.append(_read_xlsx_metadata(path))
        elif path.suffix.lower() == ".csv":
            sources.append(_read_csv_metadata(path))
    return sources


def _normalize_headers(headers: Iterable[object]) -> list[str]:
    out = []
    seen = {}
    for index, value in enumerate(headers, start=1):
        header = str(value).strip() if value not in (None, "") else f"col{index}"
        if header in seen:
            seen[header] += 1
            header = f"{header}_{seen[header]}"
        else:
            seen[header] = 1
        out.append(header)
    return out


def _row_article_id(row: Iterable[object]) -> str:
    for value in list(row)[:4]:
        if value is None:
            continue
        candidate = str(value).strip()
        if re.fullmatch(r"[A-Za-z]+\d+", candidate):
            return candidate
    return ""


def _read_xlsx_metadata(path: Path) -> dict[str, dict[str, str]]:
    if openpyxl is None:
        return {}
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {}
    header_idx = 0
    for idx, row in enumerate(rows[:10]):
        values = [str(value).strip().lower() if value is not None else "" for value in row]
        if "doi" in values or "paper name" in values or "title" in values:
            header_idx = idx
            break
    headers = _normalize_headers(rows[header_idx])
    records: dict[str, dict[str, str]] = {}
    for row in rows[header_idx + 1 :]:
        if not any(value is not None for value in row):
            continue
        article_id = _row_article_id(row)
        if not article_id:
            continue
        records[article_id] = {
            headers[idx]: "" if idx >= len(row) or row[idx] is None else str(row[idx])
            for idx in range(len(headers))
        }
    return records


def _read_csv_metadata(path: Path) -> dict[str, dict[str, str]]:
    records: dict[str, dict[str, str]] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            article_id = ""
            for key in ("ID", "ID2", "article_id", "id"):
                if row.get(key):
                    article_id = str(row[key]).strip()
                    break
            if article_id:
                records[article_id] = {k: "" if v is None else str(v) for k, v in row.items()}
    return records


def _title_tokens(title: str) -> set[str]:
    stop = {
        "study",
        "article",
        "water",
        "disease",
        "effects",
        "effect",
        "exposure",
        "contaminants",
        "contaminantes",
        "between",
        "relation",
        "association",
        "neurodegenerative",
    }
    return {
        token.lower()
        for token in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñβ]+", title or "")
        if len(token) >= 5 and token.lower() not in stop
    }


def choose_metadata(article_id: str, text: str, sources: list[dict[str, dict[str, str]]]) -> dict[str, str]:
    candidates = [source[article_id] for source in sources if article_id in source]
    if not candidates:
        return {}
    if len(candidates) == 1:
        return candidates[0]
    haystack = text[:12000].lower()
    best = candidates[0]
    best_score = -1
    for candidate in candidates:
        title = candidate.get("Paper name") or candidate.get("Title") or candidate.get("title") or candidate.get("col3") or ""
        score = sum(1 for token in _title_tokens(title) if token in haystack)
        if score > best_score:
            best_score = score
            best = candidate
    return best


def guess_title(text: str, metadata_title: str, metadata: dict[str, str]) -> str:
    for key in ("Paper name", "Title", "title", "col3"):
        if normalize_space(metadata.get(key, "")):
            return normalize_space(metadata[key])
    if metadata_title and not metadata_title.lower().startswith(("microsoft", "elsevier", "springer")):
        return metadata_title[:260]

    bad = ("doi", "journal homepage", "www.", "copyright", "received", "accepted", "available online", "issn")
    for line in text.splitlines()[:90]:
        candidate = normalize_space(line)
        if len(candidate) < 12 or len(candidate) > 260:
            continue
        if any(fragment in candidate.lower() for fragment in bad):
            continue
        return candidate
    return ""


def guess_year(text: str, metadata: dict[str, str]) -> str:
    for key in ("Publication Date", "Year", "year", "publication_year"):
        raw = normalize_space(metadata.get(key, ""))
        match = YEAR_RE.search(raw)
        if match:
            return match.group(1)
    match = YEAR_RE.search(text[:4000])
    return match.group(1) if match else ""


def guess_doi(text: str, metadata: dict[str, str]) -> str:
    for key in ("DOI", "doi"):
        raw = normalize_space(metadata.get(key, ""))
        match = DOI_RE.search(raw)
        if match:
            return match.group(0).rstrip(".")
    match = DOI_RE.search(text[:10000])
    return match.group(0).rstrip(".") if match else ""


def load_articles(input_dir: str | Path, metadata_paths: str | None = None) -> list[Article]:
    metadata_sources = read_metadata_sources(metadata_paths)
    articles: list[Article] = []
    for path in discover_input_files(input_dir):
        if path.suffix.lower() == ".pdf":
            text, pages, metadata_title = extract_pdf(path)
        else:
            text, pages, metadata_title = extract_text_file(path)
        article_id = path.stem
        metadata = choose_metadata(article_id, text, metadata_sources)
        title = guess_title(text, metadata_title, metadata)
        word_count = len(re.findall(r"\b\w+\b", text))
        articles.append(
            Article(
                article_id=article_id,
                source_path=str(path),
                title=title,
                year=guess_year(text, metadata),
                doi=guess_doi(text, metadata),
                metadata_study_type=normalize_space(metadata.get("Study type", "")),
                text=text,
                pages=pages,
                word_count=word_count,
                text_extractable=word_count >= 50,
                metadata=metadata,
            )
        )
    return articles
