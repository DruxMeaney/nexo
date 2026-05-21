/**
 * GET /api/protocol/[slug]
 *
 * Returns the manifest + variable display names for a saved protocol so
 * the run page can render a summary header without loading every cue file.
 *
 * Response:
 *   {
 *     slug: string,
 *     name: string,
 *     description: string,
 *     author: string,
 *     savedAt: string,
 *     variableA: { displayNameEs, displayNameEn, mode },
 *     variableB: { displayNameEs, displayNameEn, mode },
 *     analysis: AnalysisParams,
 *     termCountA: number,
 *     termCountB: number
 *   }
 */

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEFAULT_PROTOCOLS_DIR } from "@/lib/server/project";
import { PROTOCOL_FILE } from "@/lib/protocol/folder";
import { countTerms } from "@/lib/protocol/draft";
import type { ProtocolDraft } from "@/lib/protocol/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    if (!slug || !/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }
    const folder = path.join(DEFAULT_PROTOCOLS_DIR, slug);
    try {
      await fs.access(folder);
    } catch {
      return NextResponse.json({ error: "not_found", slug }, { status: 404 });
    }

    const manifestRaw = await fs.readFile(path.join(folder, PROTOCOL_FILE), "utf8");
    const manifest = JSON.parse(manifestRaw) as {
      identity?: ProtocolDraft["identity"];
      analysis?: ProtocolDraft["analysis"];
      savedAt?: string;
    };

    const variableA = await readVariableMetadata(folder, "a");
    const variableB = await readVariableMetadata(folder, "b");

    return NextResponse.json({
      slug,
      name: manifest.identity?.name ?? slug,
      description: manifest.identity?.description ?? "",
      author: manifest.identity?.author ?? "",
      savedAt: manifest.savedAt ?? "",
      variableA: variableA.metadata,
      variableB: variableB.metadata,
      analysis: manifest.analysis ?? null,
      termCountA: variableA.termCount,
      termCountB: variableB.termCount
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 }
    );
  }
}

async function readVariableMetadata(folder: string, slot: "a" | "b") {
  try {
    const raw = await fs.readFile(path.join(folder, "variables", `variable_${slot}.json`), "utf8");
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
    // The countTerms helper walks a typed tree; here we pass the raw nodes
    // because the protocol folder stores them in the same shape the wizard
    // emits. Any malformed entries are counted as zero.
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
