# Búsqueda de metodologías publicadas para conteo contextual, text mining y revisión sistemática

Fecha de búsqueda: 2026-05-19  
Tema de interés: algoritmos de conteo de palabras, extracción de contexto, relaciones contaminante-enfermedad y visualización para revisión sistemática.

## Conclusión ejecutiva

No encontré un artículo que haga exactamente lo mismo que nuestro pipeline completo: analizar artículos sobre contaminantes ambientales en agua y enfermedades neurodegenerativas, con léxicos bilingües, secciones, ventanas de contexto, reglas de rol del contaminante, relaciones contaminante-enfermedad, evidencia textual y visualizaciones.

Sí encontré metodologías publicadas que cubren casi todas las piezas del sistema:

1. Automatización de revisiones sistemáticas mediante text mining y NLP.
2. Extracción automática de datos para revisiones sistemáticas.
3. Detección de entidades químicas y enfermedades mediante NER.
4. Extracción de relaciones químico-enfermedad.
5. Curación y text mining de redes químico-gen-enfermedad en toxicogenómica ambiental.
6. Clasificación de información de exposición química.
7. Uso de secciones IMRaD y zonas retóricas como contexto.
8. KWIC, ventanas de contexto y concordancias.
9. Redes de co-ocurrencia de palabras clave para apoyar revisiones.
10. Topic modeling y clustering como herramientas exploratorias.

Por lo tanto, metodológicamente conviene presentar el pipeline como un sistema híbrido:

- **Base publicada:** text mining para revisiones, NER, extracción de relaciones, co-ocurrencia, KWIC, IMRaD, clasificación de exposición y visual analytics.
- **Contribución propia:** combinación específica para contaminantes ambientales/neurodegeneración, léxicos especializados, reglas bilingües, ponderaciones exactas por sección, niveles de confianza, score contaminante-enfermedad y visualizaciones orientadas a auditoría manual.

## 1. Revisión sistemática asistida por text mining

### Evidencia publicada

O'Mara-Eves et al. revisaron el uso de text mining para identificación de estudios en revisiones sistemáticas. Concluyen que el text mining puede ahorrar tiempo y que la priorización de registros para cribado puede considerarse lista para uso en revisiones vivas o revisiones reales, siempre con cautela cuando se automatiza exclusión.

Jonnalagadda et al. revisaron métodos para automatizar extracción de datos en revisiones sistemáticas. Encontraron que la extracción automática de información es prometedora pero fragmentada; no había un marco unificado y los métodos publicados cubrían pocos elementos de extracción.

Marshall y Wallace proponen una guía práctica para usar machine learning en síntesis de evidencia. Destacan que tareas como riesgo de sesgo combinan dos pasos: identificar fragmentos relevantes de texto y después clasificar.

### Relación con nuestro algoritmo

Nuestro pipeline sigue exactamente esta filosofía: no intenta reemplazar al revisor, sino reducir el corpus a tablas y fragmentos auditables. Además, preserva evidencia textual para cada relación, lo cual coincide con la recomendación de usar los modelos como apoyo y no como decisión final.

### Qué podemos adoptar

- Presentar el algoritmo como **herramienta semi-automatizada de apoyo a revisión sistemática**.
- Reportar que toda clasificación debe ser revisada por humanos.
- Evaluar desempeño con métricas como precisión, recall y falsos positivos cuando tengamos etiquetas manuales.

## 2. Conteo de términos, TF-IDF, n-gramas y búsqueda por proximidad

### Evidencia publicada

SWIFT-Review, una plataforma de text mining para revisiones sistemáticas, usa representaciones tipo bag-of-words, frecuencias de términos, n-gramas, TF-IDF, búsquedas por proximidad, búsquedas por campos y operadores booleanos. Este punto es muy cercano a nuestro sistema, porque nosotros también partimos de conteo de términos y de proximidad entre entidades.

### Relación con nuestro algoritmo

Nuestro pipeline usa conteo literal por léxicos, pero añade secciones, ventanas de contexto y pistas lingüísticas. La diferencia es que SWIFT-Review está más orientado a búsqueda/cribado y nuestro algoritmo está orientado a extracción estructurada de contaminante, enfermedad y evidencia contextual.

### Qué podemos adoptar

- Justificar el conteo de palabras como una forma básica y publicada de representar documentos.
- Mencionar que la búsqueda por proximidad ya se usa en herramientas de revisión.
- Considerar añadir TF-IDF o normalización por longitud de artículo como análisis complementario.

## 3. Extracción de entidades químicas y enfermedades

### Evidencia publicada

La literatura biomédica tiene una línea extensa sobre Named Entity Recognition (NER). En el caso químico, tmChem y otros sistemas reconocen y normalizan entidades químicas. PubTator 3.0 ofrece anotaciones masivas de entidades y relaciones biomédicas, incluyendo químicos y enfermedades, mediante modelos de IA y extracción de relaciones.

CD-REST, desarrollado para el BioCreative V Chemical Disease Relation Track, combina NER para químicos/enfermedades y extracción de relaciones. El sistema usa CRF para reconocimiento de entidades, normalización a MeSH y clasificadores SVM para relaciones químico-enfermedad.

### Relación con nuestro algoritmo

Nuestro sistema usa una versión más transparente y ligera: léxicos controlados + expresiones regulares. No es tan flexible como NER profundo, pero es fácil de auditar y ajustar para contaminantes específicos.

### Qué podemos adoptar

- Citar el campo de chemical/disease NER como base metodológica.
- En una segunda fase, conectar nuestro pipeline con PubTator 3.0 o usar modelos biomédicos preentrenados.
- Mantener los léxicos como capa auditable, incluso si después usamos NER.

## 4. Extracción de relaciones químico-enfermedad

### Evidencia publicada

BioCreative V CDR creó un corpus anotado para químicos, enfermedades y relaciones químico-enfermedad. CD-REST y otros sistemas proponen detectar primero entidades y luego clasificar pares químico-enfermedad. PubTator 3.0 extrae relaciones químico-enfermedad y otras relaciones biomédicas mediante BioREx.

### Relación con nuestro algoritmo

Nuestro algoritmo hace una versión auditable de relación:

1. Detecta contaminante.
2. Detecta enfermedad.
3. Exige cercanía textual.
4. Busca pistas de asociación.
5. Revisa negación o especulación.
6. Guarda fragmento de evidencia.

Esto está alineado con el flujo publicado de NER + relation extraction, pero nuestras reglas exactas son propias.

### Qué podemos adoptar

- Presentar "relación contaminante-enfermedad" como una tarea de **relation extraction**.
- Usar vocabulario metodológico estándar: entity recognition, relation extraction, evidence sentence/snippet, proximity, negation, speculation.
- Evaluar más adelante contra anotaciones manuales.

## 5. Toxicogenómica ambiental y CTD

### Evidencia publicada

La Comparative Toxicogenomics Database (CTD) es probablemente el antecedente más cercano conceptualmente. CTD se centra en químicos ambientales y enfermedades, integra curación manual y usa text mining para identificar términos químicos, genes/proteínas y enfermedades, priorizar artículos para curación y apoyar extracción interactiva de interacciones.

La CTD no es exactamente una revisión sistemática automatizada, pero sí es una infraestructura publicada para convertir literatura científica en redes químico-gen-enfermedad.

### Relación con nuestro algoritmo

Nuestro objetivo es más acotado y revisable: contaminantes ambientales y enfermedades neurodegenerativas. CTD nos da respaldo para decir que mapear químicos-enfermedades desde literatura biomédica es una estrategia ya establecida en toxicogenómica ambiental.

### Qué podemos adoptar

- Usar CTD como fuente de vocabulario y validación externa.
- Comparar contaminantes/enfermedades detectados por nuestro pipeline con relaciones curadas en CTD.
- Plantear que nuestro sistema es una capa de extracción y priorización para revisión sistemática, no una base de conocimiento curada definitiva.

## 6. Text mining para exposición química

### Evidencia publicada

Larsson et al. desarrollaron un clasificador automático para información de exposición química. Partieron de una taxonomía de exposición, anotaron manualmente cerca de 3700 abstracts y entrenaron modelos supervisados para clasificar información de exposición humana. Reportan que la clasificación ayuda a recuperar información más específica que búsquedas amplias por palabras clave.

### Relación con nuestro algoritmo

Este trabajo es muy relevante porque nuestro problema también necesita distinguir exposición real frente a simple mención. La diferencia es que Larsson et al. usan aprendizaje supervisado con corpus anotado; nosotros estamos usando reglas auditables mientras construimos una base que después podría etiquetarse.

### Qué podemos adoptar

- Construir una taxonomía formal de exposición: agua potable, agua de pozo, biomonitoreo, exposición ambiental, in vitro, in vivo, epidemiológico humano.
- Etiquetar manualmente una muestra y entrenar un clasificador supervisado.
- Usar nuestras reglas actuales como pre-etiquetador o sistema de triage.

## 7. Secciones IMRaD y zonas retóricas

### Evidencia publicada

Agarwal y Yu muestran que las oraciones de artículos biomédicos pueden clasificarse en categorías IMRaD: introducción, métodos, resultados y discusión. El trabajo señala que clasificar secciones puede beneficiar tareas de text mining y que las herramientas de extracción pueden dirigirse a resultados ricos en evidencia y evitar introducciones pobres en evidencia.

También hay trabajos de clasificación de oraciones para evidencia médica que muestran que encabezados de sección e información secuencial mejoran el desempeño sobre bag-of-words simple.

### Relación con nuestro algoritmo

Nuestro sistema no usa un clasificador IMRaD entrenado, sino detección por encabezados y pesos heurísticos por sección. La idea general está respaldada por literatura; los pesos exactos son nuestros.

### Qué podemos adoptar

- Justificar el uso de secciones como contexto por literatura IMRaD/rhetorical zoning.
- No afirmar que nuestros pesos exactos están validados.
- Presentar los pesos como una heurística reproducible que será calibrada con validación manual.

## 8. KWIC, concordancias y ventanas de contexto

### Evidencia publicada

El enfoque KWIC (Key Word in Context) viene de lingüística de corpus: se busca una palabra y se muestran las palabras alrededor para interpretar su uso. En herramientas de análisis de contenido y corpus, las concordancias KWIC se usan justamente para pasar de frecuencia a interpretación contextual.

### Relación con nuestro algoritmo

Nuestra ventana de contexto es esencialmente una implementación computacional de KWIC aplicada a literatura científica: para cada mención guardamos oración y texto alrededor. Esa ventana permite revisar si el contaminante se usó experimentalmente, si fue medido, si aparece en una referencia o si se menciona como hipótesis.

### Qué podemos adoptar

- Llamar a nuestras ventanas "fragmentos tipo KWIC" o "ventanas de contexto".
- Reportar el tamaño de ventana usado.
- Exportar concordancias por contaminante para auditoría manual.

## 9. Co-ocurrencia de palabras clave y redes

### Evidencia publicada

Los métodos de keyword co-occurrence networks (KCN) se han usado para apoyar revisiones sistemáticas. En una KCN, cada palabra clave es un nodo; si dos palabras aparecen juntas en artículos, se crea un enlace; el peso del enlace es el número de co-ocurrencias. Radhakrishnan et al. aplicaron esta lógica a literatura nanoEHS y propusieron usar redes de co-ocurrencia antes de una revisión sistemática para mapear el campo y reducir esfuerzo.

### Relación con nuestro algoritmo

Nuestras matrices y redes contaminante-enfermedad son una versión más dirigida: en vez de keywords generales, usamos entidades expertas; en vez de co-ocurrencia a nivel artículo solamente, exigimos cercanía textual y guardamos evidencia.

### Qué podemos adoptar

- Justificar heatmaps y redes como visualizaciones de co-ocurrencia/relación.
- Reportar claramente qué significa el peso de enlaces.
- Comparar red de co-ocurrencia amplia vs red con evidencia cercana.

## 10. Topic modeling y K-Means

### Evidencia publicada

El topic modeling, especialmente LDA, se usa para exploración de literatura. La literatura enfatiza que estos métodos se basan en frecuencia y co-ocurrencia de palabras, y que su valor está en agrupar documentos y revelar temas, no en probar relaciones causales.

### Relación con nuestro algoritmo

Nuestro K-Means cumple ese mismo papel: representar cada artículo como vector de rasgos y detectar perfiles o grupos. No se debe usar para afirmar asociación contaminante-enfermedad; sirve para detectar artículos atípicos, duplicados conceptuales o subgrupos temáticos.

### Qué podemos adoptar

- Mantener K-Means como análisis exploratorio.
- Reportar varianza explicada.
- No usar K-Means como clasificador de evidencia.
- Si queremos temas semánticos, considerar LDA, BERTopic o embeddings.

## Qué parte podemos decir que está publicada

Podemos decir que el pipeline se inspira en componentes metodológicos publicados:

- text mining para revisiones sistemáticas;
- extracción automática de datos;
- reconocimiento de entidades químicas y enfermedades;
- extracción de relaciones químico-enfermedad;
- text mining en toxicogenómica ambiental;
- clasificación de exposición química;
- análisis IMRaD y zonas retóricas;
- KWIC/concordancias;
- redes de co-ocurrencia;
- topic modeling y clustering exploratorio.

## Qué parte es nuestra contribución

Debemos declarar como diseño propio:

- léxico bilingüe específico de contaminantes ambientales y enfermedades neurodegenerativas;
- reglas exactas de contexto;
- pesos exactos por sección;
- umbrales de confianza;
- fórmula de score fuerza × confianza;
- clasificación de rol del contaminante;
- integración de resultados en tablas para revisión sistemática;
- visualizaciones específicas para priorizar auditoría manual.

## Redacción sugerida para métodos

> Se desarrolló un pipeline semi-automatizado de minería de literatura científica inspirado en enfoques publicados de text mining para revisiones sistemáticas, reconocimiento de entidades biomédicas, extracción de relaciones químico-enfermedad, análisis de secciones IMRaD y concordancias KWIC. El sistema combina léxicos controlados de contaminantes y enfermedades, detección de secciones, extracción de ventanas de contexto y reglas auditables para clasificar el rol del contaminante y el nivel de asociación contaminante-enfermedad. Las ponderaciones exactas por sección y los umbrales de confianza fueron definidos como heurísticas iniciales reproducibles, no como escalas previamente validadas, y deberán calibrarse mediante auditoría manual de una muestra etiquetada.

## Referencias útiles

1. O'Mara-Eves A, et al. Using text mining for study identification in systematic reviews. *Systematic Reviews*. 2015. https://link.springer.com/article/10.1186/2046-4053-4-5
2. Jonnalagadda SR, et al. Automating data extraction in systematic reviews: a systematic review. *Systematic Reviews*. 2015. https://link.springer.com/article/10.1186/s13643-015-0066-7
3. Howard BE, et al. SWIFT-Review: a text-mining workbench for systematic review. *Systematic Reviews*. 2016. https://link.springer.com/article/10.1186/s13643-016-0263-z
4. Marshall IJ, Wallace BC. Toward systematic review automation: a practical guide to using machine learning tools in research synthesis. *Systematic Reviews*. 2019. https://link.springer.com/article/10.1186/s13643-019-1074-9
5. Li H, et al. CD-REST: a system for extracting chemical-induced disease relation in literature. *Database*. 2016. https://pmc.ncbi.nlm.nih.gov/articles/PMC4808251/
6. Wei CH, et al. PubTator 3.0: an AI-powered literature resource for unlocking biomedical knowledge. *Nucleic Acids Research*. 2024. https://academic.oup.com/nar/article/52/W1/W540/7640526
7. Davis AP, et al. Text mining and manual curation of chemical-gene-disease networks for the Comparative Toxicogenomics Database. *BMC Bioinformatics*. 2009. https://link.springer.com/article/10.1186/1471-2105-10-326
8. Larsson K, et al. Text mining for improved exposure assessment. *PLOS ONE*. 2017. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0173132
9. Agarwal S, Yu H. Automatically classifying sentences in full-text biomedical articles into Introduction, Methods, Results and Discussion. *Bioinformatics*. 2009. https://academic.oup.com/bioinformatics/article/25/23/3174/215126
10. Kim SN, et al. Automatic classification of sentences to support Evidence Based Medicine. *BMC Bioinformatics*. 2011. https://link.springer.com/article/10.1186/1471-2105-12-S2-S5
11. Radhakrishnan S, et al. Novel keyword co-occurrence network-based methods to foster systematic reviews of scientific literature. *PLOS ONE*. 2017. https://pmc.ncbi.nlm.nih.gov/articles/PMC5362196/
12. Asmussen CB, Møller C. Smart literature review: a practical topic modelling approach to exploratory literature review. *Journal of Big Data*. 2019. https://link.springer.com/article/10.1186/s40537-019-0255-7
13. Song M, et al. Keyword Extraction: A Modern Perspective. *SN Computer Science*. 2023. https://link.springer.com/article/10.1007/s42979-022-01481-7
