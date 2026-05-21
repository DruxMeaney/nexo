import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { assertLocalProcessingAllowed, PROJECT_ROOT } from "@/lib/server/project";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type DialogBody = {
  mode?: "folder" | "file" | "save";
  title?: string;
  defaultPath?: string;
  defaultName?: string;
};

function osaEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function macDialog(body: DialogBody) {
  const title = osaEscape(body.title || "Selecciona una ruta");
  const defaultPath =
    body.defaultPath && (body.mode === "file" || body.mode === "save") && path.extname(body.defaultPath)
      ? path.dirname(body.defaultPath)
      : body.defaultPath || PROJECT_ROOT;
  if (body.mode === "file") {
    const script = `POSIX path of (choose file with prompt "${title}" default location POSIX file "${osaEscape(defaultPath)}")`;
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  }
  if (body.mode === "save") {
    const defaultName = osaEscape(body.defaultName || "protocolo_revision.json");
    const script = `POSIX path of (choose file name with prompt "${title}" default name "${defaultName}" default location POSIX file "${osaEscape(defaultPath)}")`;
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  }
  const script = `POSIX path of (choose folder with prompt "${title}" default location POSIX file "${osaEscape(defaultPath)}")`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim().replace(/\/$/, "");
}

async function linuxDialog(body: DialogBody) {
  const title = body.title || "Selecciona una ruta";
  const defaultPath =
    body.defaultPath && (body.mode === "file" || body.mode === "save") && path.extname(body.defaultPath)
      ? path.dirname(body.defaultPath)
      : body.defaultPath || PROJECT_ROOT;
  if (body.mode === "file") {
    const { stdout } = await execFileAsync("sh", [
      "-lc",
      `if command -v zenity >/dev/null 2>&1; then zenity --file-selection --title "$1" --filename "$2/"; elif command -v kdialog >/dev/null 2>&1; then kdialog --getopenfilename "$2"; else exit 127; fi`,
      "dialog",
      title,
      defaultPath
    ]);
    return stdout.trim();
  }
  const { stdout } = await execFileAsync("sh", [
    "-lc",
    `if command -v zenity >/dev/null 2>&1; then zenity --file-selection --directory --title "$1" --filename "$2/"; elif command -v kdialog >/dev/null 2>&1; then kdialog --getexistingdirectory "$2"; else exit 127; fi`,
    "dialog",
    title,
    defaultPath
  ]);
  return stdout.trim();
}

async function windowsDialog(body: DialogBody) {
  const title = (body.title || "Selecciona una ruta").replaceAll("'", "''");
  const defaultPath = (
    body.defaultPath && (body.mode === "file" || body.mode === "save") && path.extname(body.defaultPath)
      ? path.dirname(body.defaultPath)
      : body.defaultPath || PROJECT_ROOT
  ).replaceAll("'", "''");
  if (body.mode === "file") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$d = New-Object System.Windows.Forms.OpenFileDialog",
      `$d.Title = '${title}'`,
      `$d.InitialDirectory = '${defaultPath}'`,
      "$d.Filter = 'JSON files (*.json)|*.json|All files (*.*)|*.*'",
      "if ($d.ShowDialog() -eq 'OK') { $d.FileName }"
    ].join("; ");
    const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
    return stdout.trim();
  }
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$d.Description = '${title}'`,
    `$d.SelectedPath = '${defaultPath}'`,
    "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }"
  ].join("; ");
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
  return stdout.trim();
}

export async function POST(request: Request) {
  try {
    assertLocalProcessingAllowed();
    const body = (await request.json().catch(() => ({}))) as DialogBody;
    const mode = body.mode || "folder";
    const normalized = { ...body, mode };
    if (normalized.defaultPath) {
      const defaultDir =
        (mode === "file" || mode === "save") && path.extname(normalized.defaultPath)
          ? path.dirname(normalized.defaultPath)
          : normalized.defaultPath;
      await fs.mkdir(defaultDir, { recursive: true }).catch(() => undefined);
    }
    let selected = "";
    if (process.platform === "darwin") selected = await macDialog(normalized);
    else if (process.platform === "win32") selected = await windowsDialog(normalized);
    else selected = await linuxDialog(normalized);
    if (!selected) {
      return NextResponse.json({ error: "No se selecciono ninguna ruta." }, { status: 400 });
    }
    return NextResponse.json({ path: path.normalize(selected) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo abrir el selector del sistema operativo."
      },
      { status: 400 }
    );
  }
}
