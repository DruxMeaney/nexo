# Tutorial 03. Para qué sirve cada algoritmo

## 1. Léxicos controlados

El pipeline usa diccionarios de contaminantes y enfermedades. Cada término tiene sinónimos y patrones de búsqueda.

Sirve para que la detección sea transparente: podemos saber exactamente qué palabra activó cada mención.

Ventaja: auditable.  
Limitación: depende de que el léxico esté completo.

## 2. Regex y búsqueda por palabras clave

Cada patrón del léxico se compila como expresión regular. El algoritmo busca coincidencias en el texto completo.

Sirve para contar apariciones textuales y recuperar fragmentos.

No significa que el contaminante haya sido usado experimentalmente; solo significa que fue detectado.

## 3. Segmentación por secciones IMRaD

El algoritmo detecta encabezados como:

- título;
- resumen;
- introducción;
- métodos;
- resultados;
- discusión;
- conclusión;
- referencias.

Sirve para asignar contexto. Una mención en métodos/resultados pesa más que una mención en referencias.

Los pesos actuales son heurísticos y deben reportarse como reglas reproducibles, no como escala validada.

## 4. KWIC: Keyword in Context

KWIC guarda palabras antes y después de cada mención.

Ejemplo:

```text
left_context | keyword | right_context
rats were exposed to | aluminum chloride | at 100 mg/kg for 30 days
```

Sirve para revisar si la mención indica exposición, medición, asociación, especulación o simple antecedente.

## 5. Pistas lingüísticas

El algoritmo busca señales en la ventana de contexto:

- exposición: exposed, treated, administered, dose, concentration;
- dosis: mg/L, µg/L, mg/kg, ppm, ppb;
- asociación: associated with, increased risk, odds ratio;
- especulación: may, might, possible, suggests;
- negación: no association, not significant.

Sirve para subir o bajar la confianza de la clasificación.

## 6. Puntaje contextual

Cada mención recibe un puntaje:

```text
score = peso_sección
      + pistas_exposición
      + pistas_dosis
      + pistas_asociación
      - especulación
      - negación
      - término_genérico
```

Sirve para clasificar si una entidad es exposición principal, variable secundaria, mención contextual o mención bibliográfica.

## 7. Extracción de relaciones contaminante-enfermedad

El pipeline no asocia dos entidades solo porque aparezcan en el mismo artículo.

Exige que contaminante y enfermedad estén:

- en la misma oración, o
- a menos de 900 caracteres de distancia.

Luego clasifica la relación según pistas de asociación, negación, especulación y sección.

Sirve para reducir falsos positivos de co-ocurrencia.

## 8. Co-ocurrencia artículo-vs-evidencia

La tabla `cooccurrence_article_vs_evidence.csv` compara:

- pares que aparecen en el mismo artículo;
- pares que aparecen con evidencia textual cercana.

Sirve para mostrar qué tanto depura el algoritmo antes de proponer asociaciones.

## 9. TF-IDF

TF-IDF combina:

- TF: frecuencia de una entidad en un artículo;
- IDF: qué tan específica es esa entidad dentro del corpus.

Un contaminante muy frecuente en todos los artículos puede tener menor IDF. Un contaminante menos común pero muy característico de ciertos artículos puede destacar.

Sirve para exploración y priorización, no para probar asociaciones.

## 10. K-Means

Cada artículo se representa como un vector de rasgos:

- contaminantes;
- enfermedades;
- secciones;
- roles;
- relaciones;
- tipo de estudio.

Antes de agrupar, el pipeline aplica `log(1+X)` para reducir el efecto de artículos con valores extremos y luego estandariza las columnas. K-Means agrupa artículos parecidos directamente en esa matriz artículo × rasgo.

Sirve para detectar perfiles de artículos, atípicos o grupos temáticos.

No sirve para demostrar causalidad.

La figura K-Means-only muestra:

- cluster asignado;
- distancia de cada artículo a su centroide;
- tamaño del punto proporcional al peso de evidencia.

Los artículos con mayor distancia al centroide son candidatos a revisión manual como casos atípicos.

## 11. Validación manual

Las plantillas de validación permiten revisar una muestra estratificada de:

- roles de entidades;
- asociaciones contaminante-enfermedad.

Sirve para calcular precisión, falsos positivos y calibrar pesos.
