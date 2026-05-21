import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ScanFile } from "@/lib/types";
import { assertLocalProcessingAllowed, DEFAULT_INPUT_DIR, resolveUserPath } from "@/lib/server/project";

export const dynamic = "force-dynamic";

async function toScanFile(root: string, filePath: string): Promise<ScanFile> {
  const stat = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    relativePath: path.relative(root, filePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

export async function POST(request: Request) {
  try {
    assertLocalProcessingAllowed();
    const body = (await request.json().catch(() => ({}))) as { inputDir?: string };
    const inputDir = resolveUserPath(body.inputDir, DEFAULT_INPUT_DIR);
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(inputDir, entry.name));
    const scanned = await Promise.all(files.map((file) => toScanFile(inputDir, file)));
    const pdfFiles = scanned.filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    const rejectedFiles = scanned.filter((file) => !file.name.toLowerCase().endsWith(".pdf"));
    return NextResponse.json({
      inputDir,
      totalFiles: scanned.length,
      pdfFiles,
      rejectedFiles
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo escanear la carpeta." },
      { status: 400 }
    );
  }
}
