/**
 * NEXO — Encuesta de calibración del modelo de NLP
 * VERSIÓN CON REFERENCIAS + VALOR PROPUESTO POR PESO
 * ===================================================
 *
 * Igual que la versión con referencias, pero ahora CADA peso tiene DOS preguntas
 * juntas, sin separarlas:
 *   (1) Opción: Mantener igual / Subir / Bajar / No sé
 *   (2) Campo corto: "Valor propuesto" (el número que propondrías, ahí mismo)
 * Al final de cada sección queda una caja de texto para la opinión / justificación.
 *
 * La parte de TÉRMINOS (contaminantes y enfermedades) se mantiene como rejillas,
 * porque ahí no se proponen números sino la clasificación en grupos.
 *
 * Cómo usarlo:
 *   1. Abre https://script.google.com  ->  "Nuevo proyecto".
 *   2. Borra el código de ejemplo y pega TODO este archivo.
 *   3. Pulsa "Ejecutar" (solo hay una función: crearEncuestaNEXO, ya queda seleccionada).
 *   4. Autoriza el acceso a Google Forms (lo pedirá la primera vez).
 *   5. Abre "Registro de ejecución" (Ctrl+Enter) para ver los enlaces de edición
 *      y de respuesta del formulario que se acaba de crear.
 *
 * El formulario es ANÓNIMO: no recolecta correo ni nombre.
 */
function crearEncuestaNEXO() {

  // --------------------------------------------------------------------- //
  // Escala de la rejilla de TÉRMINOS                                      //
  // --------------------------------------------------------------------- //
  var ESCALA_TERMINO = ['Bien clasificado', 'Debería ir en otro grupo', 'No debería estar / sobra', 'No sé'];

  // --------------------------------------------------------------------- //
  // Crear el formulario                                                   //
  // --------------------------------------------------------------------- //
  var form = FormApp.create('NEXO — Revisión de pesos y términos del modelo de NLP');

  form.setDescription(
    'Estás ayudando a calibrar el modelo de NLP de NEXO, que analiza artículos para relacionar ' +
    'contaminantes ambientales (Variable A) con enfermedades neurodegenerativas (Variable B).\n\n' +
    'PARTE 1 — Pesos: para CADA peso verás dos cosas juntas:\n' +
    '   (1) si lo mantendrías, subirías o bajarías, y\n' +
    '   (2) un espacio para escribir el número que propondrías (opcional).\n' +
    'Al final de cada sección hay una caja para tu opinión y justificación.\n\n' +
    'PARTE 2 — Términos: revisa si los contaminantes y las enfermedades están bien clasificados en su grupo.\n\n' +
    'En cada sección verás una nota "Referencia en la literatura de NLP" con enfoques publicados que usan pesos ' +
    'parecidos (BM25F, NegEx, TF-IDF, SemRep, DisGeNET, ASReview…). OJO: en esos sistemas los pesos suelen ' +
    'APRENDERSE de datos o salir de fórmulas estándar; aquí los fijamos a mano para que sean transparentes, por ' +
    'eso tu criterio importa. Usa las referencias como guía de dirección, no como el número exacto a copiar.\n\n' +
    'Es ANÓNIMA y toma ~15-25 min. No tienes que responder todo: enfócate en lo que conoces. ¡Gracias!'
  );

  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage('¡Gracias! Tus respuestas ayudarán a afinar el modelo NEXO.');

  // --------------------------------------------------------------------- //
  // Helpers internos (usan el "form" de arriba por cierre/closure)        //
  // --------------------------------------------------------------------- //
  function _seccion(titulo, ayuda) {
    var pb = form.addPageBreakItem().setTitle(titulo);
    if (ayuda) pb.setHelpText(ayuda);
    return pb;
  }
  function _referencia(texto) {
    return form.addSectionHeaderItem()
      .setTitle('Referencia en la literatura de NLP')
      .setHelpText(texto);
  }
  function _etiqueta(titulo) {
    return form.addSectionHeaderItem().setTitle(titulo);
  }
  // Cada peso = una opción (mantener/subir/bajar) + un campo corto para el número, juntos.
  function _peso(nombre, actual) {
    form.addMultipleChoiceItem()
      .setTitle(nombre + ' (valor actual: ' + actual + ')')
      .setChoiceValues(['Mantener igual', 'Subir', 'Bajar', 'No sé'])
      .setRequired(false);
    form.addTextItem()
      .setTitle('Valor propuesto — ' + nombre)
      .setHelpText('Opcional. Solo si marcaste "Subir" o "Bajar". Escribe el número que propondrías ' +
        '(admite negativos y decimales: p. ej. 7, -3, 2.5).')
      .setRequired(false);
  }
  function _grupoPesos(lista) {
    lista.forEach(function (p) { _peso(p[0], p[1]); });
  }
  function _comentario(titulo, ayuda) {
    var item = form.addParagraphTextItem().setTitle(titulo);
    if (ayuda) item.setHelpText(ayuda);
    item.setRequired(false);
    return item;
  }
  function _rejilla(titulo, ayuda, filas, columnas) {
    var item = form.addGridItem().setTitle(titulo);
    if (ayuda) item.setHelpText(ayuda);
    item.setRows(filas).setColumns(columnas).setRequired(false);
    return item;
  }

  // Pregunta de perfil (opcional, no identifica a la persona) ----------- //
  form.addMultipleChoiceItem()
    .setTitle('Perfil (opcional)')
    .setHelpText('Solo sirve para interpretar resultados. La encuesta sigue siendo anónima.')
    .setChoiceValues([
      'Toxicología / ciencias ambientales',
      'Neurociencia / clínica',
      'Bioinformática / NLP / datos',
      'Revisión sistemática / metodología',
      'Otro'
    ])
    .showOtherOption(true)
    .setRequired(false);

  // ===================================================================== //
  // PARTE 1 — PESOS                                                       //
  // ===================================================================== //

  // --- 1. Pesos por sección del artículo ------------------------------- //
  _seccion('PARTE 1 · Pesos — 1. Por sección del artículo',
    'Cada vez que se menciona un término, el modelo le suma el peso de la sección donde aparece ' +
    '(un hallazgo en Resultados debe pesar más que uno en Referencias). Perfil de pesos activo: "baseline_current". ' +
    'Para cada peso: marca mantener/subir/bajar y, si quieres, escribe tu valor propuesto.');
  _referencia(
    'Ponderar por la sección donde aparece un término es práctica estándar en recuperación de información. ' +
    'El modelo BM25F (Robertson y cols., 2004; doi:10.1145/1031171.1031181) aplica un "boost" mayor a las coincidencias en el TÍTULO que ' +
    'en el cuerpo del documento. En el análisis de artículos científicos, el Argumentative Zoning ' +
    '(Teufel y Moens, 2002; doi:10.1162/089120102762671936) clasifica cada oración por su papel retórico (objetivo, método, resultado…) ' +
    'porque las secciones no aportan lo mismo. La dirección de los pesos de NEXO ' +
    '(Título/Resumen/Resultados por encima de Referencias) coincide con esa práctica; el valor exacto del boost siempre es ajustable.');
  _grupoPesos([
    ['Título', '+5'],
    ['Resumen / abstract', '+4'],
    ['Introducción', '+1'],
    ['Métodos', '+6'],
    ['Resultados', '+5'],
    ['Discusión', '+2'],
    ['Conclusión', '+2'],
    ['Referencias', '-3'],
    ['Otra sección no identificada', '+1']
  ]);
  _comentario('Opinión y justificación — pesos por sección',
    'Escribe aquí por qué subirías o bajarías algún valor, o cualquier observación sobre este grupo.');

  // --- 2. Pesos de contexto (cues) a nivel de mención ------------------ //
  _seccion('PARTE 1 · Pesos — 2. Contexto de la palabra (cues)',
    'Alrededor de cada mención el modelo busca palabras clave ("cues") y ajusta el puntaje: ' +
    'dosis y exposición suman; especulación, negación y los términos genéricos restan.');
  _referencia(
    'Por qué unas señales suman y otras restan, con precedentes reales:\n' +
    '• SUMAN (dosis, exposición, asociación): los buscadores biomédicos PolySearch2 (Liu y cols., 2015; doi:10.1093/nar/gkv383) y el ' +
    'recurso DISEASES (Pletscher-Frankild y cols., 2015; doi:10.1016/j.ymeth.2014.11.020) dan MÁS puntaje a las co-ocurrencias que además ' +
    'contienen una palabra clave de relación ("high-confidence co-occurrence that includes keywords").\n' +
    '• RESTAN (negación): NegEx (Chapman y cols., 2001; doi:10.1006/jbin.2001.1029) detecta con reglas/regex cuándo un hallazgo está ' +
    'negado, para no contarlo como afirmado; hay versiones que gradúan el peso según la fuerza de la negación.\n' +
    '• RESTAN (especulación): el corpus BioScope (Vincze y cols., 2008; doi:10.1186/1471-2105-9-S11-S9) y la tarea compartida CoNLL-2010 (Farkas y cols., 2010; ACL Anthology W10-3001, sin DOI) marcan ' +
    'el lenguaje especulativo justamente para no tratar como hecho lo que es incierto.\n' +
    '• RESTAN (genérico): en TF-IDF (Spärck Jones, 1972; doi:10.1108/eb026526) la frecuencia inversa de documento BAJA el peso de los ' +
    'términos comunes y SUBE el de los específicos; por eso un término genérico resta.');
  _grupoPesos([
    ['Dosis / unidades (mg/L, ppm, µg/L)', '+5'],
    ['Exposición / tratamiento / medición', '+4'],
    ['Asociación (riesgo, OR, HR)', '+2'],
    ['Lenguaje especulativo (podría, posible)', '-1'],
    ['Negación ("no association")', '-2'],
    ['Término genérico (no es un compuesto nombrado)', '-1']
  ]);
  _comentario('Opinión y justificación — pesos de contexto (cues)',
    'Escribe aquí por qué subirías o bajarías algún valor, o cualquier observación sobre este grupo.');

  // --- 3. Bonos en la capa de relaciones A<->B ------------------------- //
  _seccion('PARTE 1 · Pesos — 3. Relaciones entre contaminante y enfermedad',
    'Cuando un contaminante (A) y una enfermedad (B) aparecen cerca en el texto, el modelo crea una ' +
    '"relación" y le suma bonos o penalizaciones según el lenguaje que comparten.');
  _referencia(
    'Lo mismo que a nivel de mención, pero para la pareja contaminante–enfermedad. DisGeNET (Piñero y cols., 2020; doi:10.1093/nar/gkz1021) ' +
    'puntúa la FUERZA de cada asociación gen-enfermedad y le da más valor cuando la respaldan más fuentes y más ' +
    'literatura; PolySearch2 / DISEASES suben el puntaje cuando la co-ocurrencia incluye una palabra clave de ' +
    'relación. Eso respalda dar un bono a la relación A↔B cuando la evidencia comparte un cue de asociación ' +
    '(y un bono extra si es "asociación fuerte"). Las penalizaciones por especulación y negación siguen la ' +
    'lógica de NegEx (Chapman y cols., 2001; doi:10.1006/jbin.2001.1029) y BioScope (Vincze y cols., 2008; doi:10.1186/1471-2105-9-S11-S9).');
  _grupoPesos([
    ['Cue de asociación en la evidencia', '+4'],
    ['Cue de asociación FUERTE (adicional al anterior)', '+4'],
    ['Vínculo en lenguaje especulativo', '-2'],
    ['La evidencia niega la relación', '-4']
  ]);
  _comentario('Opinión y justificación — pesos de relaciones',
    'Escribe aquí por qué subirías o bajarías algún valor, o cualquier observación sobre este grupo.');

  // --- 4. Peso de evidencia (fuerza x confianza) ----------------------- //
  _seccion('PARTE 1 · Pesos — 4. Peso de evidencia (fuerza × confianza)',
    'Para agregar resultados y dibujar las figuras, cada relación se resume en un "peso de evidencia" ' +
    '= fuerza de la asociación × nivel de confianza. Aquí calificas ambos factores por separado.');
  _referencia(
    'SemRep (Rindflesch y Fiszman, 2003; doi:10.1016/j.jbi.2003.11.003), de la Biblioteca Nacional de Medicina de EE. UU., separa DOS ejes en ' +
    'cada relación que extrae: la polaridad (positiva/negativa) y el nivel de CERTEZA — L3 = hecho, ' +
    'L2 = alta confianza con ligera especulación, L1 = especulación considerable; Kilicoglu y cols. (2017; doi:10.1371/journal.pone.0179926) lo ' +
    'amplían a 7 valores de factualidad (hecho, probable, posible, dudoso…). DisGeNET también resume la ' +
    'evidencia en niveles alta/media/baja confianza. Calcular "peso de evidencia = fuerza × confianza" refleja ' +
    'esa separación de ejes; los multiplicadores concretos son una decisión de diseño.');
  _etiqueta('4a. Peso por fuerza de la asociación');
  _grupoPesos([
    ['Asociación fuerte', '+3'],
    ['Asociación débil', '+2'],
    ['Mención especulativa', '+1'],
    ['Sin evidencia suficiente', '0']
  ]);
  _etiqueta('4b. Peso por nivel de confianza');
  _grupoPesos([
    ['Confianza Alta', '+3'],
    ['Confianza Media', '+2'],
    ['Confianza Baja', '+1']
  ]);
  _comentario('Opinión y justificación — peso de evidencia',
    'Escribe aquí por qué subirías o bajarías algún valor, o cualquier observación sobre este grupo.');

  // --- 5. Peso por rol de la entidad ----------------------------------- //
  _seccion('PARTE 1 · Pesos — 5. Rol del término en el artículo',
    'A cada término se le asigna un rol según qué tan central es en el artículo (foco principal, ' +
    'mención secundaria, solo en la introducción, etc.). Ese rol funciona como multiplicador al agregar resultados.');
  _referencia(
    'Las herramientas de automatización de revisiones sistemáticas asignan a cada referencia un score de ' +
    'relevancia o "probabilidad de inclusión": ASReview (van de Schoot y cols., 2021; doi:10.1038/s42256-020-00287-7) prioriza con ' +
    'aprendizaje activo y RobotReviewer (Marshall y cols., 2016; doi:10.1093/jamia/ocv044) evalúa cada estudio. Dar un multiplicador según el rol del ' +
    'término (foco principal vs. mención de pasada) sigue esa idea de ponderar por relevancia. Diferencia clave: ' +
    'esas herramientas APRENDEN el peso a partir de datos etiquetados; en NEXO lo fijamos a mano para que sea ' +
    'transparente y auditable — por eso pedimos tu criterio.');
  _grupoPesos([
    ['Foco principal del estudio', '+3'],
    ['Foco probable', '+2.5'],
    ['Variable secundaria', '+2'],
    ['Solo en introducción / discusión', '+0.5'],
    ['No determinado', '+0.5'],
    ['Mención dentro de una revisión', '+0.3'],
    ['Solo en la bibliografía', '+0.2']
  ]);
  _comentario('Opinión y justificación — pesos de rol',
    'Escribe aquí por qué subirías o bajarías algún valor, o cualquier observación sobre este grupo.');

  // ===================================================================== //
  // PARTE 2 — TÉRMINOS Y CLASIFICACIÓN                                    //
  // ===================================================================== //

  // --- 6. Contaminantes (Variable A) ----------------------------------- //
  _seccion('PARTE 2 · Términos — 6. Contaminantes (Variable A)',
    'Estos son los contaminantes que el algoritmo busca, agrupados por categoría. Para cada uno, ' +
    'dinos si está bien clasificado en su grupo. "Genérico" = término amplio que abarca varios compuestos.');
  _referencia(
    'La minería de texto biomédico se apoya en vocabularios controlados y diccionarios curados: MeSH y UMLS ' +
    'para indexar conceptos, y taggers basados en diccionario como el del recurso DISEASES (Pletscher-Frankild ' +
    'y cols., 2015; doi:10.1016/j.ymeth.2014.11.020). Por eso clasificar bien cada término en su grupo es tan importante como afinar los pesos: ' +
    'si el diccionario agrupa mal un término o le faltan sinónimos, todo lo que venga después hereda el error.');

  _rejilla('6.1 Grupo: Metales pesados', null, [
    'Plomo (lead)', 'Cadmio (cadmium)', 'Aluminio (aluminum)', 'Arsénico (arsenic)',
    'Mercurio (mercury)', 'Manganeso (manganese)', 'Cobre (copper)', 'Cromo (chromium)',
    'Níquel (nickel)', 'Zinc', 'Selenio (selenium)', 'Uranio (uranium)',
    'Metales pesados (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.2 Grupo: Pesticidas', null, [
    'Paraquat', 'Atrazina (atrazine)', 'Glifosato (glyphosate)', 'Mancozeb',
    'Diclorvos (dichlorvos)', 'Diazinón (diazinon)', 'Clorpirifós (chlorpyrifos)',
    'Triadimefon', 'Pesticidas / plaguicidas (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.3 Grupo: Contaminantes orgánicos persistentes', null, [
    'HAP / PAH — hidrocarburos aromáticos policíclicos (genérico)',
    'Benzo[a]pireno (benzo[a]pyrene)',
    'PCB — bifenilos policlorados',
    'Dioxinas (dioxins)',
    'COP — contaminantes orgánicos persistentes (genérico)'
  ], ESCALA_TERMINO);

  _rejilla('6.4 Otros grupos (se indica el grupo de cada término)', null, [
    'Microplásticos — grupo: Microplásticos',
    'Nanoplásticos — grupo: Microplásticos',
    'Material particulado, PM2.5/PM10 — grupo: Material particulado',
    'Contaminación atmosférica, NO2, ozono — grupo: Contaminantes atmosféricos',
    'Solventes — tolueno, benceno — grupo: Solventes',
    'PFAS — grupo: Otros contaminantes relevantes',
    'BMAA — grupo: Otros contaminantes relevantes',
    'Microcistina (microcystin) — grupo: Otros contaminantes relevantes',
    'Cianotoxinas (genérico) — grupo: Otros contaminantes relevantes',
    'Piridinio de furosemida — grupo: Otros contaminantes relevantes',
    'Bisfenol A / BPA — grupo: Otros contaminantes relevantes',
    'Mezcla ambiental (genérico) — grupo: Otros contaminantes relevantes'
  ], ESCALA_TERMINO);

  _comentario('Reclasificación de contaminantes',
    'Si marcaste "Debería ir en otro grupo" en alguno, dinos cuál y a qué grupo debería ir.');
  _comentario('¿Faltan contaminantes o sobran grupos?',
    'Indícanos contaminantes relevantes que falten, términos mal escritos o repetidos, y si algún ' +
    'grupo debería renombrarse, dividirse en subgrupos o fusionarse (p. ej., separar metales esenciales de no esenciales).');

  // --- 7. Enfermedades neurodegenerativas (Variable B) ----------------- //
  _seccion('PARTE 2 · Términos — 7. Enfermedades neurodegenerativas (Variable B)',
    'Estas son las enfermedades / desenlaces que el algoritmo busca, con el grupo al que pertenecen. ' +
    'Dinos si cada una está bien clasificada.');
  _referencia(
    'Igual que con los contaminantes: la referencia son los vocabularios controlados (MeSH, UMLS) y los ' +
    'diccionarios curados de minería de texto. Conviene revisar si dos grupos deberían fusionarse o separarse ' +
    '(p. ej., "demencia" y "deterioro cognitivo") y si faltan sinónimos o siglas frecuentes (ELA/ALS, DCL/MCI).');
  _rejilla('7.1 Enfermedades y desenlaces (se indica el grupo de cada término)', null, [
    'Alzheimer — grupo: Alzheimer',
    'Parkinson — grupo: Parkinson',
    'Esclerosis lateral amiotrófica (ELA / ALS) — grupo: Esclerosis lateral amiotrófica',
    'Huntington — grupo: Huntington',
    'Demencia, incluye vascular y mixta — grupo: Demencia',
    'Deterioro cognitivo, incluye DCL / MCI — grupo: Deterioro cognitivo',
    'Esclerosis múltiple — grupo: Otras enfermedades detectadas',
    'Neurodegeneración general / neurotoxicidad — grupo: Enfermedades neurodegenerativas generales'
  ], ESCALA_TERMINO);
  _comentario('Comentarios — enfermedades',
    'Si marcaste "Debería ir en otro grupo", dinos cuál y a dónde. ¿Falta alguna enfermedad o desenlace? ' +
    '¿Alguna está mal agrupada (p. ej., unir o separar "demencia" y "deterioro cognitivo")? ' +
    '¿La esclerosis múltiple debería tener su propio grupo?');

  // --- 8. Cobertura de léxico y cierre --------------------------------- //
  _seccion('Cierre — Cobertura de términos y comentarios finales',
    'Últimas preguntas abiertas, opcionales.');
  _comentario('Sinónimos, siglas y variantes de escritura',
    '¿Hay sinónimos, siglas o variantes (en español o inglés) de algún contaminante o enfermedad que ' +
    'el algoritmo debería reconocer y quizá no detecta? Indícanos el término y sus variantes.');
  _comentario('¿Algo más que debamos revisar del modelo?',
    'Cualquier otro parámetro, comportamiento o sesgo del modelo que creas que vale la pena revisar.');

  // --- 9. Fuentes citadas ---------------------------------------------- //
  _seccion('Fuentes citadas en las referencias',
    'Por si quieres profundizar. La mayoría de estos sistemas APRENDEN los pesos de datos o usan fórmulas ' +
    'estándar; NEXO los fija a mano para ser auditable. Úsalos como guía de DIRECCIÓN, no como número exacto a copiar.');
  _referencia(
    'Cada fuente con su DOI (en el formulario publicado los enlaces quedan clic-ables):\n' +
    '• BM25F — Robertson, Zaragoza y Taylor (2004): campos ponderados (título vs. cuerpo). ' +
    'https://doi.org/10.1145/1031171.1031181\n' +
    '• Argumentative Zoning — Teufel y Moens (2002): papel retórico de cada oración. ' +
    'https://doi.org/10.1162/089120102762671936\n' +
    '• NegEx — Chapman y cols. (2001): detección de negación en texto clínico. ' +
    'https://doi.org/10.1006/jbin.2001.1029\n' +
    '• ConText — Harkema y cols. (2009): negación, experienciador y estado temporal. ' +
    'https://doi.org/10.1016/j.jbi.2009.05.002\n' +
    '• BioScope — Vincze y cols. (2008): corpus anotado de negación e incertidumbre. ' +
    'https://doi.org/10.1186/1471-2105-9-S11-S9\n' +
    '• CoNLL-2010 Shared Task — Farkas y cols. (2010): detección de especulación (hedges). Sin DOI; ACL Anthology: ' +
    'https://aclanthology.org/W10-3001/\n' +
    '• TF-IDF / IDF — Spärck Jones (1972): menos peso a términos comunes o genéricos. ' +
    'https://doi.org/10.1108/eb026526\n' +
    '• SemRep — Rindflesch y Fiszman (2003): polaridad y niveles de certeza. ' +
    'https://doi.org/10.1016/j.jbi.2003.11.003\n' +
    '• Factualidad — Kilicoglu y cols. (2017): 7 valores de factualidad. ' +
    'https://doi.org/10.1371/journal.pone.0179926\n' +
    '• DisGeNET — Piñero y cols. (2020): score de fuerza/confianza de la asociación. ' +
    'https://doi.org/10.1093/nar/gkz1021\n' +
    '• PolySearch2 — Liu y cols. (2015): asociaciones por minería de texto. ' +
    'https://doi.org/10.1093/nar/gkv383\n' +
    '• DISEASES — Pletscher-Frankild y cols. (2015): asociaciones enfermedad–gen por co-ocurrencia. ' +
    'https://doi.org/10.1016/j.ymeth.2014.11.020\n' +
    '• ASReview — van de Schoot y cols. (2021): priorización con aprendizaje activo. ' +
    'https://doi.org/10.1038/s42256-020-00287-7\n' +
    '• RobotReviewer — Marshall y cols. (2016): evaluación automática de sesgo. ' +
    'https://doi.org/10.1093/jamia/ocv044');

  // --------------------------------------------------------------------- //
  // Enlaces de salida                                                     //
  // --------------------------------------------------------------------- //
  Logger.log('Formulario creado.');
  Logger.log('Editar:    ' + form.getEditUrl());
  Logger.log('Responder: ' + form.getPublishedUrl());
}
