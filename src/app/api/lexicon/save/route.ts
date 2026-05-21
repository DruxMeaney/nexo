import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEFAULT_PROTOCOLS_DIR, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; payload: unknown; defaultName?: string };
    const fallback = path.join(DEFAULT_PROTOCOLS_DIR, safeFileName(body.defaultName || "lexico_revision") + ".json");
    const filePath = resolveUserPath(body.path, fallback);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(body.payload, null, 2), "utf8");
    return NextResponse.json({ path: filePath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el lexico JSON." },
      { status: 400 }
    );
  }
}
