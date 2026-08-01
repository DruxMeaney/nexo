# Arquitectura web de NEXO

## Resumen

NEXO ("Mineria de datos para revisiones.") es una capa web local-first sobre el pipeline `review_miner`. La app no reemplaza la logica cientifica existente; la organiza y la hace operable desde una interfaz visual.

## Flujo de usuario

1. El usuario abre la landing y entiende el alcance de la herramienta.
2. Entra al analizador.
3. Valida una carpeta local con articulos.
4. Carga o construye dos bases JSON de terminos.
5. Define contexto, distancia de relacion, KWIC y visual analytics.
6. Guarda el protocolo maestro para reutilizarlo.
7. Ejecuta el pipeline publicable.
8. Sigue el estado de ejecucion.
9. Revisa resultados en tablas y figuras.
10. Descarga imagenes, reporte Word o paquete ZIP completo.

## Componentes

- Frontend: Next.js App Router.
- Backend local: rutas API de Next.js.
- Procesamiento: scripts Python existentes.
- Reporte: `scripts/generate_review_report.py`.
- Empaquetado: comando local `zip`.

## APIs locales

- `GET /api/project`: configuracion del proyecto.
- `POST /api/local/dialog`: dialogo nativo local para elegir carpetas o archivos.
- `GET /api/protocol/list`: lista los protocolos guardados en `config/protocols/`.
- `POST /api/protocol/load-folder`: carga una carpeta de protocolo completa.
- `POST /api/protocol/save-folder`: guarda el borrador como carpeta de protocolo.
- `POST /api/pipeline/run-protocol`: inicia una ejecucion con un protocolo dado.
- `GET /api/pipeline/status`: consulta estado y logs.
- `GET /api/results`: lista tablas, figuras, reportes y paquetes.
- `GET /api/files/view`: sirve imagenes generadas dentro del proyecto.
- `GET /api/files/download`: descarga archivos generados.
- `GET /api/files/table`: previsualiza CSV.

Rutas retiradas (responden `410`): `/api/lexicon/{load,save}`, `/api/protocol/{load,save}`,
`/api/protocols/{load,save}`, `/api/pipeline/{run,scan}`. Pertenecian al modelo
anterior a la fase 5, cuando las dos variables estaban fijas en el codigo. Se
retiraron en vez de solo protegerlas: sin llamadores, una primitiva local de
lectura/escritura de disco es solo superficie de ataque.

### Peticiones de otro sitio

El backend corre en localhost con los privilegios de disco del usuario, asi que
cualquier pagina abierta en su navegador puede lanzarle un `POST`. Toda ruta que
muta estado llama a `assertSameOrigin` (`src/lib/server/request-origin.ts`), que
usa las cabeceras Fetch Metadata. `npm run check:api` verifica que ninguna ruta
mutante se quede sin esa guardia.

## Limitacion de navegador y Vercel

Los navegadores no entregan acceso irrestricto a rutas locales. El atributo `webkitdirectory` permite listar archivos seleccionados por el usuario, pero no habilita al servidor remoto a leer una carpeta local. Por esa razon, el procesamiento real se ejecuta en un backend local.

En Vercel, las rutas API no deben intentar leer `Articulos/` de la computadora del usuario. La app informa esa limitacion y bloquea el procesamiento local cuando detecta `process.env.VERCEL`.

## Privacidad

Los PDFs cientificos pueden estar sujetos a copyright o confidencialidad. La arquitectura evita subir documentos a servicios externos. El repositorio ignora corpus, salidas y documentos pesados por defecto.

## Extension futura

Una version hibrida podria separar:

- UI hospedada en Vercel.
- Agente local instalado en la maquina del investigador.
- Canal autenticado entre UI y agente.
- Cola local de ejecuciones.
- Historial local de proyectos y revisiones.
