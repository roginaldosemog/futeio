import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { config } from "./firebase.ts";
import { HttpError } from "./context.ts";

export function requestSource(request: Request): string {
  const settings = config();
  let source: string;
  if (process.env.VERCEL === "1") {
    // Vercel overwrites this header at its ingress. Do not trust generic XFF,
    // cookies or caller-provided identity as an alternative source of IPs.
    const ip = request.headers.get("x-vercel-forwarded-for")?.trim() ?? "";
    const family = ip.length <= 64 ? isIP(ip) : 0;
    if (!family) throw new HttpError(503, "Não foi possível verificar a origem da solicitação.");
    source = family === 6 ? new URL(`http://[${ip}]`).hostname : ip;
  } else if (settings.mode === "emulator") {
    // Direct local development has no trusted reverse proxy.
    source = "local-emulator";
  } else {
    throw new HttpError(503, "Não foi possível verificar a origem da solicitação.");
  }
  // Keep raw IPs out of Firestore, logs and API responses.
  return createHmac("sha256", settings.secret).update(`futeio:source:v1:${source}`).digest("hex");
}
