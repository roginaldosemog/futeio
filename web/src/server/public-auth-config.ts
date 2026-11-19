import "server-only";
import { config } from "./firebase";

export function publicGoogleConfig() {
  const settings = config();
  return {
    apiKey: settings.apiKey,
    projectId: settings.projectId,
    authDomain: `${settings.projectId}.firebaseapp.com`,
    ...(process.env.FIREBASE_WEB_APP_ID ? { appId: process.env.FIREBASE_WEB_APP_ID } : {}),
    ...(settings.mode === "emulator" ? { emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST } : {}),
  };
}
