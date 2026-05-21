import { NextResponse } from "next/server";
import { getJob } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("jobId");
  if (!id) {
    return NextResponse.json({ error: "Falta jobId." }, { status: 400 });
  }
  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "No se encontro la ejecucion solicitada." }, { status: 404 });
  }
  return NextResponse.json(job);
}
