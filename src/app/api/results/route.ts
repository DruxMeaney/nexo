import { NextResponse } from "next/server";
import { getDictionary } from "@/lib/i18n/server";
import { summarizeResults } from "@/lib/server/results";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const outputDir = url.searchParams.get("outputDir");
    // Los pies de figura y tabla salen del diccionario, asi que esta ruta debe
    // resolver el idioma igual que una pagina: lee la cookie `locale`.
    const summary = await summarizeResults(outputDir, await getDictionary());
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los resultados." },
      { status: 400 }
    );
  }
}
