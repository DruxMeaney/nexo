import { NextResponse } from "next/server";
import { previewTable } from "@/lib/server/results";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Falta path." }, { status: 400 });
    }
    return NextResponse.json(await previewTable(filePath));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer la tabla." },
      { status: 400 }
    );
  }
}
