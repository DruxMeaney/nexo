"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Play
} from "lucide-react";
import { pickLabel, type Dictionary } from "@/lib/i18n/dictionaries";
import { pluralize } from "@/lib/i18n/format";
import type { PipelineJob, PipelineStep } from "@/lib/types";

interface ProtocolSummary {
  slug: string;
  name: string;
  description: string;
  author: string;
  savedAt: string;
  variableA: { displayNameEs: string; displayNameEn: string; mode: string };
  variableB: { displayNameEs: string; displayNameEn: string; mode: string };
  analysis: {
    contextRadius: number;
    kwicRadius: number;
    relationDistance: number;
    kmeansK: number;
    validationSampleSize: number;
  } | null;
  termCountA: number;
  termCountB: number;
}

interface Props {
  protocol: ProtocolSummary;
  t: Dictionary;
}

const POLL_INTERVAL_MS = 1500;
/** Backoff cap and give-up threshold for a status endpoint that stops answering. */
const POLL_MAX_INTERVAL_MS = 15000;
const POLL_MAX_FAILURES = 8;

/**
 * End-to-end runner for a saved protocol.
 *
 * Workflow:
 *   1. User picks the PDF folder (native dialog via /api/local/dialog).
 *   2. (Optional) User overrides the output folder and metadata files.
 *   3. Submit → POST /api/pipeline/run-protocol with the slug.
 *   4. Poll GET /api/pipeline/status?jobId=… every 1.5s while the job
 *      isn't terminal.
 *   5. On `completed`, surface CTAs for the results page, Word report and
 *      ZIP package.
 *
 * The job-state polling is intentionally cancelled when the component
 * unmounts; the in-memory job store keeps the run alive on the server, so
 * the user can navigate to the results without aborting anything.
 */
export function ProtocolRunner({ protocol, t }: Props) {
  const [inputDir, setInputDir] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [metadata, setMetadata] = useState("");
  const [skipAdvanced, setSkipAdvanced] = useState(false);
  const [pickingFolder, setPickingFolder] = useState<"input" | "output" | null>(null);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Consecutive failed polls. Drives the backoff, the inline warning and the
  // give-up message; reset to 0 by every successful poll.
  const [pollFailures, setPollFailures] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop polling when we unmount or when the job reaches a terminal state.
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.status === "failed") return;
    if (pollFailures >= POLL_MAX_FAILURES) return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    // The effect depends on `pollFailures` as well as `job`, so a failed poll
    // still schedules the next one: bumping the counter re-runs the effect.
    // Exponential backoff keeps a restarted or busy server from being hammered.
    const delay = Math.min(POLL_INTERVAL_MS * 2 ** pollFailures, POLL_MAX_INTERVAL_MS);
    pollTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/pipeline/status?jobId=${job.id}`, {
          cache: "no-store"
        });
        if (!response.ok) {
          setPollFailures((count) => count + 1);
          return;
        }
        const next = (await response.json()) as PipelineJob;
        setPollFailures(0);
        setJob(next);
      } catch {
        setPollFailures((count) => count + 1);
      }
    }, delay);
  }, [job, pollFailures]);

  async function pickFolder(target: "input" | "output") {
    setPickingFolder(target);
    setFormError(null);
    try {
      const response = await fetch("/api/local/dialog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "folder",
          title:
            target === "input"
              ? t.execute.inputFolderLabel
              : t.execute.outputFolderLabel,
          defaultPath: target === "input" ? inputDir : outputDir
        })
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { path?: string };
      if (payload.path) {
        if (target === "input") setInputDir(payload.path);
        else setOutputDir(payload.path);
      }
    } catch {
      /* user cancelled or platform doesn't have a dialog — silent */
    } finally {
      setPickingFolder(null);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!inputDir.trim()) {
      setFormError(t.execute.missingInput);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setPollFailures(0);
    try {
      const response = await fetch("/api/pipeline/run-protocol", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: protocol.slug,
          inputDir: inputDir.trim(),
          outputDir: outputDir.trim() || undefined,
          metadata: metadata.trim() || undefined,
          skipAdvancedVisuals: skipAdvanced
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        const message =
          typeof payload?.error === "string" ? payload.error : t.execute.runError;
        setFormError(`${t.execute.runError} (${message})`);
        return;
      }
      setJob(payload as PipelineJob);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? `${t.execute.runError} (${cause.message})` : t.execute.runError
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="runner">
      <ProtocolHeader protocol={protocol} t={t} />

      <form className="runner-form" onSubmit={onSubmit}>
        <div className="field full">
          <label htmlFor="run-input-dir">{t.execute.inputFolderLabel}</label>
          <div className="path-picker">
            <button
              type="button"
              className="icon-button"
              onClick={() => pickFolder("input")}
              aria-label={t.execute.inputFolderLabel}
              disabled={pickingFolder !== null}
            >
              <FolderOpen size={17} />
            </button>
            <input
              id="run-input-dir"
              type="text"
              value={inputDir}
              placeholder={t.execute.inputFolderPlaceholder}
              onChange={(e) => setInputDir(e.target.value)}
              spellCheck={false}
              required
            />
          </div>
          <p className="help-text">{t.execute.inputFolderHint}</p>
        </div>

        <div className="field full">
          <label htmlFor="run-output-dir">{t.execute.outputFolderLabel}</label>
          <div className="path-picker">
            <button
              type="button"
              className="icon-button"
              onClick={() => pickFolder("output")}
              aria-label={t.execute.outputFolderLabel}
              disabled={pickingFolder !== null}
            >
              <FolderOpen size={17} />
            </button>
            <input
              id="run-output-dir"
              type="text"
              value={outputDir}
              placeholder={t.execute.outputFolderPlaceholder}
              onChange={(e) => setOutputDir(e.target.value)}
              spellCheck={false}
            />
          </div>
          <p className="help-text">{t.execute.outputFolderHint}</p>
        </div>

        <div className="field full">
          <label htmlFor="run-metadata">{t.execute.metadataLabel}</label>
          <input
            id="run-metadata"
            type="text"
            value={metadata}
            placeholder={t.execute.metadataPlaceholder}
            onChange={(e) => setMetadata(e.target.value)}
            spellCheck={false}
          />
          <p className="help-text">{t.execute.metadataHint}</p>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={skipAdvanced}
            onChange={(e) => setSkipAdvanced(e.target.checked)}
          />
          <span>
            {t.execute.skipAdvancedLabel}{" "}
            <span className="muted">— {t.execute.skipAdvancedHint}</span>
          </span>
        </label>

        {formError ? (
          <div className="notice notice-danger" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <p style={{ margin: 0 }}>{formError}</p>
          </div>
        ) : null}

        <div className="runner-actions">
          <button
            type="submit"
            className="button"
            disabled={submitting || (job?.status === "running" || job?.status === "queued")}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                {t.execute.runButtonBusy}
              </>
            ) : (
              <>
                <Play size={16} />
                {t.execute.runButton}
              </>
            )}
          </button>
        </div>
      </form>

      {job ? <RunStatus job={job} t={t} pollFailures={pollFailures} /> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Protocol summary header                                               */
/* --------------------------------------------------------------------- */

function ProtocolHeader({ protocol, t }: { protocol: ProtocolSummary; t: Dictionary }) {
  const nameA =
    pickLabel(t.localeCode, protocol.variableA.displayNameEs, protocol.variableA.displayNameEn) ||
    "A";
  const nameB =
    pickLabel(t.localeCode, protocol.variableB.displayNameEs, protocol.variableB.displayNameEn) ||
    "B";
  return (
    <section className="runner-header">
      <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
        {t.execute.protocolHeaderEyebrow}
      </p>
      <h2>{protocol.name || t.execute.protocolHeaderEmpty}</h2>
      {protocol.description ? <p>{protocol.description}</p> : null}
      <div className="runner-variables">
        <div>
          <span className="variable-slot-badge">A</span>
          <strong>{nameA}</strong>
          <span className="muted">
            {" "}
            · {pluralize(protocol.termCountA, t.execute.termsCount, t.execute.termsCountSingular)}
          </span>
        </div>
        <div>
          <span className="variable-slot-badge" style={{ background: "var(--rust)" }}>
            B
          </span>
          <strong>{nameB}</strong>
          <span className="muted">
            {" "}
            · {pluralize(protocol.termCountB, t.execute.termsCount, t.execute.termsCountSingular)}
          </span>
        </div>
      </div>
      {protocol.analysis ? (
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {t.execute.paramSummary
            .replace("{context}", String(protocol.analysis.contextRadius))
            .replace("{relation}", String(protocol.analysis.relationDistance))
            .replace("{k}", String(protocol.analysis.kmeansK))}
        </p>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------------- */
/* Live status panel                                                     */
/* --------------------------------------------------------------------- */

function RunStatus({
  job,
  t,
  pollFailures
}: {
  job: PipelineJob;
  t: Dictionary;
  pollFailures: number;
}) {
  const status = mapJobStatus(job.status, t);
  const pollLost = pollFailures >= POLL_MAX_FAILURES;
  return (
    <section className="run-status" aria-live="polite">
      {pollFailures > 0 ? (
        <div className="notice notice-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p style={{ margin: 0 }}>
            {pollLost
              ? t.execute.pollLost
              : t.execute.pollRetrying.replace("{attempt}", String(pollFailures))}
          </p>
        </div>
      ) : null}
      <header className="run-status-header">
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>{t.execute.runStartedTitle}</h3>
          <p className="muted" style={{ margin: 0 }}>
            <span className={`run-status-pill run-status-pill-${job.status}`}>{status}</span>
            <span style={{ marginLeft: 12 }}>
              {t.execute.jobIdLabel}:{" "}
              <span className="mono">{job.id.slice(0, 8)}…</span>
            </span>
          </p>
        </div>
      </header>

      <h4>{t.execute.stepsTitle}</h4>
      <ol className="status-list">
        {job.steps.map((step) => (
          <li
            key={step.id}
            className={`status-item ${step.status}`}
          >
            <span className="status-dot" aria-hidden="true">
              {step.status === "running" ? (
                <Loader2 size={14} className="spin" />
              ) : step.status === "completed" ? (
                <CheckCircle2 size={14} />
              ) : step.status === "failed" ? (
                <AlertTriangle size={14} />
              ) : (
                "•"
              )}
            </span>
            <div>
              <strong>{stepLabel(step, t)}</strong>
              <p className="muted" style={{ margin: 0 }}>
                {/* Everything shown here comes from the active dictionary. The
                    server sends `detail` only once the step has data to report
                    (paths, slugs), never prose — prose from the server would
                    render in Spanish inside an English interface. */}
                {stepStatus(step, t)}
                {` · ${step.detail || stepDetail(step, t)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h4>{t.execute.logsTitle}</h4>
      <pre className="log-box">
        {job.logs.length === 0 ? t.execute.noLogs : job.logs.join("\n")}
      </pre>

      {job.status === "failed" && job.error ? (
        <div className="notice notice-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p style={{ margin: 0 }}>{job.error}</p>
        </div>
      ) : null}

      {job.status === "completed" ? (
        <div className="run-status-cta">
          <Link
            className="button"
            href={`/resultados?outputDir=${encodeURIComponent(job.outputDir)}`}
          >
            <ExternalLink size={16} />
            {t.execute.viewResultsCta}
          </Link>
          {job.reportPath ? (
            <a
              className="button-secondary"
              href={`/api/files/download?path=${encodeURIComponent(job.reportPath)}`}
            >
              <Download size={16} />
              {t.execute.downloadReportCta}
            </a>
          ) : null}
          {job.packagePath ? (
            <a
              className="button-secondary"
              href={`/api/files/download?path=${encodeURIComponent(job.packagePath)}`}
            >
              <Download size={16} />
              {t.execute.downloadPackageCta}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function mapJobStatus(status: PipelineJob["status"], t: Dictionary): string {
  switch (status) {
    case "queued":
      return t.execute.statusQueued;
    case "running":
      return t.execute.statusRunning;
    case "completed":
      return t.execute.statusCompleted;
    case "failed":
      return t.execute.statusFailed;
    default:
      return status;
  }
}

function stepLabel(step: PipelineStep, t: Dictionary): string {
  switch (step.id) {
    case "validate":
      return t.execute.stepValidateLabel;
    case "pipeline":
      return t.execute.stepPipelineLabel;
    case "report":
      return t.execute.stepReportLabel;
    case "package":
      return t.execute.stepPackageLabel;
    default:
      return step.label;
  }
}

function stepDetail(step: PipelineStep, t: Dictionary): string {
  switch (step.id) {
    case "validate":
      return t.execute.stepValidateDetail;
    case "pipeline":
      return t.execute.stepPipelineDetail;
    case "report":
      return t.execute.stepReportDetail;
    case "package":
      return t.execute.stepPackageDetail;
    default:
      return step.detail;
  }
}

function stepStatus(step: PipelineStep, t: Dictionary): string {
  switch (step.status) {
    case "pending":
      return t.execute.stepStatusPending;
    case "running":
      return t.execute.stepStatusRunning;
    case "completed":
      return t.execute.stepStatusCompleted;
    case "failed":
      return t.execute.stepStatusFailed;
    default:
      return step.status;
  }
}
