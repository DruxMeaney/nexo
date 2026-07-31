/**
 * POST /api/pipeline/run  —  retirada.
 *
 * El runner heredado spawneaba el CLI con `--contaminants`, `--diseases`,
 * `--context-radius` y `--relation-distance`, banderas eliminadas en la fase 5,
 * y sin el `--protocol` que ahora es obligatorio: cada ejecucion terminaba en
 * argparse con codigo 2. En lugar de dejar una ruta que falla siempre, se
 * responde 410 y se apunta al runner por protocolo.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RETIRED_MESSAGE =
  "Esta ruta fue reemplazada por POST /api/pipeline/run-protocol, que ejecuta el pipeline con una carpeta de protocolo (config/protocols/{slug}). Crea o carga un protocolo y ejecutalo desde /ejecutar.";

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 });
}
