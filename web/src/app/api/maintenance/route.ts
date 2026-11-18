import { authorizedMaintenance, removeExpiredRecords } from "../../../server/maintenance.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorizedMaintenance(request)) return Response.json({ message: "Não autorizado." }, { status: 401, headers });
  try { return Response.json(await removeExpiredRecords(), { headers }); }
  catch {
    console.error(JSON.stringify({ event: "maintenance_failed" }));
    return Response.json({ message: "Limpeza temporariamente indisponível." }, { status: 503, headers });
  }
}
