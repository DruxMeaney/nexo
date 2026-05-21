import { NextResponse } from "next/server";
import { summarizeResults } from "@/lib/server/results";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const outputDir = url.searchParams.get("outputDir");
    const summary = await summarizeResults(outputDir);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los resultados." },
      { status: 400 }
    );
  }
}
