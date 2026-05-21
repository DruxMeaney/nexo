# Tutorial 02. Qué significa cada salida

## Salidas base

### `articles.csv`

Una fila por artículo. Incluye ID, ruta, título, año, DOI, tipo de estudio inferido, páginas, número de palabras y si el texto fue extraíble.

Sirve para documentar el corpus y detectar problemas de extracción.

### `mentions.csv`

Una fila por mención detectada. Incluye contaminante/enfermedad, texto detectado, sección, página, oración, contexto y pistas lingüísticas.

Sirve para auditoría fina de menciones individuales.

### `entity_summaries.csv`

Una fila por entidad dentro de cada artículo. Resume cuántas veces apareció una entidad, en qué secciones, qué rol le asignó el algoritmo y qué evidencia textual usó.

Sirve para responder: "¿este contaminante fue realmente trabajado en este artículo o solo mencionado?"

### `relations.csv`

Una fila por relación contaminante-enfermedad con evidencia textual cercana. Incluye asociación, confianza, sección y fragmento de evidencia.

Sirve para responder: "¿qué contaminante se relaciona con qué enfermedad y cuál es el texto que lo respalda?"

### `systematic_review_table.csv`

Tabla integradora para revisión sistemática. Combina artículo, contaminante, enfermedad, tipo de estudio, evidencia textual y nivel de asociación.

Sirve como base para extracción manual y tabla final de revisión.

## Salidas extendidas

### `kwic_concordance.csv`

Tabla tipo KWIC: keyword in context. Para cada palabra detectada guarda texto izquierdo, palabra clave y texto derecho.

Sirve para revisar contexto sin abrir cada PDF.

### `entity_frequency_summary.csv`

Resumen de frecuencia por entidad. Incluye:

- menciones crudas;
- número de artículos donde aparece;
- frecuencia documental;
- IDF;
- menciones por 10,000 palabras.

Sirve para distinguir volumen textual, dispersión en el corpus y especificidad.

### `*_article_term_counts.csv`

Matrices artículo × entidad con conteos crudos.

Sirven para análisis tipo bag-of-words y para revisar qué artículos contienen cada contaminante/enfermedad.

### `*_article_term_per_10k_words.csv`

Matrices artículo × entidad normalizadas por longitud del artículo.

Sirven para evitar que artículos largos dominen solo por tener más palabras.

### `*_article_term_tfidf.csv`

Matrices artículo × entidad con TF-IDF.

Sirven para detectar términos característicos de ciertos artículos, no solamente términos frecuentes en todo el corpus.

### `cooccurrence_article_vs_evidence.csv`

Compara dos niveles:

1. co-ocurrencia a nivel artículo;
2. relación con evidencia textual cercana.

La columna `possible_article_level_false_positives` indica pares que aparecen en el mismo artículo pero no necesariamente en el mismo contexto.

Sirve para mostrar cómo el pipeline depura falsos positivos.

### `section_weight_rationale.csv`

Documenta los pesos por sección y su justificación.

Importante: estos pesos son heurísticos, no una escala validada.

### `section_weight_sensitivity.csv`

Calcula cómo cambia el puntaje de cada entidad bajo diferentes perfiles de ponderación:

- baseline actual;
- evidencia conservadora;
- conteo neutral;
- solo secciones centrales.

Sirve para análisis de sensibilidad.

### `manual_validation_entity_roles.csv`

Muestra estratificada para revisar manualmente si el rol asignado a cada entidad fue correcto.

### `manual_validation_relations.csv`

Muestra estratificada para revisar manualmente si la asociación contaminante-enfermedad fue correcta.

### `publication_pipeline_tables.xlsx`

Libro Excel con todas las tablas publicables en hojas separadas.

## Salidas de K-Means

### `visual_analytics/kmeans_articles.csv`

Una fila por artículo con su cluster K-Means, distancia al centroide y peso de relaciones.

Sirve para detectar perfiles temáticos y artículos atípicos dentro de cada cluster.

### `visual_analytics/kmeans_centroids.csv`

Resume los rasgos más característicos de cada centroide.

Sirve para interpretar qué significa cada cluster.

### `visual_analytics/advanced_figures/kmeans_cluster_map.svg`

Figura K-Means-only. El eje X muestra el cluster, el eje Y muestra la distancia al centroide y el tamaño del punto muestra el peso de evidencia.

Sirve para visualizar clusters sin usar PCA.
