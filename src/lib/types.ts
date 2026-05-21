export type PipelineStepStatus = "pending" | "running" | "completed" | "failed";

export type PipelineStep = {
  id: string;
  label: string;
  detail: string;
  status: PipelineStepStatus;
};

export type PipelineJobStatus = "queued" | "running" | "completed" | "failed";

export type PipelineJob = {
  id: string;
  status: PipelineJobStatus;
  createdAt: string;
  updatedAt: string;
  inputDir: string;
  outputDir: string;
  metadata: string;
  steps: PipelineStep[];
  logs: string[];
  error?: string;
  packagePath?: string;
  reportPath?: string;
  /** Protocol slug under config/protocols/. Set when the job uses the new generic pipeline. */
  protocolSlug?: string;
  /** Absolute path to the protocol folder, for display in the runner UI. */
  protocolPath?: string;
};

export type ScanFile = {
  name: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
};

export type ScanResult = {
  inputDir: string;
  totalFiles: number;
  pdfFiles: ScanFile[];
  rejectedFiles: ScanFile[];
};

export type ResultFile = {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  kind: "figure" | "table" | "report" | "package" | "json" | "other";
  description: string;
};

export type ResultsProtocolInfo = {
  /** Protocol name as defined in identity. Empty when the run was not protocol-driven. */
  name: string;
  /** Display label for Variable A — populated by the protocol-driven pipeline. */
  variableA: string;
  /** Display label for Variable B. */
  variableB: string;
};

export type ResultsSummary = {
  outputDir: string;
  generatedAt?: string;
  /** Present when the output folder carries a protocol-stamped JSON. */
  protocol?: ResultsProtocolInfo;
  metrics: {
    articles: number;
    extractableArticles: number;
    mentions: number;
    relations: number;
    figures: number;
    tables: number;
  };
  figures: ResultFile[];
  tables: ResultFile[];
  reports: ResultFile[];
  packages: ResultFile[];
  jsonFiles: ResultFile[];
};

export type TablePreview = {
  file: string;
  headers: string[];
  rows: Record<string, string>[];
};

export type LexiconEntityDraft = {
  id: string;
  label_es: string;
  label_en: string;
  category: string;
  type?: string;
  subtype?: string;
  subsubtype?: string;
  generic?: boolean;
  patterns: string[];
};

export type LexiconDocument = {
  version: string;
  description: string;
  entities: LexiconEntityDraft[];
};

export type ReviewProtocol = {
  version: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  inputDir: string;
  outputDir: string;
  metadata: string;
  contaminantsLexiconPath: string;
  diseasesLexiconPath: string;
  contaminantsLexicon?: LexiconDocument;
  diseasesLexicon?: LexiconDocument;
  parameters: {
    contextRadius: number;
    kwicRadius: number;
    relationDistance: number;
    k: number;
    sampleSize: number;
    runAdvancedVisuals: boolean;
  };
};
