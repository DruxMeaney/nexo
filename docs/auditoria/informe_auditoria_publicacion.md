# NEXO — Publication-Readiness Audit

**Repository:** `/Users/drux/Documents/Drux/1_UNAM_FESI/RevisionContaminantes`
**Audit date:** 2026-07-31 · **Commit:** `03368a6` (clean tree)
**Method:** 6 independent analysis dimensions → adversarial refutation pass → second-opinion re-verification of all critical/high items. Every claim below was reproduced by execution (unit-level, end-to-end CLI, and against the author's real 79-PDF corpus), not by reading code. 6 candidate findings were refuted and removed.

---

## 1. VERDICT

**No. The tool is not publication-ready, and — more seriously — the results currently in `outputs/` are not publishable either.** This is not a polish problem. Four independent defects corrupt the numbers themselves on the author's own corpus: false section headers relabel bibliography and body text across **51 of 79 articles** (~15% of all corpus characters, 498 reference-list mentions given positive instead of negative weight); **485 of 936 published relation rows (51.8%)** carry an `evidence_text` that does not contain one of the two entities they claim to relate, including **37 of the 149 flagship `asociacion_fuerte`/`Alta` rows**; the manual-validation templates that the Methods section says are used to estimate precision are **not samples at all** but deterministic top-of-stratum slices (sample mean confidence_score 88 vs population 49), so any precision figure derived from them is biased upward by an unquantified amount; and the user-configurable 900-character relation window is silently capped at 699, so the Methods section documents a parameter the code does not use. Separately, the reproducibility path fails outright: the manuscript's own quickstart command exits with argparse code 2, and the only committed protocol folder has double-escaped regexes that match nothing, so an independent verifier following the paper today gets `Menciones extraidas: 0` and exit code 0 — a silent empty study. The engineering underneath is sound and the fixes are small (most are 1–5 lines), but the corpus must be re-mined and the manuscript's numbers regenerated afterward. Budget: roughly **2–3 days of fixes plus one full re-run plus re-annotation of the validation sample**, which is human work and should start first.

---

## 2. BLOCKERS

Ordered by impact on scientific correctness. Every one of these must be fixed before submission.

### B1 — False section headers relabel bibliography and body text across 51 of 79 articles
**`review_miner/sections.py:39`** (also the shipped `sections.json` header regexes)

Sections are assigned by "last marker at or before position" with no validation that a match is a real header — no line-length check, no isolation check, no monotonic IMRaD order, and `references` is not terminal. The shipped regex `methods?` matches bare singular "method"; `results?` matches sentence-initial "results". In two-column PDF-extracted text, line wraps put ordinary words at line starts constantly.

**Measured on the real corpus:** 51/79 articles have at least one span opened by a line >60 chars (i.e. a body sentence, not a header); **~14.9% of all corpus characters are mislabelled**. 16 articles have a non-references span opening *after* the references header, and **498 mentions physically inside reference lists receive weight +5/+6/+2 instead of −3**. Concrete cases from the shipped PDFs:
- `A6`: `"results showed that in flammation…"` opens `results[16808,28757)`, a second body line opens `results[28757,78560)` → **79% of the article labelled Results (w=5)**.
- `A2`: `"method yields crucial data for public health decision-makers…"` opens `methods[47023,51708)` (w=6, the maximum); a citation line `"results from the 2008-2013 Korean National Health and Nutrition Survey…"` opens `results[73619,108987)`, relabelling **35k characters of bibliography as Results**.
- `A13`: the journal name `"Methods Psychiatr Res 1993;3:l-28."` inside reference [20] opens a `methods` span → 1,879 chars of bibliography at +6 instead of −3, a **9-point swing per mention**.
- `D16`: the real DISCUSSION span is truncated at 47491 by `"results support the evidences…"`.

Because these mentions are no longer in `references`, the `sections_count["references"] == n_mentions` guard in `classify._assign_role` can never fire, so entities existing only in cited titles are promoted out of `ROLE_BIBLIOGRAPHIC` into informative roles.

**Minimal fix**, in priority order:
1. Make `references` terminal — once a references marker is seen, ignore all later markers. *(This alone removes all 153,851 mislabelled bibliography characters.)*
2. Require the matched header line to be short (≤ ~60 chars) and to end at a line break, rejecting matches embedded in running prose.
3. Tighten `methods?` so it does not match bare singular "method"; require the header token to be followed by end-of-line or a colon.
4. Optionally enforce non-decreasing IMRaD order.

---

### B2 — Half of all published relations quote evidence that does not contain one of the two entities
**`review_miner/relations.py:25-30`** (`_overlap_context`)

For non-same-sentence pairs the function returns `a.context if len(a.context) >= len(b.context) else b.context` — one mention's own ±`context_radius` (260 char) window. Once the two mentions are further apart than ~260 chars, that window *provably cannot contain the other entity*. All cue matching (association/strong/speculative/negation → the +4/+4/−2/−4 bonuses and the association label) runs on that one-sided text, and the string is exported as `evidence_text`.

**Measured on `outputs/review_miner/relations.csv` (936 rows, entities re-matched against their own lexicon regexes):** **485/936 rows (51.8%)** have evidence missing at least one entity — 322 missing the A entity, 163 missing B. **37 of the 149 `asociacion_fuerte` + `Alta` rows (24.8%)** — the flagship claims — rest on such evidence. Real examples: `metales pesados / neurodegeneracion general, asociacion_fuerte, Alta, 28` whose evidence is a **journal affiliation block**; `cadmio / Esclerosis lateral amiotrofica, asociacion_fuerte, Alta, 30` whose evidence is a **reference-list entry**; `A2 arsenico → Alzheimer, asociacion_fuerte/Alta/24` whose evidence is `"Reza-Zaldivar, E.E., Jacobo-Velazquez, D.A., 2023. Comprehensive review of nutraceuticals against cognitive decline…"` with no arsenic anywhere.

This directly contradicts the module docstring (`relations.py:3-7`, "ground the association in a single quotable fragment… every row carries the evidence string the reviewer can re-read"), `docs/arquitectura_pipeline_revision.md:11` and `:76`, and the in-app promise in `dictionaries.ts` ("Cada etiqueta queda ligada a un fragmento textual que se puede leer y verificar").

**Minimal fix:** build the span from the union of the two mentions —
```python
article.text[min(a.start, b.start) - pad : max(a.end, b.end) + pad]
```
— require that both `a.matched_text` and `b.matched_text` occur in it before emitting the relation, and run cue matching only on that joint span. Requires threading `article.text` into `_overlap_context` (it currently receives only the two `Mention`s). Cross-sentence pairs whose joint span exceeds a documented maximum should be dropped or flagged `cooccurrence_only`.

---

### B3 — The configurable `relation_distance` is silently capped at 699, so the Methods section documents a parameter the code does not use
**`review_miner/relations.py:28`**

`build_relations` gates candidates on the protocol's `relation_distance` (line 78), but `_overlap_context` then applies its own hardcoded `if abs(a.start - b.start) < 700` and returns `""`, and the caller drops empty evidence (lines 81-82). Effective window = `min(relation_distance, 699)`.

**Executed sweep** (cross-sentence pairs, d = 0..1599): `relation_distance=400` → keeps `[0,400]`; `700`, `900`, `1500` and `3000` all keep **exactly `[0,699]`**. The wizard slider goes to 3000 (`src/lib/protocol/defaults.ts:197`), `ProtocolRunner.tsx:312` prints the configured value into the methods narrative, and `methods_for_indexed_journal_vancouver.md:102` states *"within 900 characters of each other"* — a window the code never used.

**Not merely additive.** Re-running the full 79-article corpus with the cap removed at `relation_distance=900` kept the relation count at 23 but **flipped the label of 2 of 23 relations (8.7%)**: `A22 n_lead/n_alz` went `sin_evidencia_suficiente/Baja → asociacion_debil/Media`, and `A21 n_lead/n_alz` went `asociacion_debil/Media → asociacion_fuerte/Alta` (score 14 → 29).

**Minimal fix:** pass `relation_distance` into `_overlap_context` and compare against it, or delete the second test entirely since line 78 already enforces the bound. **Do this together with B2** — a correct joint-span builder removes the literal naturally, and their effects compound.

---

### B4 — The "stratified" manual-validation sample is a deterministic top-of-stratum slice, biasing every precision estimate upward
**`review_miner/publication_extensions.py:415-430`** (`stratified_sample`)

There is no `DataFrame.sample`, no `random_state`, no seed anywhere in the module — only `group.head(per_group)`. The caller has just sorted with a **descending** secondary key (`confidence_score` at line 482, `n_mentions` at line 455), so `head()` returns each stratum's highest-scoring rows and never its tail. The top-up fill at line 428 inherits the same ordering and cannot correct it.

**Executed** on 600 relations across 12 strata with `confidence_score ~ U[0,100]`, `sample_size=200`: sample min = 31 vs population min = 0; **sample mean 41.12 vs population mean 24.50 (+68%)**; **372 of 600 relations (62%) are structurally impossible to draw.** Per-stratum check: `head(per_group) == nlargest(per_group)` returned True for **12/12 strata**. The entity-role template behaves identically (+34.5% on `n_mentions`).

These are `manual_validation_entity_roles.csv` and `manual_validation_relations.csv` — the templates from which `methods_for_indexed_journal_vancouver.md:149-151` and `tutorials/04_validation_es.md` instruct a reviewer to estimate **precision and false-positive rates**. Estimating precision from the algorithm's own top-ranked outputs is an upward-biased estimator of the algorithm's accuracy, and it produces no error and no visibly wrong cell — it would pass unnoticed through peer review.

**Minimal fix:**
```python
piece = group.sample(n=min(per_group, len(group)), random_state=seed)
```
with `seed` an explicit protocol-stored parameter (`analysis.validationSeed`), applied to the top-up branch too; map the confidence labels to an ordered categorical before sorting; echo the seed and realized per-stratum counts into `publication_pipeline_summary.json`.

> **Schedule this one first.** It is the only blocker whose remediation cost is measured in reviewer hours (re-annotation) rather than CPU time.

---

### B5 — The only committed protocol has double-escaped regexes and silently produces an empty study
**`config/protocols/smoke-test-contaminantes-y-enfermedades/variables/variable_a.json`** and **`variable_b.json`**

The files contain four literal backslashes on disk (`"\\\\bplomo\\\\b"`), which `json.load` decodes to `\\bplomo\\b` — a literal backslash followed by `b`, not a word boundary. The patterns compile without error (syntactically valid), so `_compile_patterns` warns nothing.

**Executed A/B:** running the committed protocol over a corpus containing "plomo", "lead", "alzheimer" gives `Menciones extraidas: 0 / Resumenes: 0 / Relaciones: 0`, **EXIT 0**. Un-doubling the backslashes in a scratch copy and re-running the identical corpus gives `48 mentions / 8 summaries / 4 relations`. The cue files in the *same folder* are correctly single-escaped, and `src/lib/protocol/templates.ts:72` emits correct patterns — this is a hand-authored fixture typo, not a wizard bug. But it is the **only loadable protocol in the repository** (`config/protocols/protocolo_revision_drux.json` is a flat file that `load_protocol` cannot read at all), and `/api/protocol/list` shows it in the UI picker as *"Smoke test - Contaminantes y enfermedades"* by author *"NEXO QA"*.

**Minimal fix:** un-double the backslashes in the two variable files (or regenerate through the wizard), **and** — more important — make `review_miner/protocol.py` emit a loud stderr warning when a variable compiles zero usable patterns or when a compiled pattern contains an escaped literal backslash, and make the runner warn when a run ends with zero mentions. A silent empty study must never be mistaken for a valid negative result.

---

### B6 — The manuscript's own reproducibility command exits with code 2
**`pipeline_publicable/methodology/methods_for_indexed_journal_vancouver.md:165-174`** (mirrored at `pipeline_publicable/README.md:25-30`, `pipeline_publicable/tutorials/01_quickstart_es.md:30-35`, `docs/arquitectura_pipeline_revision.md:88-89`, `docs/visual_analytics_modelos.md:33`)

The documented invocation passes `--contaminants`/`--diseases` and omits the now-required `--protocol`. Executed verbatim: `run_pipeline_publicable.py: error: the following arguments are required: --protocol`, **EXIT=2**. `run_visual_analytics.py --input-dir … --k 4` fails identically. The commands also hardcode a machine-specific interpreter path under `/Users/drux/.cache/codex-runtimes/…` that exists on exactly one machine on earth.

The output inventory is stale too: `pipeline_publicable/README.md:51-56` lists six `contaminant_*`/`disease_*` CSVs, but `publication_extensions.py:207-241` loops `for entity_type in ("a","b")` and writes `a_article_term_*`/`b_article_term_*`. `docs/visual_analytics_modelos.md:42` names `bubble_contaminant_disease.svg`, but `visual_analytics.py:620` emits `bubble_{slug_a}_{slug_b}.svg`.

**Minimal fix:** rewrite every documented invocation to `--protocol config/protocols/<slug>`, drop the four removed flags, replace the interpreter path with `python`, and update the output inventories to the slot-based names. **Must be fixed jointly with B5** — pointing the corrected command at the only committed protocol would currently reproduce an empty study.

---

### B7 — The Word report's main results table has no entity columns
**`scripts/generate_review_report.py:51-52`**

```python
columns = ["contaminant", "disease", "association", "confidence", "section"]
available = [column for column in columns if column in relations.columns]
```
`export.relations_to_rows` (`export.py:124-129`) now writes `entity_a_label`/`entity_b_label`. The intersection silently drops both. **Executed end-to-end** against a current-schema `relations.csv`: the "Resultados principales" table came out as header `association | confidence | section`, row `asociacion_fuerte | Alta | results` — a published assertion of a strong, high-confidence association **naming neither variable**.

This is live code, not a legacy script: `src/lib/server/pipeline.ts:181` and `:299` invoke it as the "Reporte" step of every webapp analysis, and `reporte_revision_nexo.docx` is what the user downloads. (Every `relations.csv` already sitting in `outputs/` still carries the pre-Phase-5 `contaminant,disease` header, which is why this was never noticed locally.)

**Minimal fix:** `columns = ["entity_a_label", "entity_b_label", "association", "confidence", "section", "evidence_text"]`; read display names from `review_miner_results.json`'s `protocol` block for the headers; **raise** on a missing expected column instead of narrowing `available`.

> *Note: this appeared twice in the audit under different dimension names (`word-report-drops-relation-entities` / `word-report-lost-entity-columns`). It is one bug, one fix.*

---

### B8 — Bibliography mentions score net-positive and promote entities to the top role
**`review_miner/classify.py:104-118`** (`mention_score`)

Cue bonuses (+4 exposure, +5 dose, +2 association) are added on top of `section_weight` with no section-dependent damping. The `references` weight is −3, **smaller in magnitude than a single dose or exposure cue**, so a reference-list mention scores +2, +1, or up to +8. Reference lists are dense with cited titles containing "dose", "exposure", "associated". The `ROLE_BIBLIOGRAPHIC` guard only fires when *every* mention is in references, so one central mention lets arbitrary bibliography noise drive the score past the ≥16 primary-focus threshold.

**Measured on the author's 14,739 real mentions:** of 3,821 references mentions, **2,164 (56.6%) carry a strictly positive score** (61.7% fire the exposure cue, 31.4% association); per-mention scores span −4..+8. Aggregated: **295 of 825 (article, entity) summaries** gain net score from bibliography; **17 entities are currently over-ranked** vs a references-excluded rescoring, and **10 are promoted to `role_primary_focus` solely by reference mentions**. Published instance: `A21 / neurodegeneration_general` has sections `{title:1, discussion:1, references:4}` and `confidence_score=17` in the shipped `entity_summaries.csv` — references contributed **+8 of that 17**; without them the score is 9, below the ≥16 threshold.

**Minimal fix (preferred):** exclude `references` mentions from the aggregate score and from `direct_cues`/`association_cues` in `summarize_entity`, retaining them only for the bibliographic-only test and the `n_mentions` display. *(Alternative: clamp `if section_weight < 0: return max(0, section_weight + bonuses)` — but this also removes the −3 drag and moves 79 of 825 roles, mostly upward.)*

---

### B9 — Publication export crashes and discards all 14 tables when a corpus yields no A–B co-occurrence
**`review_miner/publication_extensions.py:265` and `:348`**

Both builders end with `pd.DataFrame(rows).sort_values([...])`. On an empty row list pandas constructs a **zero-column** frame and `sort_values` raises `KeyError`. Neither call site guards it, and `export_publication_extensions` builds *all* tables into `tables` before the write loop at line 533 — so one empty builder aborts the whole export.

**Reproduced end-to-end with the real CLI:** a corpus mentioning `plomo`/`lead` but no Variable-B term dies with `KeyError: 'weighted_evidence_score'`; a zero-mention corpus dies with `KeyError: 'entity_type'`. In both cases `ls <output>/publication_pipeline/` is **empty (total 0)** while `articles.csv`, `mentions.csv`, `entity_summaries.csv`, `relations.csv`, the XLSX/JSON and `figures/` were all written normally. A user loses all 14 publication tables because one variable happened not to match — which is exactly the situation during an exploratory or pilot run, i.e. what a reviewer does.

**Minimal fix:** `df = pd.DataFrame(rows, columns=COLS); return df.sort_values(...) if not df.empty else df` at both sites. Separately, move the CSV write loop so a late builder failure cannot discard earlier successes.

---

### B10 — TF-IDF / term-count matrices key columns by `label_es`, silently merging distinct entities
**`review_miner/publication_extensions.py:229-230`**

The accumulator is correctly keyed by the unique `term_id`, but the per-article row dicts use `column = f"{entity_type}::{label_es}"`. Two entities sharing a `label_es` overwrite each other inside the same row. Worse, `validation.ts:73-81` and `protocol.py:372` both accept a term when `labelEs OR labelEn` is non-empty, so an **English-only protocol yields `label_es == ""` for every entity and the entire A and B matrices collapse into two columns named `a::` and `b::`.**

**Executed:** entities `pb_metal`(Plomo)×1 in A1 + ×1 in A2 and `pb_organic`(Plomo)×2 in A1, plus two blank-label entities, produced `a::Plomo = [A1=2, A2=0]` and `a:: = [A1=0, A2=1]` — **3 of 6 mentions destroyed**, and A2 reported as containing zero Plomo when it contains one. `entity_frequency_summary.csv`, keyed by `entity_id`, simultaneously reports the correct 2/2/1/1 — **two publication tables in the same folder contradicting each other.** All three matrices (counts, per_10k, tfidf) share the same `column` variable and are corrupted identically.

**Impact on this author's existing run: none, by luck.** `protocolo_revision_drux.json` has 39 contaminants and 8 diseases with 39 and 8 *distinct, non-empty* `label_es`, and the shipped matrices have exactly 39 and 8 term columns. But the guarantee is accidental.

**Minimal fix:** `column = term_id` (already unique, already the accumulator key); carry `label_es` in a companion mapping table or a second header row. Add `assert len(set(columns)) == len(terms)` before DataFrame construction.

---

### B11 — `category_association_heatmap.svg` is written empty for the shipped flagship template
**`review_miner/visual_analytics.py:641-650`** (root cause: `review_miner/protocol.py:333,379`)

`_flatten_taxonomy` is seeded with `parent_label=""` and assigns `category=parent_label`, so every root-level term — which is *by definition* every term of a `mode: "flat"` variable (`format.ts:236`) — gets `category == ""`. Round-tripped through CSV, `""` becomes NaN. `pd.pivot_table(..., index="entity_a_category", columns="entity_b_category")` drops NaN group keys by default, so **all rows are discarded and the pivot is (0,0)**. `svg_heatmap` takes the `matrix.empty` early return and writes a **46-byte stub**: `<svg xmlns='http://www.w3.org/2000/svg'></svg>`. No exception, no warning, and the file is still listed in `visual_analytics_summary.json` as though generated.

**The shipped flagship template `buildContaminantsDiseases()` declares `variableB` with `mode: "flat"`** (`templates.ts:87`), as does one other template, and `WizardStep2Variables.tsx:149` exposes flat mode as a first-class radio option. **Executed:** a 4-article/4-relation corpus (all `asociacion_fuerte`/`Alta`) produced a 46-byte heatmap while `association_by_section.svg` came out at 764 bytes from the same rows. Collateral: the k-means matrix carried a single collapsed column `b_category::nan` instead of one column per disease category, degrading the clustering.

**Minimal fix:** read the three CSVs at `visual_analytics.py:581-583` with `keep_default_na=False`, substitute an explicit sentinel (`"(sin categoria)"`), and pass `dropna=False` to both `pivot_table` calls (`:630`, `:641`). Additionally make `_flatten_taxonomy` fall back to the variable's `display_name` for root-level terms.

---

### B12 — Invalid regexes pass all TypeScript validation and silently delete terms from the Python lexicon
**`src/lib/protocol/validation.ts:73-84`** + **`review_miner/protocol.py:218-223, 371-373`**

`grep -rn "new RegExp" src/` returns **nothing** — no layer of the app ever compiles a user pattern. `hasIncompleteTerm` checks only `patterns.length > 0`. On the Python side `_compile_patterns` swallows `re.error` and `continue`s, and `_flatten_taxonomy` then drops any term whose patterns all failed.

**Executed both directions:** a term `ela_bad` with pattern `\bELA(\b` (unclosed group — an easy typo) → `validateStep('taxonomy', draft)` returns `{"errors":[],"isValid":true}`, `maxReachableStep` returns 6, the protocol saves clean; `load_protocol` on that exact folder declared `['alzheimer','parkinson','ela_bad','demencia']` and loaded `['alzheimer','parkinson','demencia']` — **`ela_bad` silently gone**, contributing zero mentions, zero summaries, zero relations, absent from every CSV and figure as if the disease had never been searched for. The **partial** case is worse: `demencia` with `['\bdemencia\b','dementia(unclosed']` loads with only the Spanish pattern kept — every English mention of dementia in the corpus is missed while the term appears complete in every output.

The comment at `protocol.py:221` ("Skip invalid patterns silently — the wizard already warns the user") is factually untrue.

**Impact on this author's existing run: none** — all 47 real lexicon entities compile. Prospective risk only.

**Minimal fix:** add `try { new RegExp(p, "i") } catch { return true }` per pattern in `hasIncompleteTerm` with a distinct error id; **and** — because JS and Python regex dialects diverge — have `_compile_patterns` record skipped patterns on the returned `Protocol` and print/write them into the run report instead of `continue`-ing. Apply in both `review_miner/` and `pipeline_publicable/review_miner/` (verified byte-identical, same patch).

---

### B13 — Missing `sections.json` silently collapses the whole corpus into section `title` (weight 5)
**`review_miner/protocol.py:413-416`**

`_load_sections` returns a bare `SectionConfig()` whenever `sections.json` is absent, unparseable, or not a JSON object. `SectionConfig.headers` defaults to an **empty dict** (line 141) while `weights` retains the full baseline profile. `detect_sections` then finds no markers and emits one span `SectionSpan('title', 0, len(text))` — every mention in the document, including the entire reference list, is labelled `title` at weight 5. The references penalty (−3) becomes +5, an 8-point swing per bibliographic mention, and `role_bibliographic_only` becomes unreachable.

**Executed** on the same 2-article corpus with and without `sections.json`: `a/n_lead` went from `sections={'title':1,'abstract':2,'introduction':1,'methods':1,'results':1,'discussion':1,'references':1}, score=107` to `sections={'title':8}, score=123 (+15%)`; `b/n_alz` from 77 to 93 (+21%). No exception, no warning, all 42 output files written as if valid. The same path is taken by any hand-written or older `sections.json` carrying `weights` but no `headers` block.

**Minimal fix:** fall back to the built-in `DEFAULT_SECTION_HEADERS` (compiled) instead of an empty dict, and make `load_protocol` raise — or at minimum emit a warning recorded in `review_miner_results.json` — when `sections.json` is missing/unreadable or yields zero compiled header patterns. A run whose IMRaD detection is inert must not be silently exportable as a scientific result.

---

### B14 — No LICENSE, no CITATION.cff, `"private": true`
**`package.json:4`** · repository root

`ls LICENSE* LICENCE* COPYING* CITATION*` → no matches. `git ls-files | grep -iE 'licen|citation|contribut|code_of'` → empty across 201 tracked files. README.md (156 lines) has no "License" or "How to cite" section.

Without an explicit licence, default copyright applies: **no reader of the paper may legally copy, modify, redistribute or build on the software**, which contradicts the manuscript's premise and violates the software-availability policy of essentially every indexed journal. There is also no machine-readable citation metadata (CITATION.cff / codemeta.json / Zenodo DOI) and no third-party notices, though every dependency (Next.js/React MIT, lucide-react ISC, papaparse MIT, docx MIT; pypdf/pandas/numpy BSD-3, openpyxl MIT, python-docx MIT) is permissive and mutually compatible.

**Minimal fix:** add a `LICENSE` (MIT / Apache-2.0 / BSD-3 all work), a `CITATION.cff` with authors/ORCID/version/DOI, a "License" + "How to cite" section in README, and mint a Zenodo DOI for the exact commit reported in the manuscript.

---

### B15 — The author's private machine paths are committed in the published docs and scripts
**`pipeline_publicable/tutorials/01_quickstart_es.md:29`** · **`scripts/build_analitica_contaminantes_guide.py:10`** · **`config/protocols/protocolo_revision_drux.json:7-11`** · **`docs/guia_detallada_analitica_contaminantes.md`** (16 image links)

Thirty occurrences of `/Users/drux/…` are committed. Four are the *documented invocation command*, naming a Python interpreter inside the author's private tool cache. `scripts/build_analitica_contaminantes_guide.py:10` hardcodes `ROOT = Path("/Users/drux/Documents/Drux/1_UNAM_FESI/RevisionContaminantes")` at module level. `protocolo_revision_drux.json` embeds the author's corpus directory and two private `.xlsx` metadata filenames. `docs/guia_detallada_analitica_contaminantes.md` has 16 markdown image links to gitignored PNGs under `/Users/drux/…` that render as **broken images for every reader**.

This is simultaneously a reproducibility failure and a personal-information leak (home directory layout, private filenames).

**Minimal fix:** replace every interpreter path with plain `python3`/`.venv/bin/python`; turn the hardcoded `ROOT` into an argparse `--root` defaulting to `Path(__file__).resolve().parents[1]`; delete or regenerate `protocolo_revision_drux.json` with relative paths; commit the referenced PNGs under a non-ignored `docs/assets/` or drop the links. Add a CI grep that fails on any `/Users/` or `/home/` literal in tracked source and docs.

---

## 3. SHOULD-FIX

Real defects that change published figures, degrade artefacts, or damage credibility, but do not invalidate the core numeric results.

| # | Finding | Location | Evidence | Fix |
|---|---|---|---|---|
| S1 | **Variable-A and Variable-B frequency charts use different inclusion criteria** — the two figures are rendered side by side with parallel titles but count over different populations. A keeps 4 of 7 roles, B keeps 6 of 7. | `visualize.py:125` vs `:135` | On the real corpus: A rule keeps 271/517 (52.4%), B rule keeps 242/308 (78.6%); applying A's rule to B keeps only 186 (60.4%). The 14 review articles contribute 129 A-summaries **erased** from `frecuencia_<A>.svg` and 56 B-summaries **kept** in `frecuencia_<B>.svg`. A reader concludes Variable A is absent from the review literature — an artefact of the filter. | Use one predicate on both lines; state the criterion in the figure subtitle; correct the wrong comment at lines 28-31. |
| S2 | **All figure captions and the Word report's Methods prose hardcode "contaminante/enfermedad"**, and protocol-slugged figure names miss the frozen caption keys entirely. | `generate_review_report.py:13-26,126` · `src/lib/server/results.ts:15-35` | An "Antidepresivos / Eventos adversos" run captions `association_network.svg` as *"Red exploratoria de relaciones contaminante-enfermedad"* and gets *"Figura generada por el pipeline"* for its three slugged figures. Even the flagship protocol loses two captions (`frecuencia_enfermedades_neurodegenerativas`, `bubble_contaminantes_enfermedades_neurodegenerativas` match no key). The report **body** at `:126` states every study used *"lexicos controlados de contaminantes y enfermedades"*. | Add `--protocol` to the report generator (`visual_analytics.main` already loads one), template captions from `variable_a.display_name`/`variable_b.display_name`, and match frequency/bubble captions on the stable prefixes `frecuencia_`/`bubble_`. Mirror in `results.ts`. |
| S3 | **The flagship template ships bare 2-letter element symbols under forced `re.IGNORECASE`** — `\bpb\b`, `\bcd\b`, `\bhg\b`, `\bela\b`, all with `generic: false` so the −1 penalty never applies. | `templates.ts:72-75,44` · `protocol.py:219` | On a realistic biomedical sentence: `\bcd\b` → `['CD','CD']` (circular dichroism, Crohn's disease), `\bpb\b` → `['PB','pb']` (phosphate buffer, base pairs), `\bhg\b` → `['HG']`, `\bela\b` → `['Ela']`. A methods section with "CD spectra" and "PB buffer" contributes **methods-weighted (w=6)** cadmium and lead mentions. | Stop forcing IGNORECASE (let authors write `(?i)` or case-sensitive `\bPb\b`), or remove the bare symbol patterns from the shipped template, or mark those terms `generic: true`. Document the ambiguity in the manuscript's lexicon table. |
| S4 | **The wizard lets a user reach Summary and SAVE a protocol that fails earlier-step validation** (empty name, zero terms). `canGoNext` consults only the current step; `validateCues`/`validateSections` return `[]` unconditionally; `maxAllowed = reachable + 1` permits jumping one step past the invalid one; `save-folder/route.ts:48` validates nothing. | `WizardShell.tsx:59,71` · `validation.ts:86-96,163-167` | Executed via the repo's own compiled TS: delete every Variable-B term → `maxReachableStep`=2, `maxAllowed`=3, the `cues` chip is unlocked, Next×3 reaches Summary with `taxonomy.b_needs_terms` outstanding. `slugifyName("")` returns a non-empty timestamp slug so Save fires. `draftToFolder` writes `variable_b.json` with `"taxonomy": []` → `lexicon_b = []` → **zero A↔B relations, no error at any layer.** | `const canGoNext = !isLast && maxReachableStep(draft, WIZARD_STEPS) >= stepIndex + 1;` and drop the `+ 1` from `maxAllowed`. Mirror server-side in `save-folder/route.ts`. |
| S5 | **`/api/protocol/save`, `/api/protocol/load`, `/api/lexicon/save`, `/api/lexicon/load` read and write any absolute path on disk** with no `assertProjectFile`, no `assertLocalProcessingAllowed`, and no CSRF/Origin check. | `lexicon/save/route.ts:21-23` and 3 siblings (+ the `/api/protocols/*` re-exports) | Live against `next dev`: a `Content-Type: text/plain`, `Origin: https://evil.example` POST created a directory tree and a file **outside PROJECT_ROOT** (HTTP 200), and `/api/protocol/load` returned the parsed contents of a file outside the project (HTTP 200). The control `/api/files/view` correctly 400s on the same path, proving the guard exists and these four simply never call it. Read is limited to JSON-parseable files; the write primitive is unrestricted. `next dev` binds 0.0.0.0. | Add `assertProjectFile(filePath)` + `assertLocalProcessingAllowed()` to all four handlers (four two-line edits mirroring `/api/files/*`), plus a shared same-site Origin guard on every mutating route. |
| S6 | **`page_for_position` never sees a form feed for PDFs**, so every reported `p.N` is a proportional guess. `extract_pdf` discards the per-page `parts` list it already has. | `text.py:53-57` · `io.py:56` | 76 of 79 corpus PDFs contain no form feed. Rebuilding with true page boundaries: **6,047 of 15,082 sampled offsets (40.1%) get the wrong page**, mean abs error 0.51 pages, max 9. Worst: A2 84% wrong, A4 82% (57 pages), C3 80% (49 pages). The number is printed to reviewers as authoritative provenance in `classify._evidence_text`. | Join pages with `\f` in `extract_pdf` (and preserve `\f` in `clean_pdf_text`), or return the cumulative per-page offsets on the `Article`. If exact pages cannot be recovered, render `p.~N` and document it as an estimate. |
| S7 | **`extract_mentions` double-counts one textual occurrence when two patterns of the same entity overlap.** Dedup key is `(entity_id, start, end)`. | `extract.py:43` | Shipped lexicons contain exactly this shape (`dementia` + `vascular dementia`; `cognitive impairment` + `mild cognitive impairment`; `arsenic` + `inorganic arsenic`). On the real corpus: **~60 of 14,741 mentions (0.4%)** across 20 entity-article pairs; worst `D13/uranium` +27%, `A1/nanoplastics` +21%, `A3/dementia` +44%. Corpus-level rankings and IDF are not materially altered. *(Note: `build_relations` buckets by entity pair and emits one row via `max()`, so duplicates produce **zero** duplicate relation rows — only the aggregate `confidence_score` inflates.)* | Sort matches per entity by `(start, -length)` and greedily drop any span intersecting an already-accepted span for the same `entity_id` (longest-match-wins). |
| S8 | **Every baseline frequency figure silently drops entities beyond the 35th** and truncates labels at 52 characters, with no note in the figure or caption. | `visualize.py:42,57` | The project's own Variable-A lexicon declares **39 entities**; `_svg_bar` renders exactly 35 bars and drops the 4 least-frequent with no trace — precisely the long tail a systematic review must report. A reader concludes those four were never detected. | Render all entities (SVG height is already computed from `len(items)`), or stamp *"mostrando 35 de 39 entidades detectadas"* into the figure and into `FIGURE_DESCRIPTIONS`/`DESCRIPTIONS`. Same for the 52-char clipping. |
| S9 | **A missing cue file diverges between layers**: the wizard silently restores the full default list; Python runs with **zero** cues for that family. Round trip is destructive. | `folder.ts:185-191,232-233` · `protocol.py:400-406` | Deleting `cues/negation.json` and loading the same folder with both loaders: TS returns 2 negation patterns with `warnings=[]`, Python returns 0. With zero negation cues, *"lead was NOT associated with Alzheimer's"* loses the `sin_evidencia_suficiente` label and the −4 penalty; if it also matches an association cue it becomes `asociacion_debil` with a **+8 net swing** — a published null result exported as positive evidence. Loading into the wizard and pressing Save overwrites the author's deliberate configuration with defaults. | Push the key into `warnings` when a cue file is absent/unparseable, render those warnings on the load screen, and make the two layers agree (either `base.cues[family] = []` in TS, or make `_load_cues` report a missing family). |
| S10 | **`_o_a()` ignores plural agreement**, so all 6 shipped template names produce ungrammatical CSV/XLSX headers; `visualize.py` hardcodes masculine for slot A and feminine for slot B. | `export.py:222-233` · `visualize.py:128,138` | `Contaminantes detectado`, `Enfermedades neurodegenerativas asociado`, `Antidepresivos detectado`, `Eventos adversos asociado`, `Especies invasoras detectado`, `Ecosistemas asociado` — **6/6 wrong in number, 3 also in gender**. Figure titles invert both agreements in a single run: *"Frecuencia de especies invasoras detectados"* + *"Frecuencia de ecosistemas detectadas"*. Three docstrings advertise output the code cannot emit. | `stem = word.rstrip('s'); suffix = 'a' if stem.endswith(('a','e')) else 'o'; plural = 's' if word.endswith('s') else ''`. Import the single helper into `visualize.py` so there is one agreement implementation. Correct the three docstrings. |
| S11 | **`_weight_relation` multiplies two non-independent quantities**, so the declared 3:2:1 association weighting is realized as 9:3.89:1. | `visual_analytics.py:131` · `relations.py:33-38` | Confidence is *derived from* association: `mencion_especulativa` can never exceed `Baja` (structurally pinned at 1.0). On the shipped 936-relation corpus: `fuerte→Alta` 149/149 (100%), `especulativa→Baja` 106/106 (100%), `debil→Media` 313/331 (94.6%). Realized mean weights **9.000 / 3.891 / 1.000** — a strong association is rendered **2.31× larger** than a weak one where the weight table says 1.50×. The formula *is* published in `docs/guia_detallada_analitica_contaminantes.md:288`; what is undisclosed is the deterministic coupling, which the same doc misframes as two dimensions. | Use `ASSOCIATION_WEIGHT` alone as the edge weight and show confidence as a separate visual channel; or make `_relation_confidence` independent of `association`. State the resulting scale in `visual_analytics_summary.json` and in Methods. |
| S12 | **The bubble matrix's colour axis is labelled "asociación promedio / fuerza promedio" but plots a 1–9 product**; the thresholds 7 and 4 are documented nowhere. | `visual_analytics.py:370,391-393,497-514` | `avg_strength` is the mean of the same `weighted_score` that is summed — range 1..9 — while the caption names the 1–3 `ASSOCIATION_WEIGHT` scale. A tooltip reading `fuerza promedio=9.0` is unreadable on that scale. Real distribution: 172 pairs, min 1.0, max 9.0, mean 4.607; 20 blue / 113 amber / 39 grey. *(The claimed weak-outranks-strong inversion does not occur in 936 relations — 3.0 is unreachable by construction.)* | Rename the column `avg_weighted_score`; caption it *"peso promedio (asociación × confianza, escala 1-9)"*; print the thresholds into `visual_analytics_summary.json`. |
| S13 | **Relation `section` is always the A-side mention's section** — `section = a.section if a.section == b.section else a.section` is a tautology left over from a refactor. | `relations.py:83` | Identical evidence text, identical cues, identical `confidence_score`: `A=results/B=discussion` → `section=results`, `asociacion_fuerte`, `Alta`; `A=discussion/B=results` → `section=discussion`, `asociacion_debil`, `Media`. **Two labs analysing the same corpus with the variables entered in opposite order publish different association strengths.** Contradicts the module docstring's claim that A/B are interchangeable slots. | Derive the section from the evidence span actually quoted, or take the more central of the two via an explicit `SECTION_RANK`; export both `entity_a_section` and `entity_b_section`. Delete the dead `or "result" in section` clause (inert for all 9 reachable section ids). |
| S14 | **`build_feature_matrix` crashes with `KeyError` when article ids are all-numeric.** `rows` is keyed by raw pandas dtype (int64), every lookup uses `str(...)`. | `visual_analytics.py:151-152,183` | `article_id = path.stem` (`io.py:244`), so naming PDFs `1.pdf, 2.pdf …` — an ordinary convention — triggers `KeyError: '1'` and aborts the entire visual-analytics stage. Loud and deterministic, not silent. | `articles["article_id"] = articles["article_id"].astype(str)` (and likewise for summaries/relations) before `build_feature_matrix`; switch `rows` to `defaultdict(Counter)`. |
| S15 | **Empty `relations.csv`/`entity_summaries.csv`/`mentions.csv` are written with no header row**, so `run_visual_analytics` raises `EmptyDataError`. | `export.py:260,268-269` → `visual_analytics.py:582-583` | `pd.DataFrame([])` has zero columns; `to_csv` emits `b'\n'`. Reproduced end-to-end: `pandas.errors.EmptyDataError: No columns to parse from file`. A headered zero-row file works fine, so the bug is purely in how export writes the empty case. *(Currently masked in the default path because B9 aborts earlier.)* | `pd.DataFrame(rows, columns=COLS)` in `export.py`. Also guard `svg_kmeans_cluster_map:267` — `int(cluster_df[...].max())` raises `ValueError` on an empty frame. |
| S16 | **`/analizador` and `POST /api/pipeline/run` spawn the CLI with flags deleted in Phase 5 and no `--protocol`.** 100% failure rate. | `src/lib/server/pipeline.ts:151-173` | Live over HTTP: job queued → running → **failed**, `"Pipeline termino con codigo 2."`, log `run_pipeline_publicable.py: error: the following arguments are required: --protocol`, output dir empty. The page is unlinked from all nav but is still routed and is still advertised at `README.md:68`. The same page also carries ~30 hardcoded Spanish strings and pre-Phase-5 `INTERNAL_SECTIONS` chips that do not match the pipeline's actual section ids. | **Delete** `src/app/analizador/`, `AnalyzerClient.tsx`, `/api/pipeline/run/route.ts` and `startPipeline()`/`executePipeline()`; also delete `/api/protocol/{load,save}` (their only caller) and the orphan `config/protocols/protocolo_revision_drux.json`. Repoint README at `/comenzar → /protocolo/nuevo → /ejecutar`. |
| S17 | **matplotlib is imported at module level by two shipped scripts but is commented out of the requirements file** the README tells users to install. | `requirements_review_miner.txt:8` | In the project's own `.venv` (built from the declared requirements): `ModuleNotFoundError: No module named 'matplotlib'` for both `generar_graficos_menciones.py` and `generar_diagrama_algoritmo_detallado.py`. The figures those scripts produce cannot be regenerated by a reviewer. | Uncomment and pin `matplotlib>=3.8` in both requirements files, or remove the two scripts from the published bundle. *(`generar_graficos_menciones.py` is separately orphaned — zero references repo-wide — and also filters on the removed `entity_type=='contaminant'`, so deletion is the cleaner option.)* |
| S18 | **Python dependencies are open lower bounds with no lockfile, and there are zero automated tests.** | `requirements_review_miner.txt:1-5` | Declared floors `pandas>=2.0`, `numpy>=1.24`; the working environment resolves to **pandas 3.0.5, numpy 2.5.1** — one and two major versions above. `stratified_sample`'s `groupby(dropna=False)` and `build_feature_matrix`'s dtype indexing are both pandas-major-version-sensitive. `git ls-files` (201 files) matches no `test_*.py`, `*.spec.ts` or `.github/workflows/*`; `package.json` has no `test` script. The Node side *is* pinned by `package-lock.json`, so the two halves have inconsistent guarantees. | Ship a fully pinned `requirements-lock.txt` from the environment that produced the manuscript's numbers, record the exact Python version, and add a minimal regression suite that runs the pipeline over a tiny committed fixture corpus and asserts the exported scores, roles, association labels and column names. |
| S19 | **The wizard's outputDir is unvalidated but every read-back path requires it to be inside the project** — a successful run becomes permanently unreadable. | `pipeline.ts:238` vs `results.ts:106-107` | Verified live: after a run wrote to a folder outside the project, `GET /api/results?outputDir=<outside>` → 400, `/api/files/download` → 400. The UI offers both a free-text field and a native folder picker with no constraint, and `ProtocolRunner.tsx:385/393/402` builds exactly those URLs. The analysis exists on disk but the app can never display or serve it. | Pick one policy: validate `outputDir` at job creation, or authorize any path belonging to a known job (`job.outputDir` prefix match). |
| S20 | **Run-status polling stops permanently after a single failed poll.** | `ProtocolRunner.tsx:78-93` | The effect reschedules only through `setJob(next)`; on `!response.ok` it returns and on a thrown fetch it swallows, neither arming a new timer — and the dependency array is `[job]`, which did not change. Reachable in normal use: jobs live only in a process-global `Map` with no persistence and no eviction, so a dev-server restart makes `/api/pipeline/status` 404 forever. The Python pipeline keeps running and writes its outputs; the UI stays on "En proceso" with no error and no results link. | Reschedule in a `finally` block (or use `setInterval` cleared on terminal status); surface a 404 as `status='failed'` with a "la ejecución se perdió al reiniciar el servidor" message; persist job state to JSON under the run's outputDir. |
| S21 | **The only two entries in `config/protocols/` are a QA fixture and a dead file.** | `config/protocols/` | `smoke-test-contaminantes-y-enfermedades/` self-identifies as `author: "NEXO QA"`, `description: "Audit run"`, with a single term per variable — and its regexes are broken (B5). `protocolo_revision_drux.json` is a flat pre-Phase-5 file that `load_protocol` raises `FileNotFoundError` on. A reviewer opening `/ejecutar` sees "Smoke test" by "NEXO QA" as the sole selectable protocol. | Delete both; commit **one real, curated example protocol folder** — ideally the exact protocol used for the manuscript's case study — exported by the wizard (so escaping is correct) with no absolute paths. Add `config/protocols/smoke-test-*` to `.gitignore`. |

---

## 4. NICE-TO-HAVE

Genuine but low-impact; none affects a published number.

- **`detect_sections` is non-deterministic under a tied offset** (`sections.py:33` sorts a `set` on a non-total key). Reproduced: 40 fresh interpreters gave 21× `abstract` / 19× `title`. **But: zero of the 79 corpus articles have a tied marker**, so the shipped pipeline *is* byte-reproducible today. A tie requires the cleaned text to begin exactly at a header line, which real PDFs never do. Fix is one line — add the name to the sort key with a documented precedence — and worth doing for the reproducibility claim.
- **`INFORMATIVE_SECTIONS` omits `introduction`** (`sections.py:20`), so an entity mentioned only in the Introduction becomes `role_unclear` instead of `role_intro_discussion_only`, and a low-score Results-only entity is labelled "intro/discussion only". Real data: 28 introduction-only entity-article rows (16 labelled `no_queda_claro`) and 14 rows labelled `solo_mencion_introduccion_discusion` with no intro or discussion mention. **No numeric impact** — `ROLE_WEIGHT` gives both roles 0.5.
- **`sentence_at()` assumes 1-char sentence separators** (`text.py:31`), drifting on blank-line paragraph breaks. Measured: **30 of 14,741 mentions (0.20%)** return a sentence not containing the matched text; all sampled cases are inside numeric reference lists. 2-line fix using `SENTENCE_BOUNDARY.finditer`.
- **De-hyphenation destroys required hyphens** (`io.py:37`). 6,528 hyphen-newline joins corpus-wide, of which **50 destroy a real compound** (case-control 15, population-based 9, long-term 6…). The alleged downstream chain is refuted: `detect_article_kind` tests markers against metadata only, the `human` cue uses `case[-\s]?control`, no lexicon pattern is vulnerable, and only 8 blank-line joins exist corpus-wide (2 of which are *correct*). Residual harm: ~50 mangled compounds in exported context strings.
- **`discover_input_files` globs only lowercase extensions** (`io.py:66`) — `A1.PDF` is silently dropped even on a case-insensitive volume. The recursion and metadata-join sub-claims are refuted (all 79 files found, 75/79 stems join; the 4 misses are genuinely absent from both workbooks). One-line fix.
- **Nested categories collapse to the immediate parent label** (`protocol.py:391-392`). `Metales > Organicos > Metilmercurio` and `Pesticidas > Organicos > Rotenona` both return `category='Organicos'`. `TaxonomyNodeRow.tsx:208-217` renders "add subcategory" at every depth with no cap. No shipped template nests deeper than one level.
- **`_parse_analysis` coerces an explicit `0` to the default** (`protocol.py:302`) via `... or default`. Reachable only by hand-editing; the wizard blocks 0 for all five params, and four of the five are invalid at 0 anyway. *(Note: the run metadata records the **effective** values, so no misreporting occurs.)*
- **`protocol.json`'s `manifest` block is written by TS and never read by Python**, and its cue keys are camelCase while the families are snake_case. `folder.ts:136`'s first spread is entirely shadowed by the second. Cosmetic.
- **`identity.corpusLanguage` and `metadata.mode` are parsed and never consulted.** Worse than stated: `dictionaries.ts:259` tells the user corpus language *"Ayuda al pipeline a priorizar patrones bilingues"* — a UI claim the pipeline does not implement. Either wire it up or reword the hint.
- **Empty k-means clusters keep a stale seed centroid** and are exported as real clusters (`visual_analytics.py:231-234,541`). Hit without hand-crafted duplicates on an ordinary 4-article corpus at default `k=4`: `kmeans_centroids.csv` had 4 rows, `cluster_profiles.csv` had 2, and the summary still reported `"k": 4`. Report `k_requested` and `k_effective`.
- **`PALETTE` has 9 colours; the wizard allows `kmeansK` up to 12** — clusters 9–11 reuse 0–2's fills. *(Not unreadable: each cluster has its own x column with a bold "Cluster N" label, so colour is redundant.)*
- **`row.get('label_es') or row.get('label_en')` is dead in a DataFrame context** — `bool(nan) is True`, so English-only protocols collapse to `a_label::nan`/`b_label::nan` in the two exported feature-matrix CSVs. Not in `KMEANS_FEATURE_PREFIXES`, so clustering is unaffected.
- **`section_weight_sensitivity.csv` scores against frozen profile constants**, not the run's live weights, and the static English `rationales` prose can flatly contradict the adjacent live number (`references | current_pipeline_weight=8 | "not treated as direct study evidence"`). Add an `active_configured_section_score` column.
- **`context_radius` and `relation_distance` appear in no output file**, and the protocol folder is never copied into the output directory. *(`kmeans_k` **is** in `visual_analytics_summary.json` and the live section weights **are** in `section_weight_rationale.csv`, contrary to the original finding.)*
- **The `algorithm_role` and `human_role` vocabularies are disjoint** (`publication_extensions.py:489` allows `exposure_main; secondary_variable; bibliographic_mention; unclear; not_detected`; the algorithm emits `role_primary_focus`, `role_probable_focus`, …). `tutorials/04_validation_es.md:81` asks the reviewer to compute "precisión por rol" from those two columns — agreement is 0 by construction. No crosswalk exists.
- **`systematic_review_table.csv` non-relation rows borrow the A-entity's own snippet** into "Evidencia textual" and hardcode "Baja" (`export.py:210-211`) where the no-B branch correctly uses `summary_a.confidence`. The cross-product shape itself is documented design and is cleanly partitioned by the `Extraccion o inferencia` column (1254 `extraccion_literal_sin_relacion_directa` vs 936 `inferencia_contextual_con_evidencia_textual`) — leave those cells blank, as "Seccion de evidencia" already is.
- **`assertProjectFile` resolves lexically, not physically** (`project.ts:42`) — a symlink under PROJECT_ROOT serves any file. Verified: 9,344 bytes of `/etc/passwd` through `/api/files/view`. Precondition is write access to the project on a single-user local app, so it grants no privilege the attacker lacks. One `fs.realpath` call.
- **`save-folder` re-slugifies the caller's slug**, so an underscore-bearing folder can never be overwritten. *Do not remove the second `slugifyName`* — it is the only sanitisation on `body.slug`; validate against `/^[a-z0-9][a-z0-9_-]*$/` instead.
- **i18n gaps**: 20 hardcoded Spanish `DESCRIPTIONS` in `results.ts` (8 domain-locked); `WizardStep5Sections.tsx:129` renders `sectionTitle.split(":")[0]` where no colon exists, putting a 45-char sentence in a column header; `page.tsx:63,99,127` hardcode "01 — Método / 02 — Privacidad / 03 — Salidas" on the English landing page; `ProtocolRunner.tsx:362`'s localised `stepStatus` fallback is unreachable because `STEP_TEMPLATE` seeds every step with Spanish detail; `pipeline.ts:84` hardcodes `toLocaleTimeString("es-MX")`; three components resolve display names as `Es || En` ignoring locale; 7 dictionary keys are unreferenced. *(Note: the figures themselves carry Spanish titles baked in by Python, so localising `DESCRIPTIONS` alone would not yield an English results page.)*
- **Packaging failure discards a completed analysis** (`pipeline.ts:123`) — a `zip` ENOENT marks the whole job failed and `ProtocolRunner.tsx:381` then hides every result link, though the log box already prints `Salida: <dir>`. Treat packaging as best-effort.
- **An unlabeled category becomes the empty grouping key**, indistinguishable from ungrouped root terms (`validation.ts:73`, `protocol.py:391`). Flag a labelless category with children as incomplete.
- **`parseInt(...) || 0` writes 0 into section weights on an empty field**, and `validateSections` returns `[]` unconditionally so nothing catches it. *(The write is visible — the controlled input re-renders showing "0" and `activeProfile` flips to "custom".)* Give `validateSections` real checks.
- **Figure filename slug collision**: identical or accent-differing A/B display names overwrite one frequency chart (`visualize.py:127,137`). Every collision requires the two variables to be the same concept. Name files by slot.

---

## 5. RE-RUN IMPACT

**Everything in `outputs/` must be regenerated.** Concretely:

### Fixes that change the numbers — full re-mine required
| Fix | What changes | Magnitude measured |
|---|---|---|
| **B1** section headers | `mentions.csv` section column → `section_weight` → `mention_score` → `confidence_score` → `role` → relation section → `_relation_confidence` → `_association_label`. **Every number in `articles.csv`, `mentions.csv`, `entity_summaries.csv`, `relations.csv`, `systematic_review_table.csv` and every figure.** | 51/79 articles affected; 14.9% of corpus characters relabelled; 498 bibliography mentions sign-flipped |
| **B2** relation evidence | `relations.csv` rows, association labels, confidence tiers, `confidence_score`; `heatmap_asociaciones`, `nivel_asociacion`, `category_association_heatmap`, `association_network`, bubble matrix, `top_association_pairs`, and the weighted relation feature fed to k-means | ~52% of relation rows removed or relabelled |
| **B3** relation distance cap | Relation labels and scores; the Methods parameter statement | 2/23 relations flipped label on the corpus test (8.7%), incl. `debil/Media → fuerte/Alta` |
| **B8** references cue bonus | `confidence_score` and `role` in `entity_summaries.csv`; both frequency figures and the systematic table (keyed on role) | 295/825 summaries gain net score from bibliography; 17 over-ranked; 10 promoted to `role_primary_focus` |
| **B11** flat-taxonomy heatmap | `category_association_heatmap.svg` (currently a 46-byte blank); k-means cluster assignments, `cluster_profiles.csv`, `kmeans_centroids.csv`, `kmeans_inertia` (feature space currently degraded by a collapsed `b_category::nan` column) | 1 figure void; clustering computed on a degraded feature space |
| **S1** frequency filter | Both published frequency bar charts | A chart ±221 entries or B chart −56, depending on the predicate chosen |
| **S11** weight formula | Bubble radii, bipartite edge widths, top-pairs bar chart, both heatmaps, three k-means feature families | Realized scale changes from 9:3.89:1 to the declared 3:2:1 |
| **S6** page numbers | The `p.N` provenance in `entity_summaries.evidence_text` (display only, feeds no score) | 40.1% of citations currently point at the wrong page |
| **S7** overlapping patterns | `n_mentions`, `mentions_per_10k_words`, TF-IDF, aggregate `confidence_score` | +0.4% corpus-wide; up to +44% for 20 entity-article pairs |

### Fixes requiring human re-work
- **B4 (validation sample)** — **any precision, false-positive-rate, or human/algorithm-agreement figure already computed from `manual_validation_relations.csv` or `manual_validation_entity_roles.csv` is invalid and must be re-annotated on a genuinely probabilistic sample.** If no annotation has been done yet, only the templates need regenerating — do the fix *before* annotating.

### Fixes that require regeneration but change no number
- **B7 (Word report)** — regenerate `reporte_revision_nexo.docx` (rerun `scripts/generate_review_report.py` against the output folder; no pipeline rerun needed for this defect alone). Every report generated since Phase 5 has an unusable main results table.
- **S2 (captions/prose)** — regenerate reports; the figures themselves are unaffected.

### Fixes with no impact on existing outputs
B5, B6, B9, B10, B12, B13, B14, B15, and all of §4 either affect paths not exercised by the published run, guard against inputs this corpus does not contain, or are crashes (no completed run can have been affected). **B10 in particular:** the shipped matrices have exactly 39 and 8 term columns matching the 39 and 8 distinct non-empty `label_es` values — correct, but by luck, not by design.

**Recommended order:** B4 first (unblocks re-annotation, the longest lead time) → B5 + B6 (make anything runnable/reproducible at all) → B1 + B2 + B3 + B8 together (they all touch the scoring path; fix and re-run once) → B11, S1, S11 → regenerate figures and reports → B7, S2 → the rest.

---

## 6. WHAT IS SOLID

The audit ran adversarially — it tried to break things and failed in the following places. These are defensible in review.

**Architecture and layering**
- The **Phase-5 generic A/B refactor is genuinely complete in the data path.** Slot ids propagate correctly from `protocol.py` → `extract.py` → `classify.py` → `relations.py` → `export.py`. The domain-specific leftovers found are confined to *display strings* (captions, prose, one dead script) — not to any computed value.
- **`pipeline_publicable/review_miner` is byte-identical to `review_miner/`** (`diff -rq` excluding `__pycache__`/`.DS_Store` → exit 0). There is no stale vendored fork; any fix applies once and covers both trees.
- The **live user flow works**: `/comenzar → /protocolo/nuevo → /ejecutar → POST /api/pipeline/run-protocol` correctly passes `--protocol` (`pipeline.ts:280-290`) and runs to completion. The broken `/analizador` path is orphaned — `grep -rn 'href="/'` over `AppShell.tsx`, `MobileNav.tsx` and every page returns no link to it.
- **Path containment is correctly enforced where it matters.** `/api/files/view` and `/api/files/download` call `assertProjectFile` and correctly 400 on out-of-project paths (verified live). `/api/protocol/save-folder`, `/api/protocol/load-folder` and `/api/local/dialog` correctly call `assertLocalProcessingAllowed`. Lexical `..` traversal is properly blocked.
- **`build_relations` deduplicates correctly**: candidates are bucketed by `(entity_a_id, entity_b_id)` and exactly one `Relation` is emitted per pair via `max()`. Duplicate mentions produce **zero** duplicate relation rows — a claim the audit specifically tested and confirmed.

**Data integrity of the current corpus**
- **All 79 corpus PDFs are discovered and processed.** `Articulos/` contains 79 files, all lowercase `.pdf`, no subdirectories; all 79 are found. The case-sensitivity bug is real but has zero effect here.
- **The metadata join works**: 75 of 79 stems key successfully into the two shipped spreadsheets. The 4 misses (A13, A14, C14, E6) are genuinely absent from both workbooks under any ID — not victims of the ID regex (all four stems match it).
- **The `text_extractable = word_count >= 50` threshold does its job.** Exactly one article (C7, a scanned PDF, 0 words) falls below it and is correctly excluded; the next-shortest real article is Z11 at **1,073 words**. Nothing lies in the hypothesised 50–1000 danger band, so no per-10k rate is inflated and `n_extractable_articles` is correct.
- **All 47 real lexicon patterns compile** — 39 contaminants + 8 diseases in `protocolo_revision_drux.json`, plus both protocol folders. Zero silent drops in the published run.
- **All 47 entity `label_es` values are distinct and non-empty** (39/39 and 8/8), so the TF-IDF column-collision bug did not fire; the shipped matrices have exactly 45 and 14 header fields = 6 metadata + 39 and 8 term columns.
- **Section detection is deterministic on this corpus.** Enumerating every header match across all 79 PDFs found **zero** offsets carrying two distinct section names, so the `PYTHONHASHSEED` hazard never fires on the shipped data.
- **`sentence_at` drift is negligible in practice**: 30 of 14,741 mentions (0.20%) return a non-containing sentence, and a drift-free reimplementation differs on only 18 of 6,322 checked (0.28%).
- **De-hyphenation does not break the lexicon**: every hyphen-bearing pattern in the shipped lexicons (as-mixture, mc-lr, three BMAA spellings) already uses `\s*-?`, and only 8 blank-line joins exist corpus-wide (2 of them correct).

**Scoring logic that survived scrutiny**
- **`_confidence()`'s cue argument is defensible.** The audit flagged that `direct_cues + association_cues` is passed under a parameter named `direct_cues`, but `_confidence` already requires `score >= 18` AND `central_count > 0`, so the third term reads as "some cue evidence exists". Rescoring **all 825 real entity-article groups**, exactly **1 group (0.12%)** gets a different confidence label under the strict reading. This is a naming nit, not a math error.
- **`standardize_matrix` z-scores every retained column**, so the claim that the relation feature block carries 3× the mass in k-means distance is false — raw magnitude does not survive standardisation.
- **The `"result" in section` disjunct is inert, not wrong.** The complete reachable section id set is `{title, abstract, methods, results, discussion, conclusion, introduction, references, other}`; the two predicates agree on every one. It cannot produce a wrong label under any input.
- **The systematic-review table's cross-product shape is documented design, not an oversight** (`export.py:149`), and non-relation rows are cleanly partitioned by the `Extraccion o inferencia` column — 1,254 `extraccion_literal_sin_relacion_directa` vs 936 `inferencia_contextual_con_evidencia_textual`, exactly matching the 936 relations. `sin_evidencia_suficiente` is semantically true for both populations.
- **`rehydrateDraft` cannot be reached with a malformed variable through any real path.** `variableFromJson` always constructs a full `metadata` object and throws `unknown_format` otherwise; `readVariableFile` then returns null and the base keeps `createEmptyVariable()`. Every writer of the localStorage key was enumerated. Only devtools can trigger it.
- **The wizard's own escaping is correct** — `templates.ts` and `draftToFolder` emit properly single-escaped `\bplomo\b`; a wizard-generated folder was read and verified. The double-escaping defect is confined to one hand-authored QA fixture.
- **`k` and the live section weights are already persisted**: `kmeans_k` in `visual_analytics_summary.json` (key `"k"`), and the full live weight dict in `section_weight_rationale.csv`'s `current_pipeline_weight` column.
- **`package-lock.json` pins the entire JavaScript dependency tree.**

---

## 7. REPRODUCIBILITY STATEMENT

**Today, a third party cannot re-run this tool at all, let alone get identical results.** Following the manuscript's own Reproducibility section produces `argparse` exit code 2 (**B6**); repairing the command to point at the only committed protocol produces `Menciones extraidas: 0 / Relaciones: 0` with exit code 0 (**B5**) — a silent empty study that a verifier could easily mistake for a valid negative result. Half the documented commands additionally invoke an interpreter at `/Users/drux/.cache/codex-runtimes/…` that exists on one machine (**B15**), and the required `matplotlib` is commented out of the requirements file (**S17**).

**Assuming those are fixed, determinism is good but not guaranteed.** The pipeline contains **no** `random`, no unseeded `sample`, and no wall-clock dependence in the analysis path; the k-means implementation uses deterministic maximin seeding; the only nondeterminism found — `sorted(set(markers))` in `detect_sections` — **does not fire on this corpus** (zero tied offsets across 79 articles), though it is a latent hazard that a `.txt` input beginning with a header line would trigger. So byte-identical reruns are achievable *on the same machine with the same dependency versions*.

**What is missing to guarantee it:**

1. **A dependency lockfile.** Python deps are open lower bounds (`pandas>=2.0` while the working env is **pandas 3.0.5**, `numpy>=1.24` vs **2.5.1** — one and two major versions up). `stratified_sample`'s `groupby(dropna=False)`, `build_feature_matrix`'s dtype indexing, and `pivot_table`'s `dropna` semantics are all pandas-major-version-sensitive. Ship `pip freeze` from the environment that produced the manuscript's numbers, plus the exact Python version. *(The Node side is already pinned.)*
2. **A self-describing run.** `context_radius` and `relation_distance` appear in **no** output file, and the protocol folder is never copied into the output directory. A deposited results archive therefore cannot be traced to the configuration that produced it. Serialize `dataclasses.asdict(protocol.analysis)` plus `sections.active_profile` into `publication_pipeline_summary.json` and copy (or hash) the protocol folder into the output dir.
3. **A seed for the validation sample.** Once **B4** is fixed with `DataFrame.sample`, reproducibility requires an explicit protocol-stored `analysis.validationSeed` echoed into the summary JSON.
4. **A real example protocol.** Both entries in `config/protocols/` are unusable (**B5**, **S21**). Commit the exact protocol used for the manuscript's case study, wizard-exported, with no absolute paths.
5. **A regression test suite.** Zero tests exist across 201 tracked files — no pytest, no `npm test` script, no CI. Nothing verifies that any weight, threshold, role or exported column survives a dependency bump or a refactor. A suite that runs the pipeline over a small committed fixture corpus and asserts the exported scores, roles, association labels and column names is what makes the section weights and thresholds *auditable*, and it is the single highest-leverage addition for defending the tool in review.
6. **A licence and a DOI** (**B14**) — without them the artefact is not legally reusable and not formally citable, which most indexed journals treat as a data-availability failure independent of whether the code runs.
7. **A CI guard** that fails the build on any `/Users/` or `/home/` literal in tracked source and docs, so **B15** cannot recur.

**Bottom line:** the reproducibility gap is entirely fixable and mostly mechanical — but until items 1–4 are addressed, the correct statement in the manuscript is that the results were produced by a specific unversioned environment on the author's machine, which is not a reproducibility claim a reviewer will accept.