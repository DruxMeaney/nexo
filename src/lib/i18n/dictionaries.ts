/**
 * Bilingual dictionaries for NEXO.
 *
 * Keep this file as the single source of truth for all UI strings.
 * Add new keys as nested objects; every key must exist in both `es` and `en`.
 *
 * Usage:
 *   - Server components: `const t = await getDictionary();`
 *   - Client components: receive the locale or the dictionary as a prop, or
 *     use the LocaleToggle which sets a cookie that the next render reads.
 */

export type Locale = "es" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["es", "en"];

export const DEFAULT_LOCALE: Locale = "es";

export const dictionaries = {
  es: {
    common: {
      brand: "NEXO",
      tagline: "Minería de datos para revisiones.",
      back: "Volver",
      next: "Siguiente",
      cancel: "Cancelar",
      save: "Guardar",
      load: "Cargar",
      loading: "Cargando...",
      languageLabel: "Idioma",
      languageToggleAria: "Cambiar idioma de la interfaz"
    },
    nav: {
      method: "Método",
      results: "Resultados",
      start: "Comenzar",
      primaryAriaLabel: "Navegación principal"
    },
    landing: {
      eyebrow: "Revisión sistemática, minería de literatura y evidencia trazable",
      heroTitlePrefix: "De PDFs a",
      heroTitleEmphasis: "evidencia auditable",
      heroCopy:
        "Una interfaz local-first para ejecutar el pipeline de minería de literatura: revisa PDFs científicos, extrae menciones auditables, explora asociaciones textuales y prepara salidas listas para tablas, figuras y reportes.",
      heroMetaLocal: "Local-first",
      heroMetaVariables: "Variable A ↔ Variable B",
      heroMetaEvidence: "PRISMA · evidencia textual",
      heroMetaOutputs: ".docx + .csv + .zip",
      ctaStart: "Comenzar revisión",
      ctaResults: "Ver resultados existentes",
      heroImageAlt: "Visualización real generada por el pipeline",
      methodEyebrow: "PRISMA + evidencia textual",
      methodTitle: "De PDFs a resultados auditables",
      methodCopy:
        "La app envuelve un pipeline Python para convertir artículos en tablas, figuras, archivos JSON, visual analytics y un reporte Word con advertencias metodológicas.",
      cardCorpusTitle: "Corpus científico",
      cardCorpusCopy:
        "Procesa carpetas locales con PDFs, TXT o MD y conserva metadatos como título, año, DOI y extracción.",
      cardExtractTitle: "Extracción contextual",
      cardExtractCopy:
        "Detecta tus dos variables de estudio, secciones del artículo, pistas de exposición, asociación, dosis y negación.",
      cardVisualTitle: "Visualización científica",
      cardVisualCopy:
        "Expone figuras SVG, matrices, redes, tablas de validación y resúmenes para auditoría manual.",
      privacyEyebrow: "Arquitectura local-first",
      privacyTitle: "Privacidad antes que comodidad falsa",
      privacyCopy:
        "Vercel puede alojar la interfaz, pero un navegador desplegado en la nube no puede leer libremente tus carpetas locales. Para proteger PDFs privados, el procesamiento real corre en tu máquina mediante el backend local de Next.js.",
      badgeLocal: "Local",
      badgeLocalCopy: "Lectura de carpetas y ejecución del pipeline Python en la máquina.",
      badgeTraceable: "Trazable",
      badgeTraceableCopy: "Cada relación conserva evidencia textual y nivel de confianza.",
      badgeDownloadable: "Descargable",
      badgeDownloadableCopy: "Tablas, imágenes, JSON, Word y paquete ZIP desde la vista de resultados.",
      outputsTitle: "Salidas esperadas",
      outputsCopy:
        "Las salidas están pensadas para construir una revisión sistemática: tablas auditables, figuras, plantillas de validación manual y documentos descriptivos sin prometer causalidad."
    },
    footer: {
      eyebrow: "Revisión sistemática asistida",
      title: "Minería auditable, lectura humana al centro",
      copy:
        "La app distingue menciones, co-ocurrencias y asociaciones textuales. No afirma causalidad ni sustituye la evaluación crítica de los artículos.",
      cta: "Comenzar revisión"
    },
    method: {
      eyebrow: "Cómo funciona NEXO",
      title: "El método paso a paso",
      copy:
        "El pipeline aplica reglas auditables sobre lexicones controlados. Cada etiqueta queda ligada a un fragmento textual que se puede leer y verificar. Aquí están las piezas que componen el proceso.",
      backToStart: "Volver al inicio",
      diagramTitle: "El pipeline en seis etapas",
      diagramCopy:
        "Cada etapa produce un artefacto trazable. Una mención no equivale a asociación; una co-ocurrencia no equivale a causalidad.",
      stages: [
        {
          title: "1. Lectura del corpus",
          desc: "PDFs, TXT o MD se convierten a texto y se asocian a metadatos (título, año, DOI, tipo de estudio)."
        },
        {
          title: "2. Detección de secciones",
          desc: "Patrones IMRaD identifican abstract, introducción, métodos, resultados, discusión y referencias."
        },
        {
          title: "3. Extracción de menciones",
          desc: "Términos del protocolo se buscan con regex bilingüe. Cada coincidencia guarda contexto, sentencia, sección y página."
        },
        {
          title: "4. Pistas léxicas",
          desc: "Cerca de cada mención se buscan pistas (exposición, dosis, asociación, especulación, negación) que ajustan su peso."
        },
        {
          title: "5. Clasificación de rol",
          desc: "Cada entidad por artículo recibe un rol: foco principal, secundario, contextual, bibliográfico o revisión."
        },
        {
          title: "6. Relación A↔B",
          desc: "Cuando A y B aparecen cerca, se emite una relación con evidencia textual, fuerza y nivel de confianza."
        }
      ],
      glossaryTitle: "Glosario rápido",
      glossary: [
        {
          term: "Variable A / Variable B",
          desc: "Los dos ejes de tu revisión. Pueden ser contaminantes/enfermedades, fármacos/efectos, etc."
        },
        {
          term: "Protocolo",
          desc: "Carpeta con todas las decisiones de tu revisión: variables, pistas, pesos por sección y parámetros numéricos."
        },
        {
          term: "Mención",
          desc: "Coincidencia exacta de un término en un artículo, con sección y contexto guardados."
        },
        {
          term: "Pista (cue)",
          desc: "Palabra clave que aumenta o reduce el peso de una mención (dosis, asociación, especulación, negación)."
        },
        {
          term: "Rol",
          desc: "Cómo la entidad aparece en el artículo: foco principal, variable secundaria, mención contextual o bibliográfica."
        },
        {
          term: "Asociación",
          desc: "Etiqueta de la relación A↔B: fuerte, débil, especulativa o sin evidencia suficiente."
        },
        {
          term: "Confianza",
          desc: "Nivel agregado (alta/media/baja) que combina puntaje, sección y pistas de la evidencia."
        },
        {
          term: "Evidencia textual",
          desc: "Fragmento del PDF donde aparece la asociación. Se exporta para auditoría manual."
        }
      ],
      outputsTitle: "Lo que vas a ver al final",
      outputItems: [
        {
          title: "Tablas auditables",
          desc: "CSV/XLSX con artículos, menciones, resúmenes por entidad, relaciones y tabla de revisión sistemática."
        },
        {
          title: "Figuras vectoriales",
          desc: "SVGs de frecuencia, heatmap por categoría, red bipartita, burbujas y mapa K-Means exploratorio."
        },
        {
          title: "Reporte Word + paquete ZIP",
          desc: "Documento con resumen ejecutivo, método y referencias; paquete descargable con todo lo generado."
        }
      ],
      ctaStart: "Diseñar mi protocolo",
      ctaViewResults: "Ver resultados de ejemplo"
    },
    start: {
      eyebrow: "Paso 1 de tu revisión",
      title: "¿Cómo quieres comenzar?",
      copy:
        "Un protocolo guarda todas las decisiones de tu revisión: las dos variables que buscas, sus términos y categorías, las ventanas de contexto, las pistas léxicas, los pesos por sección del artículo y los parámetros de análisis. Puedes diseñar uno nuevo o cargar uno que ya hayas guardado antes.",
      newCardEyebrow: "Empieza desde cero",
      newCardTitle: "Diseñar un nuevo protocolo",
      newCardCopy:
        "Te guiamos paso a paso para definir tus dos variables, sus términos, las pistas léxicas y los parámetros de análisis. Al final podrás guardar el protocolo como una carpeta reutilizable.",
      newCardCta: "Crear protocolo",
      loadCardEyebrow: "Continúa una revisión existente",
      loadCardTitle: "Cargar un protocolo guardado",
      loadCardCopy:
        "Si ya tienes una carpeta de protocolo, cárgala y solo selecciona la carpeta con tus PDFs para volver a ejecutar la extracción sobre un corpus actualizado.",
      loadCardCta: "Cargar protocolo",
      tip: "Cada paso del diseñador permite, además, importar piezas sueltas de otro protocolo (solo las variables, solo las pistas, solo las secciones). Nada se reescribe sin necesidad.",
      templatesTitle: "¿Prefieres aprender viendo un ejemplo?",
      templatesCopy:
        "Carga una plantilla precompletada y recorre el diseñador con todo lleno. Es la forma más rápida de entender cómo se ve cada paso en una revisión real.",
      templateLoadCta: "Cargar este ejemplo"
    },
    newProtocol: {
      title: "Diseñador de protocolo",
      eyebrow: "Construye tu protocolo paso a paso",
      copy:
        "Define las dos variables de tu revisión, su taxonomía (jerárquica o plana) y todos los parámetros del pipeline. Puedes guardar tu progreso e importar piezas de otros protocolos en cualquier paso.",
      backToStart: "Volver al inicio",
      stepIndicator: "Paso {current} de {total}",
      stepsLabel: "Pasos del diseñador"
    },
    wizard: {
      firstVisitTitle: "Antes de empezar, 3 cosas útiles:",
      firstVisitAutosave: "Tu progreso se guarda automáticamente en este navegador.",
      firstVisitImport: "Cada paso permite importar piezas sueltas de otro protocolo (sólo variables, sólo pistas, etc.).",
      firstVisitTemplate: "Si prefieres aprender viendo un ejemplo, vuelve al inicio y carga una plantilla.",
      firstVisitDismiss: "Cerrar",
      navPrev: "Paso anterior",
      navNext: "Siguiente paso",
      navFinish: "Finalizar",
      reset: "Reiniciar borrador",
      resetConfirm:
        "Esto borrará todo lo que has llenado en el diseñador. ¿Quieres continuar?",
      draftSaved: "Borrador guardado en tu navegador",
      importJsonLabel: "Importar JSON",
      importJsonHint: "Carga un archivo .json compatible (formato legacy o v2)",
      importError: "No pude leer este archivo",
      importErrorInvalidJson: "El archivo no es JSON válido",
      importErrorUnknownFormat: "No reconozco el formato. Debe tener `entities` o `taxonomy`.",
      importSuccess: "Importado correctamente",
      steps: {
        identity: "Identidad",
        variables: "Variables",
        taxonomy: "Taxonomía",
        cues: "Pistas léxicas",
        sections: "Secciones",
        parameters: "Parámetros",
        summary: "Resumen"
      },
      stepDescriptions: {
        identity:
          "Datos generales del protocolo: nombre, descripción, autor e idioma del corpus.",
        variables:
          "Define las dos variables que vas a relacionar y elige si su lista de términos será plana o jerárquica.",
        taxonomy:
          "Construye o importa la lista de términos a buscar para cada variable, con sus categorías y patrones regex.",
        cues:
          "Listas de términos que ajustan el peso de cada mención: exposición, dosis, asociación, negación y tipo de estudio.",
        sections:
          "Detecta las secciones del artículo (IMRaD) y asigna un peso a cada una.",
        parameters:
          "Ventanas de texto alrededor de cada mención, distancia para relacionar A↔B y parámetros del análisis exploratorio.",
        summary:
          "Revisa todo lo que has configurado y guarda el protocolo como una carpeta reutilizable."
      },
      identity: {
        sectionTitle: "Identidad del protocolo",
        fieldName: "Nombre del protocolo",
        fieldNamePlaceholder: "Ej. Contaminantes y enfermedades neurodegenerativas",
        fieldNameHint: "Visible en los reportes y en el listado de protocolos guardados.",
        fieldDescription: "Descripción breve",
        fieldDescriptionPlaceholder:
          "Ej. Revisión sistemática sobre contaminantes ambientales en agua asociados a enfermedades neurodegenerativas.",
        fieldAuthor: "Autor o equipo",
        fieldAuthorPlaceholder: "Ej. Laboratorio de revisión sistemática, UNAM FESI",
        fieldLanguage: "Idioma principal del corpus",
        fieldLanguageHint:
          "Ayuda al pipeline a priorizar patrones bilingües. Elige bilingüe si tu corpus mezcla idiomas.",
        languageEs: "Español",
        languageEn: "Inglés",
        languageBilingual: "Bilingüe (ES + EN)"
      },
      variables: {
        sectionTitle: "Define tus dos variables",
        sectionCopy:
          "Cada variable es uno de los dos ejes de tu revisión. El pipeline buscará menciones de los términos de la variable A y de la variable B en cada artículo, y construirá relaciones entre ellos cuando aparezcan cerca.",
        variableA: "Variable A",
        variableB: "Variable B",
        fieldDisplayNameEs: "Nombre en español",
        fieldDisplayNameEn: "Nombre en inglés",
        fieldDisplayNamePlaceholderA: "Ej. Contaminantes",
        fieldDisplayNamePlaceholderB: "Ej. Enfermedades",
        fieldMode: "Estructura de la lista",
        modeFlat: "Lista plana",
        modeFlatHint: "Sólo nombres de términos sin categorías. Ideal cuando los elementos no se agrupan jerárquicamente.",
        modeHierarchical: "Lista jerárquica",
        modeHierarchicalHint:
          "Categorías con subcategorías opcionales y términos al final. Ej. Contaminantes → Metales pesados → Plomo."
      },
      taxonomy: {
        sectionTitle: "Construye la taxonomía de cada variable",
        sectionCopy:
          "Agrega los términos que quieres que el pipeline busque en los PDFs. Puedes escribirlos a mano o importar un archivo JSON existente (incluyendo los archivos legacy de `review_miner_contaminants.json` o `review_miner_diseases.json`).",
        importVariableA: "Importar términos de la variable A",
        importVariableB: "Importar términos de la variable B",
        emptyState: "Esta variable todavía no tiene términos.",
        addTerm: "Añadir término",
        addCategory: "Añadir categoría",
        addSubcategory: "Añadir subcategoría",
        addTermHere: "Añadir término aquí",
        deleteNode: "Eliminar",
        moveUp: "Mover arriba",
        moveDown: "Mover abajo",
        kindTerm: "Término",
        kindCategory: "Categoría",
        fieldLabelEs: "Etiqueta en español",
        fieldLabelEn: "Etiqueta en inglés",
        fieldPatterns: "Patrones regex (uno por línea)",
        fieldPatternsHint:
          "Cada patrón se evalúa sin distinguir mayúsculas. Usa `\\b...\\b` para coincidir palabras completas. Ej. `\\bplomo\\b`",
        fieldGeneric: "Término genérico (recibe menos peso)",
        fieldGenericHint:
          "Marca esto para términos amplios como “pesticidas” o “contaminantes orgánicos persistentes”.",
        summaryCategories: "{count} categorías",
        summaryCategoriesSingular: "1 categoría",
        summaryTerms: "{count} términos",
        summaryTermsSingular: "1 término",
        flatModeNotice:
          "Esta variable está en modo plano: sólo se añaden términos. Cambia a modo jerárquico en el paso anterior si necesitas categorías.",
        confirmDelete: "¿Eliminar este nodo y todo lo que contiene?"
      },
      cues: {
        sectionTitle: "Pistas léxicas y tipo de estudio",
        sectionCopy:
          "Estas listas no son términos a buscar, sino palabras que aparecen cerca de las menciones y modifican su peso. Por ejemplo, una mención cerca de una dosis numérica pesa más que una mención aislada.",
        groupScoringTitle: "Pistas que ajustan el peso de cada mención",
        groupScoringCopy:
          "Se aplican al texto que rodea cada mención (ventana definida en el paso de parámetros).",
        groupStudyTitle: "Pistas que clasifican el tipo de estudio",
        groupStudyCopy:
          "Se aplican al título y al inicio del artículo para inferir si es revisión, estudio humano, in vivo o in vitro.",
        resetToDefault: "Restaurar valores por defecto",
        importList: "Importar lista",
        listLineHint: "Un patrón regex por línea. Vacío = familia deshabilitada.",
        listEmptyWarning: "Esta lista está vacía: la familia no contribuirá al puntaje.",
        families: {
          exposure: {
            name: "Exposición",
            description: "Marcadores de exposición: expuesto, tratado, administrado, agua potable…"
          },
          dose: {
            name: "Dosis y concentración",
            description: "Cantidades con unidades: mg/L, µg/L, ppm, ppb, mg/kg…"
          },
          association: {
            name: "Asociación",
            description: "Vínculo entre dos elementos: associated with, riesgo, correlacionado…"
          },
          strongAssociation: {
            name: "Asociación fuerte",
            description:
              "Subconjunto de la asociación que sube la confianza a “fuerte”: significant, odds ratio, hazard ratio…"
          },
          speculative: {
            name: "Lenguaje especulativo",
            description: "Reduce el peso: may, might, podría, sugiere…"
          },
          negation: {
            name: "Negación",
            description: "Anula la asociación: not associated, sin asociación, no significativo…"
          },
          review: {
            name: "Revisión / síntesis",
            description: "Marca artículos de revisión: review, systematic review, metaanálisis…"
          },
          human: {
            name: "Estudio en humanos",
            description: "Población humana: patients, cohort, epidemiological, cohorte…"
          },
          inVivo: {
            name: "Estudio in vivo",
            description: "Modelos animales: mouse, rat, zebrafish, modelo animal…"
          },
          inVitro: {
            name: "Estudio in vitro",
            description: "Cultivos celulares: cell line, sh-sy5y, cultivo celular…"
          }
        }
      },
      sections: {
        sectionTitle: "Detección y peso de las secciones del artículo",
        sectionCopy:
          "El pipeline divide cada artículo en secciones (IMRaD) y asigna un peso a las menciones según en qué sección aparecen. Una mención en métodos pesa más que una en referencias, por ejemplo.",
        profileLabel: "Perfil de pesos",
        profileHint: "Aplica un conjunto de pesos preconstruido. Puedes ajustar después.",
        customLabel: "Personalizado",
        profileBaseline: "Equilibrado (recomendado)",
        profileConservative: "Conservador (más peso a métodos y resultados)",
        profileNeutral: "Neutral (todas las secciones igual)",
        profileCentralOnly: "Sólo secciones centrales",
        weightColumn: "Peso",
        headersColumn: "Patrones de encabezado",
        headersHint:
          "Patrones regex para detectar dónde empieza cada sección. Uno por línea. Acepta banderas estilo (?im) al inicio.",
        names: {
          title: "Título",
          abstract: "Resumen / Abstract",
          introduction: "Introducción",
          methods: "Métodos",
          results: "Resultados",
          discussion: "Discusión",
          conclusion: "Conclusión",
          references: "Referencias",
          other: "Otro / no clasificado"
        },
        notes: {
          title: "El título es la porción inicial antes de la primera sección detectada. No tiene patrón propio.",
          other:
            "Sección por defecto para texto que no entró en ninguna otra. No tiene patrón propio."
        }
      },
      summary: {
        sectionTitle: "Resumen del protocolo",
        sectionCopy:
          "Revisa lo que vas a guardar. Si todo está bien, presiona guardar y la app creará una carpeta reutilizable bajo `config/protocols/`.",
        identityCardTitle: "Identidad",
        variablesCardTitle: "Variables",
        scoringCardTitle: "Pistas léxicas",
        sectionsCardTitle: "Secciones del artículo",
        parametersCardTitle: "Parámetros numéricos",
        saveButton: "Guardar protocolo",
        savingLabel: "Guardando...",
        savedLabel: "Protocolo guardado",
        slugLabel: "Carpeta destino",
        slugHint: "Se deriva del nombre del protocolo. Cámbialo si quieres usar otro identificador.",
        overwriteLabel: "Sobrescribir si ya existe",
        overwriteHint:
          "Si está desmarcado y ya hay un protocolo con el mismo identificador, la app te avisará antes de reemplazarlo.",
        savedFolder: "Carpeta guardada en:",
        savedFiles: "Archivos generados:",
        nextSteps:
          "Ya puedes volver a la pantalla de inicio y cargar este protocolo con tu carpeta de PDFs.",
        errorAlreadyExists:
          "Ya existe un protocolo con ese identificador. Marca “Sobrescribir” para reemplazarlo o cambia el identificador.",
        errorSaveFailed: "No se pudo guardar el protocolo.",
        countCategories: "{count} categorías",
        countCategoriesSingular: "1 categoría",
        countTerms: "{count} términos",
        countTermsSingular: "1 término",
        languageLabel: "Idioma del corpus",
        authorLabel: "Autor",
        descriptionLabel: "Descripción"
      },
      parameters: {
        sectionTitle: "Parámetros del pipeline",
        sectionCopy:
          "Estos números controlan qué tan amplio es el contexto que el pipeline guarda alrededor de cada mención, qué tan lejos pueden estar dos menciones para que cuente como relación, y los parámetros del análisis exploratorio.",
        groupContextTitle: "Ventanas de texto",
        groupContextCopy:
          "Cuánto texto se guarda alrededor de cada mención y cuánto se muestra en concordancias KWIC.",
        groupRelationTitle: "Relaciones entre variables",
        groupRelationCopy:
          "Distancia máxima en caracteres entre una mención de A y una de B para que cuente como relación.",
        groupAnalysisTitle: "Análisis exploratorio",
        groupAnalysisCopy:
          "K-Means y validación manual. Sólo afectan a las visualizaciones avanzadas y a la tabla de validación.",
        fields: {
          contextRadius: {
            label: "Radio de contexto (caracteres)",
            hint: "Caracteres a cada lado de la mención que se guardan como evidencia."
          },
          kwicRadius: {
            label: "Radio KWIC (caracteres)",
            hint: "Caracteres a cada lado de la palabra clave en la concordancia."
          },
          relationDistance: {
            label: "Distancia para relacionar A↔B (caracteres)",
            hint: "Las menciones más allá de esta distancia no formarán una relación, salvo que estén en la misma oración."
          },
          kmeansK: {
            label: "Clústeres K-Means",
            hint: "Número de grupos para el clustering exploratorio de artículos."
          },
          validationSampleSize: {
            label: "Tamaño de muestra para validación manual",
            hint: "Cuántas filas por estrato en las plantillas de validación humana."
          }
        }
      }
    },
    validation: {
      sectionTitle: "Para avanzar te falta:",
      next: "Termina el paso actual para avanzar",
      messages: {
        "identity.name_required": "Necesitas escribir un nombre para el protocolo.",
        "variables.a_name_required": "La variable A necesita un nombre (en español o inglés).",
        "variables.b_name_required": "La variable B necesita un nombre (en español o inglés).",
        "taxonomy.a_needs_terms": "La variable A necesita al menos un término para buscar.",
        "taxonomy.b_needs_terms": "La variable B necesita al menos un término para buscar.",
        "taxonomy.a_incomplete_term":
          "Hay términos de la variable A sin etiqueta o sin patrones regex.",
        "taxonomy.b_incomplete_term":
          "Hay términos de la variable B sin etiqueta o sin patrones regex.",
        "parameters.context_radius_out_of_range":
          "El radio de contexto debe estar dentro del rango permitido.",
        "parameters.kwic_radius_out_of_range":
          "El radio KWIC debe estar dentro del rango permitido.",
        "parameters.relation_distance_out_of_range":
          "La distancia para relacionar A↔B debe estar dentro del rango permitido.",
        "parameters.k_out_of_range":
          "El número de clústeres K-Means debe estar dentro del rango permitido.",
        "parameters.sample_out_of_range":
          "El tamaño de muestra de validación debe estar dentro del rango permitido."
      }
    },
    results: {
      eyebrow: "Resultados",
      title: "Visualizador de evidencia",
      copy:
        "Navega figuras, tablas, documentos Word y paquetes descargables generados por el pipeline. La vista prioriza trazabilidad y revisión manual sobre conclusiones automáticas.",
      protocolBanner: "Protocolo activo en este análisis",
      protocolUnnamed: "(protocolo sin nombre)",
      variableALabel: "Variable A:",
      variableBLabel: "Variable B:",
      folderPanelTitle: "Carpeta de resultados",
      folderPanelHint:
        "Usa la salida más reciente del pipeline o pega una carpeta generada previamente.",
      refreshAction: "Actualizar",
      pathLabel: "Ruta de salida",
      errorTitle: "Error",
      noTablePreview: "Selecciona una tabla para ver su vista previa.",
      metricArticles: "Artículos",
      metricMentions: "Menciones",
      metricRelations: "Relaciones",
      metricFigures: "Figuras",
      tabFigures: "Figuras",
      tabTables: "Tablas",
      tabReports: "Reportes",
      tabJson: "JSON",
      downloadImage: "Descargar imagen",
      downloadTable: "Descargar",
      downloadReport: "Descargar Word",
      downloadJson: "Descargar JSON",
      noFigures: "Aún no hay figuras en esta carpeta.",
      noTables: "Aún no hay tablas en esta carpeta.",
      noReports: "Aún no hay reportes en esta carpeta.",
      noJson: "Aún no hay archivos JSON en esta carpeta.",
      kind: {
        figure: "Figura",
        table: "Tabla",
        report: "Reporte",
        package: "Paquete",
        json: "JSON",
        other: "Archivo"
      }
    },
    loadProtocol: {
      title: "Cargar protocolo existente",
      eyebrow: "Reutiliza una revisión guardada",
      copy:
        "Selecciona uno de los protocolos guardados localmente. Puedes editarlo en el diseñador o ejecutarlo directamente con tu carpeta de PDFs.",
      backToStart: "Volver al inicio",
      emptyTitle: "Aún no hay protocolos guardados",
      emptyCopy:
        "Cuando guardes un protocolo desde el diseñador aparecerá aquí.",
      designNewCta: "Diseñar uno nuevo",
      loading: "Buscando protocolos...",
      loadError: "No pude listar los protocolos guardados.",
      editAction: "Editar en el diseñador",
      runAction: "Ejecutar con este protocolo",
      loading_one: "Cargando protocolo...",
      loadOneError: "No pude leer este protocolo.",
      loadedToast: "Protocolo cargado en el diseñador",
      authorPrefix: "Autor:",
      savedAtPrefix: "Guardado:",
      warningsTitle: "Avisos al cargar:",
      slugPrefix: "Carpeta:"
    },
    execute: {
      eyebrow: "Ejecución del pipeline",
      title: "Ejecutar con esta revisión",
      copy:
        "Selecciona la carpeta con tus PDFs y, opcionalmente, una carpeta de salida. La app correrá el pipeline completo con la configuración de este protocolo y te llevará a los resultados al terminar.",
      backToLoad: "Volver al listado",
      protocolHeaderEyebrow: "Protocolo activo",
      protocolHeaderEmpty: "(protocolo sin nombre)",
      variableLabel: "Variable",
      termsCount: "{count} términos",
      termsCountSingular: "1 término",
      paramSummary: "Contexto {context} caracteres · Distancia A↔B {relation} caracteres · K-Means k={k}",
      inputFolderLabel: "Carpeta con PDFs",
      inputFolderPlaceholder: "Ej. /Users/.../Articulos",
      inputFolderHint:
        "Apunta a la carpeta local donde están los PDFs que quieres analizar. Solo se procesan archivos .pdf, .txt y .md.",
      outputFolderLabel: "Carpeta de salida (opcional)",
      outputFolderPlaceholder: "Por defecto: outputs/webapp_runs/<timestamp>",
      outputFolderHint:
        "Déjala vacía para que la app cree una nueva carpeta con marca de tiempo.",
      metadataLabel: "Archivos de metadatos (opcional)",
      metadataPlaceholder: "ArticulosTotales.xlsx,Base de articulos completa.xlsx",
      metadataHint:
        "Rutas a uno o varios archivos CSV/XLSX con metadatos (título, año, DOI, tipo de estudio).",
      skipAdvancedLabel: "Omitir K-Means y figuras avanzadas",
      skipAdvancedHint:
        "Útil cuando solo quieres las tablas básicas y el reporte; ahorra un par de minutos en corpus grandes.",
      runButton: "Ejecutar pipeline",
      runButtonBusy: "Iniciando...",
      runError: "No pude iniciar el pipeline.",
      runStartedTitle: "Pipeline en ejecución",
      stepsTitle: "Progreso por paso",
      logsTitle: "Registro en vivo",
      noLogs: "Aún no hay registros.",
      viewResultsCta: "Ver resultados",
      downloadReportCta: "Descargar reporte Word",
      downloadPackageCta: "Descargar paquete ZIP",
      jobIdLabel: "ID de ejecución",
      missingInput: "Indica la carpeta con tus PDFs antes de ejecutar.",
      protocolLoadFailed: "No se pudo cargar la información del protocolo.",
      statusQueued: "En cola",
      statusRunning: "En ejecución",
      statusCompleted: "Completado",
      statusFailed: "Fallido",
      stepValidateLabel: "Validación del corpus",
      stepPipelineLabel: "Minería y análisis contextual",
      stepReportLabel: "Reporte Word",
      stepPackageLabel: "Paquete descargable",
      stepStatusPending: "Pendiente",
      stepStatusRunning: "Ejecutando",
      stepStatusCompleted: "Listo",
      stepStatusFailed: "Falló"
    }
  },
  en: {
    common: {
      brand: "NEXO",
      tagline: "Data mining for literature reviews.",
      back: "Back",
      next: "Next",
      cancel: "Cancel",
      save: "Save",
      load: "Load",
      loading: "Loading...",
      languageLabel: "Language",
      languageToggleAria: "Change interface language"
    },
    nav: {
      method: "Method",
      results: "Results",
      start: "Get started",
      primaryAriaLabel: "Primary navigation"
    },
    landing: {
      eyebrow: "Systematic review, literature mining and traceable evidence",
      heroTitlePrefix: "From PDFs to",
      heroTitleEmphasis: "auditable evidence",
      heroCopy:
        "A local-first interface to run the literature mining pipeline: review scientific PDFs, extract auditable mentions, explore textual associations, and prepare outputs ready for tables, figures and reports.",
      heroMetaLocal: "Local-first",
      heroMetaVariables: "Variable A ↔ Variable B",
      heroMetaEvidence: "PRISMA · textual evidence",
      heroMetaOutputs: ".docx + .csv + .zip",
      ctaStart: "Start a review",
      ctaResults: "View existing results",
      heroImageAlt: "Real visualization generated by the pipeline",
      methodEyebrow: "PRISMA + textual evidence",
      methodTitle: "From PDFs to auditable results",
      methodCopy:
        "The app wraps a Python pipeline to turn articles into tables, figures, JSON files, visual analytics and a Word report with methodological caveats.",
      cardCorpusTitle: "Scientific corpus",
      cardCorpusCopy:
        "Processes local folders with PDFs, TXT or MD files and preserves metadata such as title, year, DOI and extraction status.",
      cardExtractTitle: "Contextual extraction",
      cardExtractCopy:
        "Detects your two study variables, article sections and cues for exposure, association, dose and negation.",
      cardVisualTitle: "Scientific visualization",
      cardVisualCopy:
        "Exposes SVG figures, matrices, networks, validation tables and summaries for manual auditing.",
      privacyEyebrow: "Local-first architecture",
      privacyTitle: "Privacy before false convenience",
      privacyCopy:
        "Vercel can host the interface, but a browser deployed in the cloud cannot freely read your local folders. To protect private PDFs, the actual processing runs on your machine through the Next.js local backend.",
      badgeLocal: "Local",
      badgeLocalCopy: "Folder reading and Python pipeline execution on your machine.",
      badgeTraceable: "Traceable",
      badgeTraceableCopy: "Every relation keeps its textual evidence and confidence level.",
      badgeDownloadable: "Downloadable",
      badgeDownloadableCopy: "Tables, images, JSON, Word and ZIP packages from the results view.",
      outputsTitle: "Expected outputs",
      outputsCopy:
        "Outputs are designed to build a systematic review: auditable tables, figures, manual validation templates and descriptive documents without promising causality."
    },
    footer: {
      eyebrow: "Assisted systematic review",
      title: "Auditable mining, human reading at the center",
      copy:
        "The app distinguishes mentions, co-occurrences and textual associations. It does not claim causality nor replace critical evaluation of the articles.",
      cta: "Start a review"
    },
    method: {
      eyebrow: "How NEXO works",
      title: "The method, step by step",
      copy:
        "The pipeline applies auditable rules over controlled lexicons. Every label is tied to a textual fragment the reviewer can re-read and verify. Here are the pieces that make up the process.",
      backToStart: "Back to start",
      diagramTitle: "The pipeline in six stages",
      diagramCopy:
        "Every stage produces a traceable artifact. A mention is not an association; a co-occurrence is not causality.",
      stages: [
        {
          title: "1. Corpus reading",
          desc: "PDFs, TXT or MD are converted to text and matched against metadata (title, year, DOI, study type)."
        },
        {
          title: "2. Section detection",
          desc: "IMRaD patterns identify abstract, introduction, methods, results, discussion and references."
        },
        {
          title: "3. Mention extraction",
          desc: "Protocol terms are matched with bilingual regex. Every hit stores context, sentence, section and page."
        },
        {
          title: "4. Lexical cues",
          desc: "Cues near each mention (exposure, dose, association, speculation, negation) adjust its weight."
        },
        {
          title: "5. Role classification",
          desc: "Each entity per article receives a role: primary focus, secondary, contextual, bibliographic or review-only."
        },
        {
          title: "6. A↔B relation",
          desc: "When A and B appear close enough, a relation is emitted with textual evidence, strength and confidence."
        }
      ],
      glossaryTitle: "Quick glossary",
      glossary: [
        {
          term: "Variable A / Variable B",
          desc: "The two axes of your review. Could be contaminants/diseases, drugs/effects, etc."
        },
        {
          term: "Protocol",
          desc: "Folder with every decision of your review: variables, cues, per-section weights, numeric parameters."
        },
        {
          term: "Mention",
          desc: "An exact match of a term in an article, with section and context preserved."
        },
        {
          term: "Cue",
          desc: "Keyword that raises or lowers a mention's weight (dose, association, speculation, negation)."
        },
        {
          term: "Role",
          desc: "How an entity shows up: primary focus, secondary variable, contextual mention or bibliographic."
        },
        {
          term: "Association",
          desc: "Label of the A↔B relation: strong, weak, speculative or insufficient evidence."
        },
        {
          term: "Confidence",
          desc: "Aggregated level (high/medium/low) combining score, section and cues from the evidence."
        },
        {
          term: "Textual evidence",
          desc: "The fragment of the PDF where the association appears. Exported for manual auditing."
        }
      ],
      outputsTitle: "What you'll see in the end",
      outputItems: [
        {
          title: "Auditable tables",
          desc: "CSV/XLSX with articles, mentions, entity summaries, relations and the systematic-review table."
        },
        {
          title: "Vector figures",
          desc: "SVGs for frequency, category heatmap, bipartite network, bubbles and exploratory K-Means map."
        },
        {
          title: "Word report + ZIP package",
          desc: "Document with executive summary, method and references; downloadable package with everything."
        }
      ],
      ctaStart: "Design my protocol",
      ctaViewResults: "View sample results"
    },
    start: {
      eyebrow: "Step 1 of your review",
      title: "How do you want to start?",
      copy:
        "A protocol stores every decision in your review: the two variables you are looking for, their terms and categories, context windows, lexical cues, per-section weights and analysis parameters. You can design a new one or load one you saved earlier.",
      newCardEyebrow: "Start from scratch",
      newCardTitle: "Design a new protocol",
      newCardCopy:
        "We guide you step by step to define your two variables, their terms, lexical cues and analysis parameters. At the end you can save the protocol as a reusable folder.",
      newCardCta: "Create protocol",
      loadCardEyebrow: "Continue an existing review",
      loadCardTitle: "Load a saved protocol",
      loadCardCopy:
        "If you already have a protocol folder, load it and just pick the folder with your PDFs to re-run the extraction on an updated corpus.",
      loadCardCta: "Load protocol",
      tip: "Every step of the designer also lets you import individual pieces from another protocol (only the variables, only the cues, only the sections). Nothing gets rewritten unnecessarily.",
      templatesTitle: "Prefer to learn by example?",
      templatesCopy:
        "Load a pre-filled template and walk through the designer with everything populated. It's the fastest way to see what each step looks like for a real review.",
      templateLoadCta: "Load this example"
    },
    newProtocol: {
      title: "Protocol designer",
      eyebrow: "Build your protocol step by step",
      copy:
        "Define the two variables of your review, their hierarchical or flat taxonomy, and every pipeline parameter. You can save your progress and import pieces from other protocols at any step.",
      backToStart: "Back to start",
      stepIndicator: "Step {current} of {total}",
      stepsLabel: "Designer steps"
    },
    wizard: {
      firstVisitTitle: "Before you start, 3 useful things:",
      firstVisitAutosave: "Your progress is saved automatically in this browser.",
      firstVisitImport: "Every step lets you import individual pieces from another protocol (only variables, only cues, etc.).",
      firstVisitTemplate: "If you prefer to learn by example, go back to the start and load a template.",
      firstVisitDismiss: "Dismiss",
      navPrev: "Previous step",
      navNext: "Next step",
      navFinish: "Finish",
      reset: "Reset draft",
      resetConfirm:
        "This will erase everything you have filled in the designer. Do you want to continue?",
      draftSaved: "Draft saved in your browser",
      importJsonLabel: "Import JSON",
      importJsonHint: "Load a compatible .json file (legacy or v2 format)",
      importError: "I could not read this file",
      importErrorInvalidJson: "The file is not valid JSON",
      importErrorUnknownFormat: "Unknown format. The file must have `entities` or `taxonomy`.",
      importSuccess: "Imported successfully",
      steps: {
        identity: "Identity",
        variables: "Variables",
        taxonomy: "Taxonomy",
        cues: "Lexical cues",
        sections: "Sections",
        parameters: "Parameters",
        summary: "Summary"
      },
      stepDescriptions: {
        identity:
          "General metadata for the protocol: name, description, author and corpus language.",
        variables:
          "Define the two variables you will relate and choose whether their term list is flat or hierarchical.",
        taxonomy:
          "Build or import the list of terms the pipeline will search for, with their categories and regex patterns.",
        cues:
          "Term lists that adjust each mention's weight: exposure, dose, association, negation and study type.",
        sections:
          "Detect article sections (IMRaD) and assign a weight to each one.",
        parameters:
          "Text windows around each mention, distance for relating A↔B, and exploratory analysis parameters.",
        summary:
          "Review everything you configured and save the protocol as a reusable folder."
      },
      identity: {
        sectionTitle: "Protocol identity",
        fieldName: "Protocol name",
        fieldNamePlaceholder: "e.g. Contaminants and neurodegenerative diseases",
        fieldNameHint: "Visible in reports and in your list of saved protocols.",
        fieldDescription: "Short description",
        fieldDescriptionPlaceholder:
          "e.g. Systematic review on environmental water contaminants associated with neurodegenerative diseases.",
        fieldAuthor: "Author or team",
        fieldAuthorPlaceholder: "e.g. Systematic review lab, UNAM FESI",
        fieldLanguage: "Primary corpus language",
        fieldLanguageHint:
          "Helps the pipeline prioritise bilingual patterns. Choose bilingual if your corpus mixes languages.",
        languageEs: "Spanish",
        languageEn: "English",
        languageBilingual: "Bilingual (ES + EN)"
      },
      variables: {
        sectionTitle: "Define your two variables",
        sectionCopy:
          "Each variable is one axis of your review. The pipeline will search for mentions of the variable A and variable B terms in every article and build relationships between them when they appear close to each other.",
        variableA: "Variable A",
        variableB: "Variable B",
        fieldDisplayNameEs: "Name in Spanish",
        fieldDisplayNameEn: "Name in English",
        fieldDisplayNamePlaceholderA: "e.g. Contaminants",
        fieldDisplayNamePlaceholderB: "e.g. Diseases",
        fieldMode: "List structure",
        modeFlat: "Flat list",
        modeFlatHint: "Only term names, no categories. Ideal when items don't group hierarchically.",
        modeHierarchical: "Hierarchical list",
        modeHierarchicalHint:
          "Categories with optional subcategories and terms at the leaves. e.g. Contaminants → Heavy metals → Lead."
      },
      taxonomy: {
        sectionTitle: "Build the taxonomy of each variable",
        sectionCopy:
          "Add the terms the pipeline should search for in PDFs. You can type them manually or import an existing JSON file (including the legacy `review_miner_contaminants.json` or `review_miner_diseases.json`).",
        importVariableA: "Import variable A terms",
        importVariableB: "Import variable B terms",
        emptyState: "This variable has no terms yet.",
        addTerm: "Add term",
        addCategory: "Add category",
        addSubcategory: "Add subcategory",
        addTermHere: "Add term here",
        deleteNode: "Delete",
        moveUp: "Move up",
        moveDown: "Move down",
        kindTerm: "Term",
        kindCategory: "Category",
        fieldLabelEs: "Spanish label",
        fieldLabelEn: "English label",
        fieldPatterns: "Regex patterns (one per line)",
        fieldPatternsHint:
          "Patterns are evaluated case-insensitively. Use `\\b...\\b` to match whole words. e.g. `\\blead\\b`",
        fieldGeneric: "Generic term (gets less weight)",
        fieldGenericHint:
          "Tick this for broad terms like “pesticides” or “persistent organic pollutants”.",
        summaryCategories: "{count} categories",
        summaryCategoriesSingular: "1 category",
        summaryTerms: "{count} terms",
        summaryTermsSingular: "1 term",
        flatModeNotice:
          "This variable is in flat mode: only terms are allowed. Switch to hierarchical mode in the previous step if you need categories.",
        confirmDelete: "Delete this node and everything inside it?"
      },
      cues: {
        sectionTitle: "Lexical cues and study type",
        sectionCopy:
          "These lists are not terms to search for, but words that appear near each mention and modify its weight. A mention next to a numeric dose, for example, weighs more than an isolated one.",
        groupScoringTitle: "Cues that adjust each mention's weight",
        groupScoringCopy:
          "Applied to the text around each mention (window defined in the parameters step).",
        groupStudyTitle: "Cues that classify the study type",
        groupStudyCopy:
          "Applied to the title and beginning of the article to infer whether it is a review, human, in vivo or in vitro study.",
        resetToDefault: "Restore defaults",
        importList: "Import list",
        listLineHint: "One regex pattern per line. Empty = family disabled.",
        listEmptyWarning: "This list is empty: the family will not contribute to the score.",
        families: {
          exposure: {
            name: "Exposure",
            description: "Exposure markers: exposed, treated, administered, drinking water…"
          },
          dose: {
            name: "Dose and concentration",
            description: "Quantities with units: mg/L, µg/L, ppm, ppb, mg/kg…"
          },
          association: {
            name: "Association",
            description: "Link between two items: associated with, risk, correlated…"
          },
          strongAssociation: {
            name: "Strong association",
            description:
              "Subset of association that bumps confidence to “strong”: significant, odds ratio, hazard ratio…"
          },
          speculative: {
            name: "Speculative language",
            description: "Lowers the weight: may, might, could, suggests…"
          },
          negation: {
            name: "Negation",
            description: "Cancels the association: not associated, no association, not significant…"
          },
          review: {
            name: "Review / synthesis",
            description: "Marks review articles: review, systematic review, meta-analysis…"
          },
          human: {
            name: "Human study",
            description: "Human population: patients, cohort, epidemiological…"
          },
          inVivo: {
            name: "In vivo study",
            description: "Animal models: mouse, rat, zebrafish, animal model…"
          },
          inVitro: {
            name: "In vitro study",
            description: "Cell cultures: cell line, sh-sy5y, cell culture…"
          }
        }
      },
      sections: {
        sectionTitle: "Article section detection and weights",
        sectionCopy:
          "The pipeline splits every article into sections (IMRaD) and weighs mentions depending on which section they live in. A mention in methods weighs more than one in references, for example.",
        profileLabel: "Weight profile",
        profileHint: "Apply a prebuilt set of weights. You can tweak it afterwards.",
        customLabel: "Custom",
        profileBaseline: "Balanced (recommended)",
        profileConservative: "Conservative (more weight on methods and results)",
        profileNeutral: "Neutral (every section equal)",
        profileCentralOnly: "Central sections only",
        weightColumn: "Weight",
        headersColumn: "Header patterns",
        headersHint:
          "Regex patterns to detect where each section starts. One per line. Supports (?im) flags at the start.",
        names: {
          title: "Title",
          abstract: "Abstract",
          introduction: "Introduction",
          methods: "Methods",
          results: "Results",
          discussion: "Discussion",
          conclusion: "Conclusion",
          references: "References",
          other: "Other / unclassified"
        },
        notes: {
          title:
            "The title is the initial portion before the first detected section. It has no header pattern.",
          other:
            "Default bucket for text that did not fall into any other section. It has no header pattern."
        }
      },
      summary: {
        sectionTitle: "Protocol summary",
        sectionCopy:
          "Review what you are about to save. If everything looks good, hit save and the app will create a reusable folder under `config/protocols/`.",
        identityCardTitle: "Identity",
        variablesCardTitle: "Variables",
        scoringCardTitle: "Lexical cues",
        sectionsCardTitle: "Article sections",
        parametersCardTitle: "Numeric parameters",
        saveButton: "Save protocol",
        savingLabel: "Saving...",
        savedLabel: "Protocol saved",
        slugLabel: "Destination folder",
        slugHint:
          "Derived from the protocol name. Change it if you want to use a different identifier.",
        overwriteLabel: "Overwrite if it already exists",
        overwriteHint:
          "If unchecked and a protocol with the same identifier already exists, the app will warn you before replacing it.",
        savedFolder: "Folder written to:",
        savedFiles: "Files written:",
        nextSteps:
          "You can now go back to the start screen and load this protocol with your PDF folder.",
        errorAlreadyExists:
          "A protocol with that identifier already exists. Tick “Overwrite” to replace it, or change the identifier.",
        errorSaveFailed: "Could not save the protocol.",
        countCategories: "{count} categories",
        countCategoriesSingular: "1 category",
        countTerms: "{count} terms",
        countTermsSingular: "1 term",
        languageLabel: "Corpus language",
        authorLabel: "Author",
        descriptionLabel: "Description"
      },
      parameters: {
        sectionTitle: "Pipeline parameters",
        sectionCopy:
          "These numbers control how much context the pipeline keeps around each mention, how far apart two mentions can be to count as a relation, and the parameters of the exploratory analysis.",
        groupContextTitle: "Text windows",
        groupContextCopy:
          "How much text is stored around each mention and shown in KWIC concordances.",
        groupRelationTitle: "Variable relationships",
        groupRelationCopy:
          "Maximum character distance between a Variable A and a Variable B mention for the pair to count as a relation.",
        groupAnalysisTitle: "Exploratory analysis",
        groupAnalysisCopy:
          "K-Means and manual validation. Only affect the advanced visualizations and the validation tables.",
        fields: {
          contextRadius: {
            label: "Context radius (characters)",
            hint: "Characters on each side of the mention stored as evidence."
          },
          kwicRadius: {
            label: "KWIC radius (characters)",
            hint: "Characters on each side of the keyword in the concordance."
          },
          relationDistance: {
            label: "Distance to relate A↔B (characters)",
            hint: "Mentions farther apart than this won't form a relation, unless they share the same sentence."
          },
          kmeansK: {
            label: "K-Means clusters",
            hint: "Number of groups for the exploratory clustering of articles."
          },
          validationSampleSize: {
            label: "Manual validation sample size",
            hint: "Rows per stratum in the human validation templates."
          }
        }
      }
    },
    validation: {
      sectionTitle: "To move on you still need to:",
      next: "Finish the current step to continue",
      messages: {
        "identity.name_required": "Please give the protocol a name.",
        "variables.a_name_required": "Variable A needs a name (in Spanish or English).",
        "variables.b_name_required": "Variable B needs a name (in Spanish or English).",
        "taxonomy.a_needs_terms": "Variable A needs at least one term to search for.",
        "taxonomy.b_needs_terms": "Variable B needs at least one term to search for.",
        "taxonomy.a_incomplete_term":
          "Some Variable A terms have no label or no regex patterns.",
        "taxonomy.b_incomplete_term":
          "Some Variable B terms have no label or no regex patterns.",
        "parameters.context_radius_out_of_range":
          "The context radius must be inside the allowed range.",
        "parameters.kwic_radius_out_of_range":
          "The KWIC radius must be inside the allowed range.",
        "parameters.relation_distance_out_of_range":
          "The A↔B relation distance must be inside the allowed range.",
        "parameters.k_out_of_range":
          "The K-Means cluster count must be inside the allowed range.",
        "parameters.sample_out_of_range":
          "The validation sample size must be inside the allowed range."
      }
    },
    results: {
      eyebrow: "Results",
      title: "Evidence viewer",
      copy:
        "Browse figures, tables, Word documents and downloadable packages generated by the pipeline. The view prioritises traceability and manual review over automatic conclusions.",
      protocolBanner: "Active protocol in this analysis",
      protocolUnnamed: "(unnamed protocol)",
      variableALabel: "Variable A:",
      variableBLabel: "Variable B:",
      folderPanelTitle: "Results folder",
      folderPanelHint:
        "Use the most recent pipeline output or paste a previously generated folder.",
      refreshAction: "Refresh",
      pathLabel: "Output path",
      errorTitle: "Error",
      noTablePreview: "Select a table to preview it.",
      metricArticles: "Articles",
      metricMentions: "Mentions",
      metricRelations: "Relations",
      metricFigures: "Figures",
      tabFigures: "Figures",
      tabTables: "Tables",
      tabReports: "Reports",
      tabJson: "JSON",
      downloadImage: "Download image",
      downloadTable: "Download",
      downloadReport: "Download Word",
      downloadJson: "Download JSON",
      noFigures: "No figures in this folder yet.",
      noTables: "No tables in this folder yet.",
      noReports: "No reports in this folder yet.",
      noJson: "No JSON files in this folder yet.",
      kind: {
        figure: "Figure",
        table: "Table",
        report: "Report",
        package: "Package",
        json: "JSON",
        other: "File"
      }
    },
    loadProtocol: {
      title: "Load existing protocol",
      eyebrow: "Reuse a saved review",
      copy:
        "Pick one of the protocols stored locally. You can either edit it in the designer or run it directly against your PDF folder.",
      backToStart: "Back to start",
      emptyTitle: "No saved protocols yet",
      emptyCopy:
        "Once you save a protocol from the designer it will appear here.",
      designNewCta: "Design a new one",
      loading: "Looking for protocols...",
      loadError: "Could not list saved protocols.",
      editAction: "Edit in the designer",
      runAction: "Run with this protocol",
      loading_one: "Loading protocol...",
      loadOneError: "Could not read this protocol.",
      loadedToast: "Protocol loaded into the designer",
      authorPrefix: "Author:",
      savedAtPrefix: "Saved:",
      warningsTitle: "Warnings on load:",
      slugPrefix: "Folder:"
    },
    execute: {
      eyebrow: "Pipeline execution",
      title: "Run this review",
      copy:
        "Pick the folder with your PDFs and, optionally, an output folder. The app will run the full pipeline with this protocol's configuration and take you to the results when it's done.",
      backToLoad: "Back to the list",
      protocolHeaderEyebrow: "Active protocol",
      protocolHeaderEmpty: "(unnamed protocol)",
      variableLabel: "Variable",
      termsCount: "{count} terms",
      termsCountSingular: "1 term",
      paramSummary: "Context {context} characters · A↔B distance {relation} characters · K-Means k={k}",
      inputFolderLabel: "PDF folder",
      inputFolderPlaceholder: "e.g. /Users/.../Articulos",
      inputFolderHint:
        "Point to the local folder where your PDFs live. Only .pdf, .txt and .md files are processed.",
      outputFolderLabel: "Output folder (optional)",
      outputFolderPlaceholder: "Defaults to outputs/webapp_runs/<timestamp>",
      outputFolderHint:
        "Leave blank to let the app create a fresh timestamped folder.",
      metadataLabel: "Metadata files (optional)",
      metadataPlaceholder: "ArticulosTotales.xlsx,Base de articulos completa.xlsx",
      metadataHint:
        "Paths to one or more CSV/XLSX files with article metadata (title, year, DOI, study type).",
      skipAdvancedLabel: "Skip K-Means and advanced figures",
      skipAdvancedHint:
        "Useful when you only need the basic tables and the report; saves a couple of minutes on large corpora.",
      runButton: "Run pipeline",
      runButtonBusy: "Starting...",
      runError: "Could not start the pipeline.",
      runStartedTitle: "Pipeline running",
      stepsTitle: "Per-step progress",
      logsTitle: "Live log",
      noLogs: "No logs yet.",
      viewResultsCta: "View results",
      downloadReportCta: "Download Word report",
      downloadPackageCta: "Download ZIP package",
      jobIdLabel: "Run ID",
      missingInput: "Set the PDF folder before running.",
      protocolLoadFailed: "Could not load the protocol summary.",
      statusQueued: "Queued",
      statusRunning: "Running",
      statusCompleted: "Completed",
      statusFailed: "Failed",
      stepValidateLabel: "Corpus validation",
      stepPipelineLabel: "Mining and contextual analysis",
      stepReportLabel: "Word report",
      stepPackageLabel: "Downloadable package",
      stepStatusPending: "Pending",
      stepStatusRunning: "Running",
      stepStatusCompleted: "Done",
      stepStatusFailed: "Failed"
    }
  }
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
