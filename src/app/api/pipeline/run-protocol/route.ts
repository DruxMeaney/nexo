/**
 * POST /api/pipeline/run-protocol
 *
 * Starts a protocol-driven pipeline job. Unlike the legacy
 * `/api/pipeline/run`, this endpoint takes a `slug` pointing to a saved
 * protocol folder and pulls every other parameter (cues, sections,
 * variable names...) from inside that folder.
 *
 * Request body:
 *   {
 *     slug: string,                // required, refers to config/protocols/{slug}
 *     inputDir: string,            // PDF folder
 *     outputDir?: string,          // defaults to a fresh outputs/webapp_runs/<timestamp>
 *     metadata?: string,           // comma-separated XLSX/CSV metadata files
 *     skipAdvancedVisuals?: boolean
 *   }
 *
 * Response: the initial `PipelineJob` object (status: "queued"). The client
 * polls `GET /api/pipeline/status?jobId=<id>` for updates.
 */

import { NextResponse } from "next/server";
import { startProtocolPipeline } from "@/lib/server/pipeline";
import { assertSameOrigin } from "@/lib/server/request-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    if (typeof body.slug !== "string" || !body.slug.trim()) {
      return NextResponse.json({ error: "missing_slug" }, { status: 400 });
    }
    const job = startProtocolPipeline(body);
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pipeline." },
      { status: 400 }
    );
  }
}
