import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { PipelineJob, PipelineStep } from "@/lib/types";
import { getJobStore, saveJob } from "./jobs";
import {
  assertLocalProcessingAllowed,
  createRunOutputDir,
  DEFAULT_CONTAMINANTS,
  DEFAULT_DISEASES,
  DEFAULT_INPUT_DIR,
  DEFAULT_METADATA,
  DEFAULT_PROTOCOLS_DIR,
  PROJECT_ROOT,
  resolveUserPath
} from "./project";

type StartPipelineInput = {
  inputDir?: string;
  outputDir?: string;
  metadata?: string;
  contaminants?: string;
  diseases?: string;
  k?: number;
  sampleSize?: number;
  kwicRadius?: number;
  contextRadius?: number;
  relationDistance?: number;
  runAdvancedVisuals?: boolean;
};

const STEP_TEMPLATE: PipelineStep[] = [
  {
    id: "validate",
    label: "Validacion del corpus",
    detail: "Revisa carpeta, PDFs y rutas de salida.",
    status: "pending"
  },
  {
    id: "pipeline",
    label: "Mineria y analisis contextual",
    detail: "Ejecuta el pipeline publicable de review_miner.",
    status: "pending"
  },
  {
    id: "report",
    label: "Reporte Word",
    detail: "Crea un documento con resumen, metodo y referencias a figuras.",
    status: "pending"
  },
  {
    id: "package",
    label: "Paquete descargable",
    detail: "Comprime tablas, figuras, JSON y reporte.",
    status: "pending"
  }
];

function createJob(input: StartPipelineInput): PipelineJob {
  const id = crypto.randomUUID();
  const outputDir = resolveUserPath(input.outputDir, createRunOutputDir());
  const inputDir = resolveUserPath(input.inputDir, DEFAULT_INPUT_DIR);
  const metadata = input.metadata?.trim() || DEFAULT_METADATA;
  const now = new Date().toISOString();
  return {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    inputDir,
    outputDir,
    metadata,
    steps: STEP_TEMPLATE.map((step) => ({ ...step })),
    logs: []
  };
}

function setStep(job: PipelineJob, id: string, status: PipelineStep["status"], detail?: string) {
  job.steps = job.steps.map((step) => (step.id === id ? { ...step, status, detail: detail || step.detail } : step));
  saveJob(job);
}

function log(job: PipelineJob, message: string) {
  job.logs = [...job.logs, `[${new Date().toLocaleTimeString("es-MX")}] ${message}`].slice(-500);
  saveJob(job);
}

async function runCommand(
  job: PipelineJob,
  label: string,
  command: string,
  args: string[],
  options: { cwd?: string } = {}
) {
  log(job, `${label}: ${command} ${args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ")}`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || PROJECT_ROOT,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
        log(job, line);
      }
    });
    child.stderr.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
        log(job, line);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} termino con codigo ${code}.`));
    });
  });
}

async function packageOutput(job: PipelineJob) {
  const packageDir = path.join(job.outputDir, "_package");
  await fs.mkdir(packageDir, { recursive: true });
  const packagePath = path.join(packageDir, "nexo_analysis.zip");
  await fs.rm(packagePath, { force: true });
  await runCommand(job, "Compresion", "zip", ["-qr", packagePath, ".", "-x", "_package/*"], {
    cwd: job.outputDir
  });
  job.packagePath = packagePath;
  saveJob(job);
}

async function executePipeline(job: PipelineJob, input: StartPipelineInput) {
  try {
    job.status = "running";
    saveJob(job);

    setStep(job, "validate", "running");
    const stat = await fs.stat(job.inputDir);
    if (!stat.isDirectory()) {
      throw new Error("La ruta de entrada no es una carpeta.");
    }
    await fs.mkdir(job.outputDir, { recursive: true });
    setStep(job, "validate", "completed", `Corpus: ${job.inputDir}`);
    log(job, `Salida: ${job.outputDir}`);

    setStep(job, "pipeline", "running");
    const python = process.env.PYTHON_BIN || "python3";
    const args = [
      "pipeline_publicable/run_pipeline_publicable.py",
      "--input-dir",
      job.inputDir,
      "--output-dir",
      job.outputDir,
      "--metadata",
      job.metadata,
      "--contaminants",
      resolveUserPath(input.contaminants, DEFAULT_CONTAMINANTS),
      "--diseases",
      resolveUserPath(input.diseases, DEFAULT_DISEASES),
      "--k",
      String(input.k || 4),
      "--sample-size",
      String(input.sampleSize || 200),
      "--kwic-radius",
      String(input.kwicRadius || 160),
      "--context-radius",
      String(input.contextRadius || 260),
      "--relation-distance",
      String(input.relationDistance || 900)
    ];
    if (input.runAdvancedVisuals === false) {
      args.push("--skip-advanced-visuals");
    }
    await runCommand(job, "Pipeline", python, args);
    setStep(job, "pipeline", "completed");

    setStep(job, "report", "running");
    await runCommand(job, "Reporte", python, ["scripts/generate_review_report.py", "--output-dir", job.outputDir]);
    job.reportPath = path.join(job.outputDir, "reporte_revision_nexo.docx");
    setStep(job, "report", "completed");

    setStep(job, "package", "running");
    await packageOutput(job);
    setStep(job, "package", "completed");

    job.status = "completed";
    log(job, "Analisis terminado correctamente.");
    saveJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    job.status = "failed";
    job.error = message;
    const running = job.steps.find((step) => step.status === "running");
    if (running) {
      setStep(job, running.id, "failed", message);
    }
    log(job, `Error: ${message}`);
    saveJob(job);
  }
}

export function startPipeline(input: StartPipelineInput) {
  assertLocalProcessingAllowed();
  const job = createJob(input);
  getJobStore().set(job.id, job);
  void executePipeline(job, input);
  return job;
}

/* --------------------------------------------------------------------- *
 * Protocol-driven runner (Phase 5 pipeline)                             *
 * --------------------------------------------------------------------- *
 *
 * Same job model and step machinery as the legacy runner, but spawns the
 * new CLI that takes a `--protocol <folder>` flag. Everything else (cues,
 * sections, parameters, variable names) comes from inside the protocol
 * folder, so the spawn line stays short.
 */

type StartProtocolPipelineInput = {
  /** Folder name under `config/protocols/`. */
  slug: string;
  inputDir?: string;
  outputDir?: string;
  metadata?: string;
  skipAdvancedVisuals?: boolean;
};

function createProtocolJob(input: StartProtocolPipelineInput): PipelineJob {
  if (!input.slug || !/^[a-z0-9][a-z0-9_-]*$/i.test(input.slug)) {
    throw new Error("Slug de protocolo invalido.");
  }
  const protocolPath = path.join(DEFAULT_PROTOCOLS_DIR, input.slug);
  const id = crypto.randomUUID();
  const outputDir = resolveUserPath(input.outputDir, createRunOutputDir());
  const inputDir = resolveUserPath(input.inputDir, DEFAULT_INPUT_DIR);
  const metadata = input.metadata?.trim() || DEFAULT_METADATA;
  const now = new Date().toISOString();
  return {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    inputDir,
    outputDir,
    metadata,
    protocolSlug: input.slug,
    protocolPath,
    steps: STEP_TEMPLATE.map((step) => ({ ...step })),
    logs: []
  };
}

async function executeProtocolPipeline(job: PipelineJob, input: StartProtocolPipelineInput) {
  try {
    job.status = "running";
    saveJob(job);

    setStep(job, "validate", "running");
    if (!job.protocolPath) {
      throw new Error("Falta la ruta del protocolo.");
    }
    const protocolStat = await fs.stat(job.protocolPath);
    if (!protocolStat.isDirectory()) {
      throw new Error(`El protocolo no es una carpeta: ${job.protocolPath}`);
    }
    const inputStat = await fs.stat(job.inputDir);
    if (!inputStat.isDirectory()) {
      throw new Error("La carpeta de PDFs no es una carpeta.");
    }
    await fs.mkdir(job.outputDir, { recursive: true });
    setStep(job, "validate", "completed", `Protocolo: ${job.protocolSlug} · Corpus: ${job.inputDir}`);
    log(job, `Salida: ${job.outputDir}`);

    setStep(job, "pipeline", "running");
    const python = process.env.PYTHON_BIN || "python3";
    const args = [
      "pipeline_publicable/run_pipeline_publicable.py",
      "--protocol",
      job.protocolPath,
      "--input-dir",
      job.inputDir,
      "--output-dir",
      job.outputDir,
      "--metadata",
      job.metadata
    ];
    if (input.skipAdvancedVisuals) {
      args.push("--skip-advanced-visuals");
    }
    await runCommand(job, "Pipeline", python, args);
    setStep(job, "pipeline", "completed");

    setStep(job, "report", "running");
    await runCommand(job, "Reporte", python, [
      "scripts/generate_review_report.py",
      "--output-dir",
      job.outputDir
    ]);
    job.reportPath = path.join(job.outputDir, "reporte_revision_nexo.docx");
    setStep(job, "report", "completed");

    setStep(job, "package", "running");
    await packageOutput(job);
    setStep(job, "package", "completed");

    job.status = "completed";
    log(job, "Analisis terminado correctamente.");
    saveJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    job.status = "failed";
    job.error = message;
    const running = job.steps.find((step) => step.status === "running");
    if (running) {
      setStep(job, running.id, "failed", message);
    }
    log(job, `Error: ${message}`);
    saveJob(job);
  }
}

export function startProtocolPipeline(input: StartProtocolPipelineInput) {
  assertLocalProcessingAllowed();
  const job = createProtocolJob(input);
  getJobStore().set(job.id, job);
  void executeProtocolPipeline(job, input);
  return job;
}
