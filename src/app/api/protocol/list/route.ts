/**
 * GET /api/protocol/list
 *
 * Lists every protocol folder under `config/protocols/`. Each entry reads
 * just the `protocol.json` manifest so we never load the heavy cue/section
 * files for the listing.
 *
 * Response:
 *   { protocols: ProtocolListItem[] }
 *
 * Folders without a readable `protocol.json` are silently skipped (they may
 * be partial imports or unrelated subdirectories).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEFAULT_PROTOCOLS_DIR } from "@/lib/server/project";
import { extractListItem, PROTOCOL_FILE } from "@/lib/protocol/folder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let entries: string[] = [];
    try {
      const dir = await fs.readdir(DEFAULT_PROTOCOLS_DIR, { withFileTypes: true });
      entries = dir.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({ protocols: [] });
      }
      throw error;
    }

    const items = [];
    for (const slug of entries) {
      const manifestPath = path.join(DEFAULT_PROTOCOLS_DIR, slug, PROTOCOL_FILE);
      try {
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw);
        const item = extractListItem(slug, parsed);
        if (item) items.push(item);
      } catch {
        /* Folder exists but has no readable protocol.json — skip silently. */
      }
    }

    // Sort newest first by savedAt; fall back to slug alphabetical when missing.
    items.sort((a, b) => {
      if (a.savedAt && b.savedAt) return b.savedAt.localeCompare(a.savedAt);
      if (a.savedAt) return -1;
      if (b.savedAt) return 1;
      return a.slug.localeCompare(b.slug);
    });

    return NextResponse.json({ protocols: items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "list_failed" },
      { status: 500 }
    );
  }
}
