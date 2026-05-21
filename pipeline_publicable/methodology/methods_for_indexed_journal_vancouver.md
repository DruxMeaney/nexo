# Methods: Auditable text-mining pipeline for environmental contaminants and neurodegenerative diseases

## Study design and purpose

We developed a semi-automated, auditable text-mining pipeline to support a systematic review of scientific articles on environmental contaminants and neurodegenerative diseases. The pipeline was designed for evidence triage rather than autonomous scientific conclusion generation. Its purpose was to identify contaminant and disease mentions, preserve their textual context, classify whether a contaminant was likely used or analyzed in the study, extract contaminant-disease relations supported by local textual evidence, and generate structured tables and visualizations for manual review.

The methodological design combines previously published approaches from systematic-review text mining, biomedical information extraction, chemical-disease relation extraction, keyword-in-context concordance analysis, keyword co-occurrence mapping, IMRaD-aware section analysis, exposure-information classification, K-Means clustering, and exploratory visual analytics [1-13]. Project-specific components, including the bilingual environmental contaminant lexicon, exact section weights, rule thresholds, role labels, confidence labels, and weighted association scores, were defined as transparent heuristics and should be calibrated through manual validation.

## Data sources and document ingestion

The input corpus consisted of full-text scientific articles provided as PDF files, plain-text files, or Markdown files. Optional metadata spreadsheets were used to enrich each article with title, year, DOI, and study-type information when available. PDF text was extracted using `pypdf`. Minimal cleaning was applied to preserve the evidentiary value of original text while reducing common PDF artifacts, including null characters, hyphenated line breaks, repeated spaces, and excessive newlines. Articles with fewer than 50 extracted word tokens were flagged as non-extractable and excluded from downstream mention extraction.

For each article, the pipeline stored article ID, source path, title, year, DOI, metadata-based study type, inferred study type, number of pages, word count, and extractability status.

## Controlled vocabularies and entity recognition

Two controlled vocabularies were used: one for environmental contaminants and one for neurodegenerative diseases. Each entity included a stable identifier, Spanish label, English label, semantic category, optional generic-term flag, and one or more regular-expression patterns. The contaminant vocabulary included heavy metals, pesticides, particulate matter, solvents, persistent organic pollutants, microplastics, atmospheric contaminants, environmental mixtures, and other relevant contaminants. The disease vocabulary included Alzheimer disease, Parkinson disease, amyotrophic lateral sclerosis, Huntington disease, dementia, cognitive impairment, general neurodegeneration, multiple sclerosis, and other detected neurological outcomes.

Entity recognition was performed using case-insensitive regular-expression matching over the full article text. Duplicate detections for the same entity at the same character span were removed. For every mention, the pipeline stored the exact matched text, entity type, entity ID, Spanish and English labels, category, section, character offsets, estimated page number, sentence, context window, and linguistic cues. This rule-based approach was selected for transparency and reproducibility. More complex biomedical named-entity recognition systems such as PubTator and chemical-disease extraction systems such as CD-REST provide a published methodological foundation for this task, but were not required for the default local execution [6,7].

## Section detection and IMRaD-aware context

The pipeline detected article sections using regular-expression patterns for common English and Spanish headings: title, abstract/resumen, introduction/introducción, methods/métodos, results/resultados, discussion/discusión, conclusion/conclusiones, and references/referencias. This strategy was motivated by work showing that biomedical full texts can be represented through IMRaD rhetorical categories and that section information can support downstream text-mining tasks [9,10].

Each mention was assigned to the section span containing its character position. Section identity was used as a contextual signal rather than as definitive evidence. The current heuristic section weights were:

| Section | Weight |
|---|---:|
| Methods | 6 |
| Results | 5 |
| Title | 5 |
| Abstract | 4 |
| Discussion | 2 |
| Conclusion | 2 |
| Introduction | 1 |
| References | -3 |
| Other | 1 |

These weights reflect the assumption that methods and results are more likely to contain direct evidence of exposure, measurement, population, experimental model, and findings, whereas introductions and references are more likely to contain background or bibliographic mentions. The weights are not presented as a previously validated scale; they are project-specific, auditable heuristics informed by IMRaD/rhetorical-zone literature.

## Keyword-in-context concordance

For each entity mention, a keyword-in-context (KWIC) record was generated. The default KWIC radius was 160 characters to the left and 160 characters to the right of the matched term. The KWIC output preserves the matched keyword, left context, right context, sentence, section, page, article metadata, and cue indicators. KWIC-style concordances allow reviewers to move from frequency counts to contextual interpretation without opening each PDF individually.

## Linguistic cue detection

The context window around each mention was scanned for five groups of cues:

1. **Exposure cues**, including terms such as exposed, exposure, treated, administered, dose, concentration, drinking water, serum, urine, blood, brain, group, control group, ensayo, grupo, expuesto, concentración, and dosis.
2. **Dose cues**, including numerical concentrations or units such as mg/L, µg/L, ng/L, ppm, ppb, mg/kg, nm, and mg/kg/day.
3. **Association cues**, including associated with, association between, increased risk, odds ratio, hazard ratio, relative risk, risk of, correlated with, linked to, induced, impairs, asociado con, asociación entre, and mayor riesgo.
4. **Speculation cues**, including may, might, could, suggests, potential, hypothesis, possible, podría, sugiere, potencial, hipótesis, and posible.
5. **Negation cues**, including not associated, no association, not significant, without association, no se asoció, sin asociación, and no significativo.

Cue detection was implemented with transparent regular expressions in English and Spanish. These cues were used to increase or decrease contextual confidence, not to assert causality.

## Mention-level contextual scoring

Each mention received a contextual score:

```text
mention score = section weight
              + exposure cue bonus
              + dose cue bonus
              + association cue bonus
              - speculation penalty
              - negation penalty
              - generic-term penalty
```

In the current implementation, exposure cues add 4 points, dose cues add 5 points, association cues add 2 points, speculation cues subtract 1 point, negation cues subtract 2 points, and generic terms subtract 1 point. These values are heuristics designed to prioritize direct exposure and measurement evidence while reducing bibliographic, speculative, and negative contexts.

## Article-level entity role classification

Mentions were grouped by article, entity type, and entity ID. For each article-entity pair, the pipeline summarized total mentions, section distribution, contextual score, central-section count, informative-section count, exposure/dose cues, association cues, best evidence snippets, and confidence.

For contaminant entities, the algorithm assigned one of the following roles:

- primary exposure of the study;
- secondary variable or analytical context;
- introduction/discussion-only mention;
- bibliographic-only mention;
- review/synthesis mention;
- unclear.

For disease entities, the algorithm assigned:

- disease studied;
- disease probably studied;
- contextually mentioned disease;
- disease mentioned in review/synthesis;
- unclear.

Confidence was assigned as high, medium, or low. High confidence required a sufficiently high contextual score, at least one central-section mention, and direct exposure/dose or association cues. Medium confidence required an intermediate score and central-section evidence. Low confidence was assigned otherwise.

## Study-context classification

The study context was classified using title, metadata, and early article text. Rule-based patterns detected review/synthesis articles, human epidemiological studies, in vitro studies, and in vivo/preclinical animal studies. Human-study cues included patients, participants, cohort, case-control, population, registry, biobank, cohorte, población, and epidemiológico. In vitro cues included cell line, cells, culture, SH-SY5Y, PC12, neuroblastoma, células, cultivo celular, and línea celular. In vivo cues included mouse, mice, rat, zebrafish, animal model, ratón, rata, and pez cebra.

## Contaminant-disease relation extraction

For each article, contaminant mentions were paired with disease mentions. A candidate relation was considered only when both entities appeared in the same sentence or within 900 characters of each other. This restriction was intended to reduce false-positive article-level co-occurrence. For each candidate pair, the algorithm selected the highest-scoring evidence fragment based on mention scores and relation cues.

Relations were classified as:

- strong association;
- weak association;
- speculative mention;
- insufficient evidence.

Negated evidence was classified as insufficient evidence. Strong association required strong association language without speculation and a central evidence section. General association language produced a weak association. Speculative language produced a speculative mention. If no adequate evidence was present, the relation was classified as insufficient evidence. Every emitted relation retained the article ID, contaminant, contaminant category, disease, disease category, association label, confidence, section, confidence score, study context, and evidence text.

This relation-extraction design follows the broad structure of published chemical-disease relation extraction: entity recognition followed by relation classification. However, the present implementation uses auditable rules rather than supervised machine-learning classifiers [6,7].

## Frequency, normalized frequency, and TF-IDF

To adapt standard text-mining representations used in systematic-review support tools and information retrieval, the pipeline exports article-term matrices for contaminants and diseases [3,14]. Three forms are generated:

1. Raw count matrices: number of entity mentions per article.
2. Length-normalized matrices: mentions per 10,000 article words.
3. TF-IDF matrices: `log(1 + term count) × inverse document frequency`.

Inverse document frequency was computed as:

```text
idf(term) = log((1 + N) / (1 + df(term))) + 1
```

where `N` is the number of extractable articles and `df(term)` is the number of articles containing the entity. TF-IDF was used for exploratory profiling and specificity assessment, not for causal inference.

## Co-occurrence versus evidence-backed relations

The pipeline generates a comparison table between article-level co-occurrence and evidence-backed relations. Article-level co-occurrence occurs when a contaminant and disease appear anywhere in the same article. Evidence-backed relation requires local textual proximity and an evidence fragment. The difference between these two counts is reported as a possible article-level false-positive signal. This output makes the depuration step explicit and supports manual audit.

## Visual analytics

The pipeline produces frequency bars, section-level mention charts, heatmaps, bubble matrices, bipartite networks, top-pair rankings, and K-Means profiles. Weighted evidence scores were computed as:

```text
weighted score = association weight × confidence weight
```

where strong association = 3, weak association = 2, speculative mention = 1, insufficient evidence = 0; high confidence = 3, medium confidence = 2, and low confidence = 1.

Heatmaps summarize evidence density across contaminant categories and disease categories. Bubble matrices separate accumulated evidence volume from mean relation strength. Bipartite networks represent contaminants and diseases as nodes and evidence-backed relations as weighted edges. K-Means is used only for exploratory article profiling; it is not used to infer causal relationships. The article-feature matrix includes contaminant categories, disease categories, study type, association levels, confidence levels, evidence sections, and weighted relation pairs. Values are transformed using `log(1 + X)` and then standardized before K-Means. The K-Means figure reports cluster assignment, distance to the assigned centroid, and evidence weight, avoiding PCA-based dimensionality reduction.

## Manual validation and calibration

The pipeline exports stratified manual-validation templates for article-entity role classification and contaminant-disease relation classification. Reviewers are asked to label whether the algorithmic role or association is correct, whether the evidence text supports the label, and what manual label should be assigned. These templates can be used to estimate precision, false-positive rates, section-specific errors, contaminant-specific errors, and calibration needs.

The recommended next step is to annotate a representative sample and recalibrate:

- section weights;
- contextual-score thresholds;
- cue dictionaries;
- relation-proximity thresholds;
- role and association labels.

If sufficient annotated data become available, the manually validated dataset can be used to train a supervised classifier for exposure role and relation strength. This staged approach is consistent with recommendations that machine-learning tools in evidence synthesis should remain transparent, evaluated, and embedded in human review workflows [1,2,4].

## Reproducibility

All rules, lexicons, scoring weights, and outputs are stored in version-controlled Python files or structured JSON/CSV files. The default command-line entry point is:

```bash
python pipeline_publicable/run_pipeline_publicable.py \
  --input-dir Articulos \
  --output-dir outputs/review_miner_publication \
  --metadata "ArticulosTotales.xlsx,Base de articulos completa.xlsx" \
  --contaminants config/review_miner_contaminants.json \
  --diseases config/review_miner_diseases.json \
  --k 4 \
  --sample-size 200 \
  --kwic-radius 160
```

## Limitations

The pipeline is not a causal inference system. It does not determine whether a contaminant causes a disease. It detects textual patterns, assigns transparent contextual labels, and provides evidence snippets for manual review. The rule-based entity recognition approach may miss synonyms absent from the lexicons. PDF extraction artifacts can affect section detection and sentence segmentation. Section weights and thresholds are heuristic and require validation. Article-level co-occurrence may overestimate conceptual relations, while strict proximity may miss relations expressed across longer spans. Review articles may inflate mention counts and relation density. Therefore, all high-priority pairs should be manually audited before inclusion in scientific conclusions.

## References

1. O'Mara-Eves A, Thomas J, McNaught J, Miwa M, Ananiadou S. Using text mining for study identification in systematic reviews: a systematic review of current approaches. Syst Rev. 2015;4:5. doi:10.1186/2046-4053-4-5.
2. Jonnalagadda SR, Goyal P, Huffman MD. Automating data extraction in systematic reviews: a systematic review. Syst Rev. 2015;4:78. doi:10.1186/s13643-015-0066-7.
3. Howard BE, Phillips J, Miller K, Tandon A, Mav D, Shah MR, et al. SWIFT-Review: a text-mining workbench for systematic review. Syst Rev. 2016;5:87. doi:10.1186/s13643-016-0263-z.
4. Marshall IJ, Wallace BC. Toward systematic review automation: a practical guide to using machine learning tools in research synthesis. Syst Rev. 2019;8:163. doi:10.1186/s13643-019-1074-9.
5. Davis AP, Wiegers TC, Rosenstein MC, Murphy CG, Mattingly CJ. Text mining and manual curation of chemical-gene-disease networks for the Comparative Toxicogenomics Database. BMC Bioinformatics. 2009;10:326. doi:10.1186/1471-2105-10-326.
6. Xu J, Wu Y, Zhang Y, Wang J, Lee HJ, Xu H. CD-REST: a system for extracting chemical-induced disease relation in literature. Database (Oxford). 2016;2016:baw036. doi:10.1093/database/baw036.
7. Wei CH, Allot A, Lai PT, Leaman R, Tian S, Luo L, et al. PubTator 3.0: an AI-powered literature resource for unlocking biomedical knowledge. Nucleic Acids Res. 2024;52(W1):W540-W546. doi:10.1093/nar/gkae235.
8. Larsson K, Baker S, Silins I, Guo Y, Stenius U, Korhonen A, et al. Text mining for improved exposure assessment. PLoS One. 2017;12(3):e0173132. doi:10.1371/journal.pone.0173132.
9. Agarwal S, Yu H. Automatically classifying sentences in full-text biomedical articles into Introduction, Methods, Results and Discussion. Bioinformatics. 2009;25(23):3174-3180. doi:10.1093/bioinformatics/btp548.
10. Kim SN, Martinez D, Cavedon L, Yencken L. Automatic classification of sentences to support Evidence Based Medicine. BMC Bioinformatics. 2011;12 Suppl 2:S5. doi:10.1186/1471-2105-12-S2-S5.
11. Radhakrishnan S, Erbis S, Isaacs JA, Kamarthi S. Novel keyword co-occurrence network-based methods to foster systematic reviews of scientific literature. PLoS One. 2017;12(3):e0172778. doi:10.1371/journal.pone.0172778.
12. Asmussen CB, Møller C. Smart literature review: a practical topic modelling approach to exploratory literature review. J Big Data. 2019;6:93. doi:10.1186/s40537-019-0255-7.
13. Manning CD, Raghavan P, Schütze H. Introduction to Information Retrieval. Cambridge: Cambridge University Press; 2008.
14. Salton G, Buckley C. Term-weighting approaches in automatic text retrieval. Inf Process Manag. 1988;24(5):513-523. doi:10.1016/0306-4573(88)90021-0.
