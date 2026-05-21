import { NextResponse } from "next/server";
import {
  DEFAULT_INPUT_DIR,
  DEFAULT_METADATA,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_CONTAMINANTS,
  DEFAULT_DISEASES,
  DEFAULT_PROTOCOLS_DIR,
  DEFAULT_WEB_RUNS_DIR,
  isVercelRuntime,
  PROJECT_ROOT,
  toDisplayPath
} from "@/lib/server/project";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    appName: "NEXO",
    projectRoot: PROJECT_ROOT,
    defaultInputDir: DEFAULT_INPUT_DIR,
    defaultOutputDir: DEFAULT_OUTPUT_DIR,
    defaultWebRunsDir: DEFAULT_WEB_RUNS_DIR,
    defaultMetadata: DEFAULT_METADATA,
    defaultContaminants: DEFAULT_CONTAMINANTS,
    defaultDiseases: DEFAULT_DISEASES,
    defaultProtocolsDir: DEFAULT_PROTOCOLS_DIR,
    isVercel: isVercelRuntime(),
    display: {
      projectRoot: toDisplayPath(PROJECT_ROOT),
      defaultInputDir: toDisplayPath(DEFAULT_INPUT_DIR),
      defaultOutputDir: toDisplayPath(DEFAULT_OUTPUT_DIR)
    }
  });
}
