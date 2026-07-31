/**
 * POST /api/protocol/save-folder
 *
 * Persists a `ProtocolDraft` as a folder of JSON files under
 * `config/protocols/{slug}/`. The slug is derived from the protocol name,
 * or supplied explicitly to overwrite an existing protocol.
 *
 * Request body:
 *   {
 *     draft: ProtocolDraft,
 *     slug?: string,        // optional override; defaults to slugify(name)
 *     overwrite?: boolean   // default false; refuses to overwrite an existing folder
 *   }
 *
 * Response on success:
 *   {
 *     slug: string,
 *     folder: string,       // absolute path to the folder
 *     files: string[]       // relative paths written
 *   }
 *
 * Local-only: this route refuses to run on Vercel because it writes to the
 * server filesystem.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  assertLocalProcessingAllowed,
  DEFAULT_PROTOCOLS_DIR
} from "@/lib/server/project";
import { draftToFolder, slugifyName } from "@/lib/protocol/folder";
import type { ProtocolDraft } from "@/lib/protocol/types";
import { assertSameOrigin } from "@/lib/server/request-origin";

export const dynamic = "force-dynamic";

interface SaveBody {
  draft?: ProtocolDraft;
  slug?: string;
  overwrite?: boolean;
}

/**
 * Canonical slug alphabet, shared with /api/protocol/load-folder,
 * /api/protocol/[slug], /ejecutar and startProtocolPipeline. An explicit slug
 * is used verbatim after this check: re-slugifying it would rewrite '_' to '-'
 * and send the save to a different folder than the one the guard tested, so an
 * existing protocol with underscores could never be overwritten.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertLocalProcessingAllowed();
    const body = (await request.json()) as SaveBody;
    if (!body.draft) {
      return NextResponse.json({ error: "missing_draft" }, { status: 400 });
    }
    const draft = body.draft;

    const requestedSlug = body.slug?.trim();
    if (requestedSlug && !SLUG_PATTERN.test(requestedSlug)) {
      return NextResponse.json({ error: "invalid_slug", slug: requestedSlug }, { status: 400 });
    }
    const slug = requestedSlug || slugifyName(draft.identity.name);
    const folder = path.join(DEFAULT_PROTOCOLS_DIR, slug);

    if (!body.overwrite) {
      try {
        await fs.access(folder);
        return NextResponse.json(
          { error: "already_exists", slug, folder },
          { status: 409 }
        );
      } catch {
        /* folder doesn't exist yet — good, continue */
      }
    }

    const fileMap = draftToFolder(draft);
    await fs.mkdir(folder, { recursive: true });
    await fs.mkdir(path.join(folder, "variables"), { recursive: true });
    await fs.mkdir(path.join(folder, "cues"), { recursive: true });

    const written: string[] = [];
    for (const [relativePath, payload] of Object.entries(fileMap)) {
      const absolute = path.join(folder, relativePath);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, JSON.stringify(payload, null, 2), "utf8");
      written.push(relativePath);
    }

    return NextResponse.json({ slug, folder, files: written });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save_failed" },
      { status: 500 }
    );
  }
}
