import "server-only";
import { timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firebase } from "./firebase.ts";

export function authorizedMaintenance(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function removeExpiredRecords() {
  const { db } = firebase();
  const cutoff = Timestamp.now();
  let deleted = 0;
  // Bounded daily work fits the pilot and avoids unbounded serverless execution.
  // Expiry is enforced by auth/rate-limit checks even if this job is delayed.
  for (const name of ["sessions", "rateLimits"]) {
    for (let page = 0; page < 2; page++) {
      const expired = await db.collection(name).where("expiresAt", "<=", cutoff).orderBy("expiresAt").limit(250).get();
      if (expired.empty) break;
      const batch = db.batch();
      for (const doc of expired.docs) batch.delete(doc.ref, { lastUpdateTime: doc.updateTime! });
      await batch.commit();
      deleted += expired.size;
      if (expired.size < 250) break;
    }
  }
  return { deleted };
}
