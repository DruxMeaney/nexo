import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { DEFAULT_CONTAMINANTS, DEFAULT_DISEASES, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; preset?: "contaminants" | "diseases" };
    const fallback = body.preset === "diseases" ? DEFAULT_DISEASES : DEFAULT_CONTAMINANTS;
    const filePath = resolveUserPath(body.path, fallback);
    const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
    return NextResponse.json({ path: filePath, payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el lexico JSON." },
      { status: 400 }
    );
  }
}
