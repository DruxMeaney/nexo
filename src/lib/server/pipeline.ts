import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { PipelineJob, PipelineStep } from "@/lib/types";
import { getJobStore, saveJob } from "./jobs";
import {
  assertLocalProcessingAllowed,
  assertSafeOutputDir,
  createRunOutputDir,
  DEFAULT_INPUT_DIR,
  DEFAULT_METADATA,
  DEFAULT_PROTOCOLS_DIR,
  PROJECT_ROOT,
  resolveUserPath
} from "./project";

/** Modules the spawned interpreter must be able to import. */
const REQUIRED_PYTHON_MODULES = ["pandas", "numpy", "pypdf", "openpyxl", "docx"];

/** Maximum jobs kept in memory, and how long a finished job survives. */
const MAX_JOBS = 50;
const JOB_TTL_MS = 6 * 60 * 60 * 1000;

// `label` y `detail` NO se muestran: la interfaz resuelve cada paso por su `id`
// contra el diccionario del idioma activo (ProtocolRunner.stepLabel/stepDetail).
// Se conservan como respaldo legible para quien consuma /api/pipeline/status
// fuera de la app. El `detail` que sí llega a pantalla es el que setStep escribe
// en tiempo de ejecucion, y solo puede contener DATOS de la corrida (rutas,
// slugs, conteos): cualquier prosa que se cuele ahi aparecería en español
// dentro de una interfaz en inglés.
const STEP_TEMPLATE: PipelineStep[] = [
  {
    id: "validate",
    label: "Validacion del corpus",
    detail: "",
    status: "pending"
  },
  {
    id: "pipeline",
    label: "Mineria y analisis contextual",
    detail: "",
    status: "pending"
  },
  {
    id: "report",
    label: "Reporte Word",
    detail: "",
    status: "pending"
  },
  {
    id: "package",
    label: "Paquete descargable",
    detail: "",
    status: "pending"
  }
];

/**
 * Drop finished jobs from the in-memory store so a long-lived dev server does
 * not grow without bound: first anything older than the TTL, then the oldest
 * entries above the cap. Running or queued jobs are never evicted.
 */
function evictOldJobs() {
  const store = getJobStore();
  const now = Date.now();
  for (const [id, job] of store) {
    const finished = job.status === "completed" || job.status === "failed";
    if (finished && now - Date.parse(job.updatedAt) > JOB_TTL_MS) {
      store.delete(id);
    }
  }
  if (store.size <= MAX_JOBS) return;
  const finished = [...store.entries()]
    .filter(([, job]) => job.status === "completed" || job.status === "failed")
    .sort(([, a], [, b]) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  for (const [id] of finished) {
    if (store.size <= MAX_JOBS) break;
    store.delete(id);
  }
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

/**
 * Packaging is a convenience, not part of the analysis: the tables, figures and
 * the Word report are already on disk when it runs. A failure here (typically a
 * missing `zip` binary) must not discard a completed run, so it only marks the
 * `package` step as failed and leaves the job completed. Returns whether the
 * ZIP was produced.
 */
async function packageOutputBestEffort(job: PipelineJob) {
  setStep(job, "package", "running");
  try {
    await packageOutput(job);
    setStep(job, "package", "completed");
    return true;
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Error desconocido.";
    const message = /ENOENT/.test(raw)
      ? "No se encontro el comando `zip`. Instala zip o descarga los archivos individualmente."
      : `No se pudo crear el ZIP: ${raw}`;
    setStep(job, "package", "failed", message);
    log(job, `Aviso: ${message}`);
    return false;
  }
}

/**
 * Verify that the interpreter we are about to spawn can import the pipeline's
 * dependencies. Without this the run dies with a ModuleNotFoundError buried in
 * the log; here it fails immediately with the variable the user has to set.
 */
async function assertPythonReady(job: PipelineJob, python: string) {
  const probe = REQUIRED_PYTHON_MODULES.map((name) => `import ${name}`).join("; ");
  try {
    await runCommand(job, "Interprete", python, ["-c", probe]);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (/ENOENT/.test(raw)) {
      throw new Error(
        `No se encontro el interprete de Python "${python}". Instala Python 3 o apunta la variable de entorno PYTHON_BIN al ejecutable correcto.`
      );
    }
    throw new Error(
      `El interprete "${python}" no puede importar las dependencias del pipeline (${REQUIRED_PYTHON_MODULES.join(", ")}). ` +
        "Revisa el log, instala los paquetes en ese interprete o apunta la variable de entorno PYTHON_BIN al Python del entorno virtual."
    );
  }
}

/* --------------------------------------------------------------------- *
 * Protocol-driven runner (Phase 5 pipeline)                             *
 * --------------------------------------------------------------------- *
 *
 * The only runner. It spawns the CLI that takes a `--protocol <folder>`
 * flag; everything else (cues, sections, parameters, variable names) comes
 * from inside the protocol folder, so the spawn line stays short. The
 * pre-Phase-5 runner (`startPipeline`, flags `--contaminants` / `--diseases`
 * / `--context-radius` / `--relation-distance`) was removed because the CLI
 * no longer accepts those flags and requires `--protocol`.
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
  // Reject an over-broad output folder before the job enters the store: the
  // store is what `isReadablePath` trusts, so unvalidated input must never
  // reach it.
  assertSafeOutputDir(outputDir);
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
    // Solo datos, sin prosa: el idioma de la interfaz lo pone el cliente.
    setStep(job, "validate", "completed", `${job.protocolSlug} · ${job.inputDir}`);
    log(job, `Salida: ${job.outputDir}`);

    setStep(job, "pipeline", "running");
    const python = process.env.PYTHON_BIN || "python3";
    await assertPythonReady(job, python);
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

    const packaged = await packageOutputBestEffort(job);

    job.status = "completed";
    log(
      job,
      packaged
        ? "Analisis terminado correctamente."
        : "Analisis terminado; los resultados estan en la carpeta de salida pero no se genero el ZIP."
    );
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
  evictOldJobs();
  getJobStore().set(job.id, job);
  void executeProtocolPipeline(job, input);
  return job;
}
