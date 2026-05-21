# Tutorial 04. Validación manual y calibración

La validación manual es la parte que convierte el pipeline de una herramienta exploratoria en una metodología defendible para una revisión sistemática.

## 1. Archivos de validación

El pipeline genera:

```text
manual_validation_entity_roles.csv
manual_validation_relations.csv
manual_validation_codebook.csv
```

Estos archivos están en:

```text
outputs/review_miner_publication/publication_pipeline/
```

## 2. Validar roles de entidades

Abrir `manual_validation_entity_roles.csv`.

Revisar cada fila y llenar:

- `human_role`
- `human_confidence`
- `correct_evidence`
- `reviewer_notes`

Valores recomendados para `human_role`:

```text
exposure_main
secondary_variable
bibliographic_mention
unclear
not_detected
```

Preguntas para el revisor:

- ¿El contaminante fue realmente estudiado?
- ¿Aparece en métodos/resultados?
- ¿Hay dosis, exposición, medición o población?
- ¿La evidencia textual respalda el rol asignado?

## 3. Validar relaciones contaminante-enfermedad

Abrir `manual_validation_relations.csv`.

Revisar cada fila y llenar:

- `human_association`
- `human_confidence`
- `correct_evidence`
- `reviewer_notes`

Valores recomendados para `human_association`:

```text
strong
weak
speculative
insufficient
false_positive
```

Preguntas para el revisor:

- ¿El fragmento realmente relaciona contaminante y enfermedad?
- ¿La relación es fuerte, débil o especulativa?
- ¿Hay negación?
- ¿La evidencia proviene de métodos/resultados o solo de introducción/referencias?

## 4. Métricas sugeridas

Después de completar la validación, se pueden calcular:

- precisión por rol;
- precisión por nivel de asociación;
- falsos positivos por sección;
- falsos positivos por contaminante;
- sensibilidad de los pesos por sección;
- acuerdo entre revisores, si hay más de un evaluador.

## 5. Cómo usar la validación para mejorar el pipeline

Si hay muchos falsos positivos en referencias:

- hacer más negativo el peso de referencias;
- excluir referencias en relaciones fuertes;
- exigir métodos/resultados para exposición principal.

Si hay muchos falsos negativos en abstract:

- aumentar peso de abstract;
- agregar más pistas de asociación;
- revisar sinónimos faltantes.

Si un contaminante aparece con nombres no detectados:

- actualizar el léxico de contaminantes;
- agregar sinónimos;
- agregar variantes químicas.

## 6. Recomendación para publicación

Para un artículo científico, lo ideal es reportar:

1. tamaño del corpus;
2. número de menciones;
3. número de relaciones;
4. tamaño de la muestra validada;
5. precisión de clasificación;
6. principales fuentes de falsos positivos;
7. cambios hechos al algoritmo después de la calibración.

