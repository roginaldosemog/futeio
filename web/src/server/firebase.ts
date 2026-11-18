import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function config() {
  const mode = process.env.FUTEIO_FIREBASE_MODE;
  if (mode !== "emulator" && mode !== "production") throw new Error("Configure FUTEIO_FIREBASE_MODE explicitly.");
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const bucket = process.env.FIREBASE_STORAGE_BUCKET ?? "";
  const origin = process.env.APP_ORIGIN ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const adminUid = process.env.FIREBASE_ADMIN_UID ?? "";
  const apiKey = process.env.FIREBASE_WEB_API_KEY ?? "";
  const originUrl = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(originUrl.hostname);
  if (!["http:", "https:"].includes(originUrl.protocol) || originUrl.origin !== origin || originUrl.username || originUrl.password || (!local && originUrl.protocol !== "https:")) throw new Error("APP_ORIGIN must be an exact secure origin.");
  if (secret.length < 32 || !projectId || !adminUid || !adminEmail.includes("@") || !apiKey) throw new Error("Firebase server configuration is incomplete.");
  const hosts = [process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_STORAGE_EMULATOR_HOST];
  const storageAlias = process.env.STORAGE_EMULATOR_HOST;
  if (mode === "emulator") {
    if (!bucket || !projectId.startsWith("demo-") || !local || hosts.some((host) => !host || !/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(host))) {
      throw new Error("Emulator mode requires a demo project and three explicit loopback emulator hosts.");
    }
    if (storageAlias && storageAlias !== `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`) throw new Error("Emulator Storage endpoint must match the explicit loopback host.");
  } else if (projectId.startsWith("demo-") || hosts.some(Boolean) || storageAlias || originUrl.protocol !== "https:") {
    throw new Error("Production cannot use demo projects, emulators or an insecure origin.");
  }
  return { mode, projectId, bucket, origin, secret, adminEmail, adminUid, apiKey };
}

function credential(projectId: string, mode: string) {
  if (mode === "emulator") return applicationDefault();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Configure the Firebase service account on the server.");
  const account = JSON.parse(raw);
  if (account.type !== "service_account" || account.project_id !== projectId || typeof account.client_email !== "string" || typeof account.private_key !== "string") throw new Error("Invalid Firebase service account configuration.");
  return cert({ projectId, clientEmail: account.client_email, privateKey: account.private_key });
}

export function firebase() {
  const settings = config();
  const name = `futeio-${settings.projectId}`;
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({
    projectId: settings.projectId,
    ...(settings.mode === "emulator" ? { storageBucket: settings.bucket } : {}),
    credential: credential(settings.projectId, settings.mode),
  }, name);
  return { db: getFirestore(app), auth: getAuth(app) };
}

// Firebase Storage is only a local test service. Production photos use private Blob.
export function emulatorBucket() {
  const settings = config();
  if (settings.mode !== "emulator") throw new Error("Storage emulator is unavailable in production.");
  firebase();
  return getStorage(getApps().find((app) => app.name === `futeio-${settings.projectId}`)!).bucket(settings.bucket);
}
