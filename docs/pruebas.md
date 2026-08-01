# Suite de pruebas de NEXO

Este documento explica cómo instalar, cómo correr las pruebas y —sobre todo—
**por qué existe cada aserción**. Está escrito para una tercera persona que
quiera verificar la herramienta sin conocerla: un revisor de revista, un
evaluador de reproducibilidad o quien retome el proyecto más adelante.

Es el documento que puede citarse desde la sección de Métodos o de
disponibilidad de datos y código.

---

## 1. Por qué hay una suite

Antes de esto el repositorio tenía **cero pruebas** en 201 archivos versionados:
ni `pytest`, ni `npm test`, ni integración continua. Nada verificaba que un peso
de sección, un umbral de rol, una etiqueta de asociación o el nombre de una
columna exportada sobrevivieran a una actualización de dependencias o a una
refactorización.

Eso no es solo una deuda de ingeniería. En una herramienta de minería para
revisiones sistemáticas, **los pesos y los umbrales son parámetros del método**:
aparecen en la sección de Métodos del manuscrito y determinan los números
publicados. Un parámetro que puede cambiar sin que nada lo note no es auditable,
y por lo tanto no es defendible en revisión.

La auditoría previa (`docs/auditoria/informe_auditoria_publicacion.md`) encontró
defectos que corrompían los números sobre el propio corpus del autor y terminó
con esta recomendación: fijar el comportamiento con una suite que corra el
pipeline sobre un corpus de prueba versionado y afirme los puntajes, roles,
etiquetas y nombres de columna exportados. Esta suite es esa recomendación.

**Regla que gobierna todas las pruebas:** una prueba que no puede fallar es peor
que ninguna prueba. Cada aserción de esta suite se verificó rompiendo a
propósito el código que protege, comprobando que la prueba falla, y
restaurándolo.

---

## 2. Instalación

Se necesitan dos entornos porque el proyecto tiene dos artefactos: la app web
(TypeScript/Next.js) y el pipeline de minería (Python).

### Node

```bash
npm ci
```

`npm ci` y no `npm install`: instala exactamente lo que dice
`package-lock.json` y falla si el lockfile y `package.json` divergen.

Requiere Node 20.9 o superior (`engines` en `package.json`); la integración
continua usa Node 24.

### Python

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements_review_miner.txt
.venv/bin/python -m pip install -r requirements-dev.txt
```

Requiere Python 3.12 o superior. Los tres archivos de dependencias tienen
funciones distintas y no deben mezclarse:

| Archivo | Para qué sirve |
| --- | --- |
| `requirements_review_miner.txt` | Ejecución normal del pipeline (rangos con límite superior). |
| `requirements-lock.txt` | Reproducción exacta de los números publicados (`pip freeze`). |
| `requirements-dev.txt` | Solo las pruebas (`pytest`, con versión fija). |

`pytest` está separado a propósito: quien solo quiere usar la herramienta no
tiene que instalar un marco de pruebas, y la suite no puede colar por accidente
una dependencia de ejecución.

---

## 3. Cómo correr todo

```bash
npm test                         # chequeos de la app web (incluye tsc --noEmit)
.venv/bin/python -m pytest tests -q   # pruebas del pipeline
```

`npm test` encadena cuatro pasos y se detiene en el primero que falle. También
pueden correrse por separado:

```bash
npm run check             # tsc --noEmit
npm run check:i18n        # paridad de diccionarios
npm run check:templates   # higiene léxica de las plantillas
npm run check:paths       # rutas absolutas de máquina
```

`npm run test:py` documenta la invocación de pytest (`python3 -m pytest tests
-q`); dentro de un entorno virtual conviene llamar al intérprete del entorno,
como arriba.

Todo corre **sin red y en segundos**. Ninguna prueba depende del corpus privado
de 79 PDFs del autor —que está en `.gitignore` y no existe en un clon limpio—
ni de rutas absolutas ni del reloj del sistema.

### Integración continua

`.github/workflows/ci.yml` corre exactamente lo anterior en cada `push` y cada
`pull_request`, en dos trabajos paralelos (Node 24 / Python 3.12), sin caché de
dependencias. La ausencia de caché es deliberada: una caché puede enmascarar un
lockfile roto, que es justo lo que la instalación limpia debe detectar.

---

## 4. Qué garantiza cada grupo

### 4.1 Tipos — `npm run check`

`tsc --noEmit` sobre todo el árbol. Fija los contratos entre la app y el
pipeline: la forma del borrador de protocolo, los ids de sección, los tipos de
las respuestas de la API.

### 4.2 Paridad de diccionarios — `scripts/check-i18n-parity.mjs`

**Garantiza** que los objetos `es` y `en` de `src/lib/i18n/dictionaries.ts`
tienen exactamente la misma forma: las mismas llaves, anidadas igual, con el
mismo tipo de valor y, cuando el valor es un arreglo, **la misma longitud**.

**Por qué.** El tipo `Dictionary` se deriva de `dictionaries.es`, así que un
`en` incompleto compila sin una sola advertencia. En tiempo de ejecución el
componente lee `t.algo.otro` y recibe `undefined`. Un arreglo más corto es peor:
las listas de la página de método se renderizan por índice, y la versión corta
simplemente pierde pasos —por ejemplo, un paso del método— sin avisar a nadie.
La herramienta es bilingüe por diseño; que las dos versiones describan el mismo
método no es cosmético.

**Cómo se leen las llaves.** Con el analizador sintáctico de TypeScript, sin
ejecutar el módulo. El recorrido es estricto: si aparece algo que no sea un
literal plano (un *spread*, una llamada a función, una llave calculada), el
chequeo falla en lugar de adivinar. Se prefiere un falso positivo ruidoso a una
paridad "verificada" sobre una lectura incompleta.

### 4.3 Higiene léxica de las plantillas — `scripts/check-templates.mjs`

**Garantiza**, para cada patrón de `src/lib/protocol/templates.ts`:

1. **Compila** como expresión regular.
2. **No está doblemente escapado.** Ningún patrón contiene `\\`.
3. **El término se encuentra a sí mismo.** Alguno de sus patrones casa con su
   etiqueta en español y alguno con su etiqueta en inglés.
4. **Casa con frases representativas** y **no casa** con frases trampa
   explícitas.

**Por qué.** La auditoría documentó que el único protocolo distribuido en
`config/protocols/` traía los patrones doblemente escapados
(`\\bplomo\\b` en vez de `\bplomo\b`): el motor buscaba una diagonal invertida
literal, el pipeline extraía **0 menciones de cualquier corpus** y salía con
código 0. Un estudio vacío silencioso. Las plantillas integradas son lo primero
que ejecuta quien abre NEXO, así que están expuestas exactamente al mismo
riesgo, y si fallan el usuario no ve un error: ve cero menciones y concluye que
su corpus no habla del tema.

**Por qué frases negativas.** El pipeline compila todos los patrones con
`re.IGNORECASE` de forma incondicional
(`review_miner/protocol.py::_compile_patterns`). Bajo esa regla un `\bpb\b`
desnudo también casa con **PB** (buffer de fosfatos) y **pb** (pares de bases);
`\bcd\b` casa con **CD** (dicroísmo circular, cúmulo de diferenciación). Esas
coincidencias se puntúan igual que una mención real y, si caen en la sección de
métodos, entran con peso 6. Por eso los símbolos de dos letras se anclan a un
contexto que una abreviatura no relacionada no lleva —un estado de oxidación
(`Pb(II)`, `Cd2+`) o una palabra de medición (`Hg exposure`, `niveles de Cd`)—.

Las muestras negativas de este chequeo fallan si alguien vuelve a introducir el
patrón desnudo; las positivas fallan si alguien "arregla" el falso positivo
rompiendo `Pb(II)` o `lead exposure`. Las dos direcciones están cubiertas.

### 4.4 Rutas absolutas de máquina — `scripts/check-no-machine-paths.mjs`

**Garantiza** que ningún archivo **versionado** contiene una ruta absoluta que
empiece con el directorio personal de alguien: la raíz `Users` o `home` seguida
de un nombre de usuario, en cualquiera de sus formas POSIX o Windows.

**Por qué.** La auditoría reportó el hallazgo `author-machine-paths-shipped`
(severidad alta). Son dos problemas a la vez:

- **Reproducibilidad.** El primer comando del quickstart invocaba un intérprete
  de Python alojado en la caché privada del autor. Quien clone el repositorio
  obtiene "no such file or directory" en el primer paso, y un revisor de
  reproducibilidad no pasa de ahí.
- **Privacidad.** Una ruta absoluta publica la estructura del directorio
  personal del autor y los nombres de sus archivos privados.

**Alcance y exclusiones.** Solo se revisan archivos rastreados (`git ls-files`),
así que el corpus local, `outputs/` y `.venv/` quedan fuera por construcción.
Hay dos exclusiones explícitas, documentadas dentro del propio script:
`docs/auditoria/`, porque el informe **cita** las rutas ofensoras como
evidencia y borrarlas destruiría el registro de por qué existe el chequeo; y el
script mismo, que contiene los patrones que busca. Se admite además una única
forma anonimizada, `/Users/.../carpeta`, que es el marcador que la interfaz
muestra para enseñar la *forma* de una ruta y no identifica ninguna máquina.

> **Estado.** Al momento de escribir este documento el chequeo todavía reporta
> ocurrencias heredadas de ese hallazgo que aún no se han eliminado (tutoriales,
> documentos de arquitectura, `config/protocols/protocolo_revision_drux.json` y
> `scripts/build_analitica_contaminantes_guide.py`). Hasta que llegue a cero,
> `npm test` falla a propósito: el chequeo está haciendo su trabajo. La lista
> exacta, con archivo y línea, sale al correrlo.

### 4.5 Pipeline — `pytest tests`

Las pruebas de Python corren el pipeline sobre un **corpus de prueba
versionado** dentro de `tests/`: documentos sintéticos, escritos a mano, con
secciones, menciones y relaciones conocidas de antemano. Ese corpus es lo que
hace la suite hermética y rápida, y lo que permite afirmar valores exactos en
vez de rangos.

Lo que fija:

- **Pesos de sección.** El peso por sección (`title`, `abstract`, `methods`,
  `results`, `discussion`, `references`…) entra directo en el puntaje de cada
  mención y de ahí en el rol, la confianza y todas las figuras. La auditoría
  mostró que una detección errónea de encabezados reetiquetó ~15% de los
  caracteres del corpus y dio peso positivo a 498 menciones que estaban dentro
  de listas de referencias. Las pruebas fijan el valor de cada peso y el tramo
  de texto al que se aplica.
- **Umbrales.** Los cortes que convierten un puntaje en un rol o en un nivel de
  confianza son constantes numéricas que el manuscrito declara. Las pruebas los
  afirman explícitamente, para que cambiarlos exija cambiar una prueba y quede
  registrado en el historial.
- **Alcanzabilidad de roles.** Cada rol que el clasificador puede emitir debe
  ser alcanzable, y los filtros que deciden qué roles entran en cada figura
  deben ser los mismos para la variable A y para la variable B. La auditoría
  encontró que no lo eran: dos figuras publicadas lado a lado contaban sobre
  poblaciones distintas.
- **Integridad de la evidencia.** Toda relación exportada debe llevar un
  `evidence_text` que contenga **las dos** entidades que afirma relacionar. En
  el corpus publicado, 485 de 936 filas (51.8%) no lo cumplían, incluidas 37 de
  las 149 filas marcadas `asociacion_fuerte`/`Alta`. Esta es la aserción que
  sostiene la promesa central de la herramienta: que cada decisión se puede
  releer.
- **Columnas exportadas.** Los nombres de columna de `articles.csv`,
  `mentions.csv`, `entity_summaries.csv`, `relations.csv` y
  `systematic_review_table.csv` son la interfaz pública de los datos: se citan
  en el manuscrito y se leen desde scripts externos. Las pruebas los fijan uno
  por uno, incluido su orden.
- **Determinismo.** Correr el pipeline dos veces sobre el mismo corpus debe
  producir los mismos archivos. También cubre el muestreo: la auditoría
  encontró que la plantilla de validación manual "estratificada" era en realidad
  un corte determinista de la cabeza de cada estrato (media de
  `confidence_score` 88 contra 49 en la población), de modo que cualquier
  precisión estimada a partir de ella estaba sesgada al alza.

Para ver la lista concreta de pruebas y qué afirma cada una:

```bash
.venv/bin/python -m pytest tests -q --collect-only
```

---

## 5. Qué NO cubren las pruebas

Decirlo importa tanto como decir lo que sí cubren.

- **No validan la ciencia.** Fijan que el código calcula lo que dice calcular.
  Que un peso de sección de 6 para *métodos* sea la elección metodológica
  correcta es una decisión del protocolo, no algo que una prueba pueda
  demostrar.
- **No corren sobre el corpus real.** El corpus de 79 PDFs del autor no está
  versionado (contiene material con derechos). Los números publicados se
  reproducen con `requirements-lock.txt` y el protocolo de
  `config/protocols/`, no con esta suite.
- **No cubren la interfaz.** No hay pruebas de componentes ni de extremo a
  extremo del navegador. `tsc --noEmit` y el chequeo de paridad de diccionarios
  son la única red que hay del lado de la app.
- **No sustituyen la validación manual.** La precisión de la extracción se
  estima anotando a mano una muestra aleatoria; las pruebas solo garantizan que
  esa muestra se construya como el método dice.

---

## 6. Cómo agregar una prueba

1. Si fija un número (peso, umbral, radio de contexto), **escribe el número
   literal** en la aserción y di en un comentario de dónde sale. Una prueba que
   recalcula la constante desde el código no prueba nada.
2. **Rompe el código a propósito** y confirma que la prueba falla. Restaura y
   confirma que pasa. Si no falla al romper el código, bórrala.
3. Nada de red, nada de rutas absolutas, nada de dependencias del reloj, nada
   que dependa del corpus privado.
4. Si una prueba nueva revela un defecto real, **corrige el defecto**; no ajustes
   la prueba al comportamiento equivocado.

---

## 7. Para citar en el manuscrito

Redacción sugerida para Métodos o disponibilidad de código:

> El comportamiento del pipeline está fijado por una suite de regresión
> ejecutada en integración continua sobre un corpus de prueba versionado. La
> suite afirma los pesos por sección, los umbrales de clasificación, la
> alcanzabilidad de los roles, la presencia de ambas entidades en el texto de
> evidencia de toda relación exportada, los nombres de las columnas exportadas y
> el determinismo de la ejecución. El procedimiento y su justificación se
> documentan en `docs/pruebas.md`.
