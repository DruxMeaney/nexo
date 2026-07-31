/**
 * POST /api/protocol/load-folder
 *
 * Reads a protocol folder under `config/protocols/{slug}/` and returns a
 * rebuilt `ProtocolDraft`. Missing files are tolerated; the response carries
 * a `warnings` array listing files that could not be parsed.
 *
 * Request body:
 *   { slug: string }
 *
 * Response:
 *   { draft: ProtocolDraft, warnings: string[], slug: string }
 *
 * Local-only.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  assertLocalProcessingAllowed,
  DEFAULT_PROTOCOLS_DIR
} from "@/lib/server/project";
import { folderToDraft } from "@/lib/protocol/folder";
import { assertSameOrigin } from "@/lib/server/request-origin";

export const dynamic = "force-dynamic";

interface LoadBody {
  slug?: string;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertLocalProcessingAllowed();
    const body = (await request.json()) as LoadBody;
    const slug = body.slug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "missing_slug" }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-_]*$/i.test(slug)) {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }

    const folder = path.join(DEFAULT_PROTOCOLS_DIR, slug);
    try {
      await fs.access(folder);
    } catch {
      return NextResponse.json({ error: "not_found", slug }, { status: 404 });
    }

    const files = await readFolderRecursive(folder, folder);
    const { draft, warnings } = folderToDraft(files);
    return NextResponse.json({ slug, draft, warnings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 }
    );
  }
}

/**
 * Walk the folder and return a flat `{ relativePath: parsedJson }` map. Only
 * `.json` files are read; anything else is ignored. Subfolders are
 * traversed; the map keys use POSIX separators to match `draftToFolder`.
 */
async function readFolderRecursive(
  root: string,
  current: string
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const nested = await readFolderRecursive(root, absolute);
      Object.assign(out, nested);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(absolute, "utf8");
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      out[relative] = JSON.parse(raw);
    } catch {
      /* skip unreadable file — folderToDraft will fall back to defaults */
    }
  }
  return out;
}
