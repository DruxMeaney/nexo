import { NextResponse } from "next/server";
import { startPipeline } from "@/lib/server/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const job = startPipeline(body);
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar el pipeline." },
      { status: 400 }
    );
  }
}
