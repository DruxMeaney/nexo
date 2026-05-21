import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { DEFAULT_PROTOCOLS_DIR, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const filePath = resolveUserPath(body.path, DEFAULT_PROTOCOLS_DIR);
    const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
    return NextResponse.json({ path: filePath, payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el protocolo." },
      { status: 400 }
    );
  }
}
