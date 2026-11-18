import { randomUUID } from "node:crypto";
import { config, firebase } from "@/server/firebase";
import { HttpError } from "@/server/context";
import { csrfResponse, currentSession, loginAdministrator, logout, redeemPlayer, requireCsrf, rateLimit } from "@/server/access";
import * as players from "@/server/players";
import * as draws from "@/server/draws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200, cookie?: string) {
  return Response.json(body ?? { message: "Concluído." }, {
    status, headers: { "Cache-Control": "private, no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
}

async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Envie dados JSON.");
  if (Number(request.headers.get("content-length")) > 2_800_000) throw new HttpError(413, "Dados muito grandes.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Dados inválidos.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2_800_000) { await reader.cancel(); throw new HttpError(413, "Dados muito grandes."); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "JSON inválido.");
  } finally { reader.releaseLock(); }
}

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const requestId = randomUUID();
  try {
    const path = (await context.params).path;
    const route = path.join("/");
    const method = request.method;
    if (method === "GET" && route === "health/live") return json({ status: "ok" });
    config();
    if (method === "GET" && route === "health/ready") {
      await firebase().db.doc("health/readiness").get();
      return json({ status: "ok" });
    }
    if (method === "GET" && route === "auth/csrf") {
      const result = await csrfResponse(request);
      return json(result.body, 200, result.cookie);
    }
    if (method !== "GET") await requireCsrf(request);
    if (method === "POST" && ["auth/admin/login", "auth/player/redeem", "auth/logout"].includes(route)) {
      const result = route === "auth/logout" ? await logout(request)
        : route === "auth/admin/login" ? await loginAdministrator(request, await readBody(request))
          : await redeemPlayer(request, await readBody(request));
      return json(result.body, 200, result.cookie);
    }
    const session = await currentSession(request);
    if (method === "GET" && route === "auth/me") return json(session);
    if (route === "players") {
      if (method === "GET") return json(await players.listPlayers(session));
      if (method === "POST") return json(await players.createPlayer(session, await readBody(request)), 201);
    }
    if (path[0] === "players" && path[1]) {
      const id = path[1];
      const sub = path.slice(2).join("/");
      if (method === "GET" && !sub) return json(await players.getPlayer(session, id));
      if (sub === "evaluations") {
        if (method === "GET") return json(await players.getEvaluations(session, id));
        if (method === "POST") return json(await players.ratePlayer(session, id, await readBody(request)));
      }
      if (method === "POST" && sub === "profile") return json(await players.updatePlayer(session, id, await readBody(request)));
      if (sub === "photo") {
        if (method === "GET") {
          const bytes = await players.getPhoto(session, id);
          return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
        }
        if (method === "POST" || method === "DELETE") {
          await rateLimit("photo", session.identityId, 15);
          return json(method === "POST" ? await players.uploadPhoto(session, id, await readBody(request)) : await players.removePhoto(session, id));
        }
      }
      if (method === "POST" && sub === "access-link/rotate") return json(await players.rotateLink(session, id));
      if (method === "DELETE" && sub === "access-link") return json(await players.revokeLink(session, id));
    }
    if (route === "draws") {
      if (method === "GET") return json(await draws.listDraws(session));
      if (method === "POST") return json(await draws.createDraw(session, await readBody(request)), 201);
    }
    if (method === "GET" && path[0] === "draws" && path.length === 2) return json(await draws.getDraw(session, path[1]!));
    throw new HttpError(404, "Recurso não encontrado.");
  } catch (error) {
    if (error instanceof HttpError) return json({ message: error.message }, error.status);
    // Do not log request bodies, paths, Firebase errors or credentials.
    console.error(JSON.stringify({ event: "request_failed", requestId }));
    return json({ message: "Serviço indisponível. Tente novamente em instantes.", requestId }, 503);
  }
}

export { handle as GET, handle as POST, handle as DELETE };
