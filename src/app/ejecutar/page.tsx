import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProtocolRunner } from "@/components/run/ProtocolRunner";
import { getDictionary } from "@/lib/i18n/server";
import { PROTOCOL_FILE } from "@/lib/protocol/folder";
import { countTerms } from "@/lib/protocol/draft";
import { DEFAULT_PROTOCOLS_DIR } from "@/lib/server/project";

/**
 * Server entry point for the protocol-driven run page.
 *
 * Reads the protocol metadata directly off disk (no internal API hop) and
 * renders the client-side `<ProtocolRunner>`. If the slug is missing we
 * bounce the user to `/protocolo/cargar` where they can pick a protocol.
 */
export default async function ExecutePage({
  searchParams
}: {
  searchParams: Promise<{ protocol?: string }>;
}) {
  const { protocol: slug } = await searchParams;
  if (!slug) {
    redirect("/protocolo/cargar");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
    return <ExecuteErrorPage reason="invalid_slug" />;
  }

  const folder = path.join(DEFAULT_PROTOCOLS_DIR, slug);
  let manifest: ManifestShape | null = null;
  let summary: VariableSummary | null = null;
  try {
    const manifestRaw = await fs.readFile(path.join(folder, PROTOCOL_FILE), "utf8");
    manifest = JSON.parse(manifestRaw) as ManifestShape;
    summary = {
      variableA: await readVariableMetadata(folder, "a"),
      variableB: await readVariableMetadata(folder, "b")
    };
  } catch {
    return <ExecuteErrorPage reason="load_failed" slug={slug} />;
  }

  const t = await getDictionary();
  return (
    <AppShell showFooterCta={false}>
      <main>
        <section className="page-title">
          <p className="eyebrow" style={{ color: "var(--rust)" }}>
            {t.execute.eyebrow}
          </p>
          <h1>{t.execute.title}</h1>
          <p>{t.execute.copy}</p>
          <Link
            href="/protocolo/cargar"
            className="button-ghost"
            style={{ marginTop: 8, paddingLeft: 0 }}
          >
            <ArrowLeft size={15} />
            {t.execute.backToLoad}
          </Link>
        </section>

        <section className="section">
          <ProtocolRunner
            t={t}
            protocol={{
              slug,
              name: manifest.identity?.name ?? slug,
              description: manifest.identity?.description ?? "",
              author: manifest.identity?.author ?? "",
              savedAt: manifest.savedAt ?? "",
              variableA: summary.variableA.metadata,
              variableB: summary.variableB.metadata,
              analysis: manifest.analysis ?? null,
              termCountA: summary.variableA.termCount,
              termCountB: summary.variableB.termCount
            }}
          />
        </section>
      </main>
    </AppShell>
  );
}

async function ExecuteErrorPage({
  reason,
  slug
}: {
  reason: "invalid_slug" | "load_failed";
  slug?: string;
}) {
  const t = await getDictionary();
  return (
    <AppShell showFooterCta={false}>
      <main>
        <section className="page-title">
          <h1>{t.execute.title}</h1>
        </section>
        <section className="section">
          <div className="notice notice-danger" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p style={{ margin: 0 }}>
              {t.execute.protocolLoadFailed}
              {slug ? (
                <>
                  {" "}
                  <span className="mono">({slug})</span>
                </>
              ) : null}
              {" "}
              <span className="muted">[{reason}]</span>
            </p>
          </div>
          <Link
            href="/protocolo/cargar"
            className="button-secondary"
            style={{ marginTop: 12 }}
          >
            <ArrowLeft size={16} />
            {t.execute.backToLoad}
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

interface ManifestShape {
  identity?: { name?: string; description?: string; author?: string };
  analysis?: {
    contextRadius: number;
    kwicRadius: number;
    relationDistance: number;
    kmeansK: number;
    validationSampleSize: number;
  };
  savedAt?: string;
}

interface VariableSummary {
  variableA: {
    metadata: { displayNameEs: string; displayNameEn: string; mode: string };
    termCount: number;
  };
  variableB: {
    metadata: { displayNameEs: string; displayNameEn: string; mode: string };
    termCount: number;
  };
}

async function readVariableMetadata(folder: string, slot: "a" | "b") {
  try {
    const raw = await fs.readFile(
      path.join(folder, "variables", `variable_${slot}.json`),
      "utf8"
    );
    const parsed = JSON.parse(raw) as {
      metadata?: { displayNameEs?: string; displayNameEn?: string; mode?: string };
      taxonomy?: unknown[];
    };
    const metadata = {
      displayNameEs: parsed.metadata?.displayNameEs ?? "",
      displayNameEn: parsed.metadata?.displayNameEn ?? "",
      mode: parsed.metadata?.mode ?? "hierarchical"
    };
    const taxonomy = Array.isArray(parsed.taxonomy) ? parsed.taxonomy : [];
    // The protocol JSON uses the same shape as the in-memory TaxonomyNode
    // tree, so countTerms accepts it via the same typing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const termCount = countTerms(taxonomy as any);
    return { metadata, termCount };
  } catch {
    return {
      metadata: { displayNameEs: "", displayNameEn: "", mode: "hierarchical" },
      termCount: 0
    };
  }
}
