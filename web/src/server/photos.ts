import "server-only";
import { del, get, put } from "@vercel/blob";
import { config, emulatorBucket } from "./firebase.ts";
import { GROUP_ID, HttpError } from "./context.ts";

function checkedPath(path: string) {
  // Only server-generated group/player paths are accepted, never URLs or user paths.
  if (!new RegExp(`^groups/${GROUP_ID}/players/[a-f0-9-]{36}/[a-f0-9-]{36}\\.jpg$`).test(path)) throw new Error("Invalid private photo path.");
  return path;
}

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("Configure the private Blob store token on the server.");
  return value;
}

export async function savePhoto(path: string, bytes: Buffer) {
  checkedPath(path);
  if (config().mode === "emulator") {
    await emulatorBucket().file(path).save(bytes, { resumable: false, metadata: { contentType: "image/jpeg", cacheControl: "private, no-store" } });
    return;
  }
  await put(path, bytes, { access: "private", token: token(), addRandomSuffix: false, allowOverwrite: false, contentType: "image/jpeg" });
}

export async function readPhoto(path: string): Promise<Buffer> {
  checkedPath(path);
  if (config().mode === "emulator") {
    try { return (await emulatorBucket().file(path).download())[0]; }
    catch (error) {
      if ((error as { code?: number }).code === 404) throw new HttpError(404, "Foto não encontrada.");
      throw error;
    }
  }
  const result = await get(path, { access: "private", token: token(), useCache: false });
  if (!result || result.statusCode !== 200) throw new HttpError(404, "Foto não encontrada.");
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function deletePhoto(path: string | undefined) {
  if (!path) return;
  checkedPath(path);
  if (config().mode === "emulator") await emulatorBucket().file(path).delete({ ignoreNotFound: true });
  else await del(path, { token: token() });
}
