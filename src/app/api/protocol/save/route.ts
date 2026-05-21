import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DEFAULT_PROTOCOLS_DIR, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

function safeProtocolName(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return cleaned || "protocolo_revision";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; protocol: { name?: string } & Record<string, unknown> };
    const now = new Date().toISOString();
    const protocol = {
      ...body.protocol,
      updatedAt: now,
      createdAt: body.protocol.createdAt || now
    };
    const fallback = path.join(DEFAULT_PROTOCOLS_DIR, `${safeProtocolName(String(protocol.name || ""))}.json`);
    const filePath = resolveUserPath(body.path, fallback);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(protocol, null, 2), "utf8");
    return NextResponse.json({ path: filePath, protocol });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el protocolo." },
      { status: 400 }
    );
  }
}
