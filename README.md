# NEXO

**Mineria de datos para revisiones.**

[![Vercel](https://img.shields.io/badge/Live-nexo--flame.vercel.app-black?logo=vercel)](https://nexo-flame.vercel.app)

Interfaz web local-first para revision sistematica de literatura cientifica. NEXO envuelve un pipeline Python generico (`review_miner`) que toma cualquier par de variables (contaminantes/enfermedades, farmacos/efectos adversos, especies/ecosistemas, etc.) definido como un protocolo y produce menciones auditables, relaciones con evidencia textual, figuras, tablas y un reporte Word.

> La interfaz se aloja en Vercel ([nexo-flame.vercel.app](https://nexo-flame.vercel.app)) para hojear el diseñador, los ejemplos y la documentacion. El procesamiento real de PDFs corre localmente con `npm run dev` — Vercel no puede leer tus carpetas privadas.

## Que hace

- Lee una carpeta local con PDFs, TXT o MD.
- Ejecuta `pipeline_publicable/run_pipeline_publicable.py`.
- Permite construir o cargar un protocolo reutilizable.
- Permite cargar o editar las dos bases JSON de terminos a relacionar.
- Genera tablas CSV, Excel y JSON.
- Expone figuras SVG y visual analytics.
- Genera un reporte Word con resumen ejecutivo, metodo y referencias a figuras.
- Crea un paquete ZIP con el analisis completo.

## Arquitectura

```text
RevisionContaminantes/
  src/app/                 Web app Next.js
  src/app/api/             APIs locales para escaneo, ejecucion y archivos
  src/components/          Landing, analizador y visualizador
  src/lib/server/          Adaptadores entre Next.js y el pipeline Python
  scripts/                 Utilidades de reporte
  review_miner/            Pipeline auditable existente
  pipeline_publicable/     Pipeline extendido para revision sistematica
  config/                  Lexicos de contaminantes y enfermedades
  config/protocols/        Protocolos reutilizables creados desde la app
```

## Requisitos

- Node.js 20.9 o superior.
- Python 3.10 o superior para la instalacion normal; Python 3.12 o superior si usas el entorno bloqueado (`requirements-lock.txt`).
- `zip` disponible en la maquina local para crear el paquete descargable.

Instala dependencias JavaScript:

```bash
npm install
```

Crea el entorno virtual e instala dependencias Python (instalacion normal, rangos flexibles):

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements_review_miner.txt
```

El entorno virtual es necesario: en macOS y en muchas distribuciones Linux el Python del sistema esta marcado como *externally managed* y `pip install` falla fuera de un venv.

### Reproduccion exacta

`requirements_review_miner.txt` declara rangos y sirve para uso normal. Para reproducir exactamente los numeros publicados usa el entorno bloqueado:

```bash
.venv/bin/python -m pip install -r requirements-lock.txt
```

`requirements-lock.txt` es un `pip freeze` del entorno de trabajo (pandas 3.0.5, numpy 2.5.1, pypdf 6.14.2, openpyxl 3.1.5, python-docx 1.2.0) verificado con CPython 3.14.6.

### Scripts de figuras opcionales

`generar_graficos_menciones.py` y `generar_diagrama_algoritmo_detallado.py` son utilidades auxiliares y son los unicos archivos que necesitan matplotlib. El pipeline principal no lo usa (sus figuras son SVG nativas). Si los vas a correr:

```bash
.venv/bin/python -m pip install "matplotlib>=3.8,<4"
```

## Ejecucion local

Apunta la app al interprete del entorno virtual y arrancala:

```bash
export PYTHON_BIN="$PWD/.venv/bin/python"
npm run dev
```

Si no defines `PYTHON_BIN`, la app usa `python3` del sistema, que no ve los paquetes del venv y el pipeline falla al importar pandas. Tambien puedes fijarlo de forma permanente en `.env.local`:

```bash
PYTHON_BIN=/ruta/absoluta/al/proyecto/.venv/bin/python
```

Abre:

```text
http://localhost:3000
```

La ruta `/analizador` permite validar una carpeta local y ejecutar el pipeline. Si no defines una salida, la app crea una carpeta nueva bajo:

```text
outputs/webapp_runs/
```

## Constructor de protocolo

El analizador incluye una seccion para construir el corpus conceptual de la revision:

- Variable A: por defecto contaminantes.
- Variable B: por defecto enfermedades.
- Cada variable puede tener tipo, subtipo y subsubtipo.
- Cada termino se guarda con `id`, etiquetas ES/EN, categoria jerarquica, bandera `generic` y patrones regex.
- Las bases se pueden cargar desde `config/review_miner_contaminants.json` y `config/review_miner_diseases.json`.
- Tambien se pueden guardar nuevas bases JSON compatibles con el pipeline.

Los protocolos guardan:

- rutas de corpus y salida;
- rutas y contenido de las dos bases de terminos;
- caracteres de contexto por mencion;
- radio KWIC;
- distancia maxima para relacion;
- parametros de K-Means y validacion manual.

El boton con icono de carpeta usa un dialogo nativo del sistema operativo mediante el backend local. Esto solo funciona al ejecutar la app localmente.

## Variables de entorno

Opcionales:

```bash
PYTHON_BIN=/ruta/a/python3
```

Si no se define, la app usa `python3`. Cuando instalas las dependencias en `.venv` (lo recomendado), apuntala a `.venv/bin/python`.

## Vercel

La interfaz puede prepararse para Vercel, pero hay una limitacion importante: una app desplegada en Vercel no puede leer carpetas locales del usuario ni procesar PDFs privados de su computadora.

Modo recomendado:

1. Usar Vercel para hospedar la landing/interfaz informativa.
2. Ejecutar el procesamiento real de PDFs en modo local con `npm run dev`.
3. Evitar subir PDFs, salidas sensibles o documentos con copyright a repositorios publicos.

Arquitectura alternativa futura:

- Frontend en Vercel.
- Agente local o backend local instalado por el usuario.
- Comunicacion autenticada entre frontend y agente local.
- Procesamiento siempre en la maquina donde residen los PDFs.

## Salidas principales

El pipeline genera, entre otros:

- `articles.csv`
- `mentions.csv`
- `entity_summaries.csv`
- `relations.csv`
- `systematic_review_table.csv`
- `review_miner_results.xlsx`
- `publication_pipeline/*.csv`
- `figures/*.svg`
- `visual_analytics/advanced_figures/*.svg`
- `reporte_revision_nexo.docx`
- `_package/nexo_analysis.zip`

## Guardrails cientificos

- Una mencion no equivale a asociacion.
- Una co-ocurrencia no equivale a causalidad.
- Toda relacion reportada debe revisarse contra su evidencia textual.
- Los resultados apoyan la revision sistematica, pero no sustituyen cribado, elegibilidad, evaluacion de calidad ni lectura critica.

## Preparacion para GitHub

El `.gitignore` evita subir por accidente:

- PDFs y corpus en `Articulos/`.
- Salidas en `outputs/`.
- Documentos Word, Excel y PowerPoint.
- Archivos de entorno y dependencias locales.

Antes de publicar un repositorio, revisa manualmente que no haya PDFs, credenciales ni resultados confidenciales.

## Licencia

NEXO se distribuye bajo la licencia MIT. El texto completo esta en [`LICENSE`](LICENSE).

Las dependencias son todas permisivas y compatibles con MIT: Next.js, React, papaparse y docx (MIT), lucide-react (ISC) en JavaScript; pypdf, pandas y numpy (BSD-3-Clause), openpyxl y python-docx (MIT) en Python.

## Como citar

Los metadatos de citacion estan en [`CITATION.cff`](CITATION.cff), legible por GitHub, Zenodo y gestores bibliograficos. Cita la version que usaste:

```text
Meaney, D. (2026). NEXO: Mineria de datos para revisiones (version 0.1.0) [Software].
https://github.com/DruxMeaney/nexo
```
