import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertReadablePath, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawPath = url.searchParams.get("path");
    if (!rawPath) {
      return NextResponse.json({ error: "Falta path." }, { status: 400 });
    }
    const filePath = resolveUserPath(rawPath, rawPath);
    assertReadablePath(filePath);
    const file = await fs.readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(filePath).replaceAll('"', "")}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo descargar el archivo." },
      { status: 400 }
    );
  }
}
