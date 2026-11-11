"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessError, currentSession, type SessionResponse } from "./access-client";

/**
 * Whether this browser may see a private page.
 *
 *   checking ──session confirmed──▶ granted
 *      │  ▲
 *      │  └──retry── unavailable ◀──verification failed (not 401)
 *      └──401 or wrong role──▶ leaves the page (redirect, stays `checking`)
 *
 * Private content renders only from `granted`, which is the only state that
 * carries a session. Catalog: docs/maquinas-de-estado.md.
 */
export type SessionGate =
  | { status: "checking" }
  | { status: "unavailable"; retry: () => void }
  | { status: "granted"; session: SessionResponse };

type Verification =
  | { status: "checking" }
  | { status: "unavailable" }
  | { status: "granted"; session: SessionResponse };

export function useSessionGate({
  adminOnly = false,
  nonAdminPath = "/entrar",
}: {
  /** Require an administrator session. */
  adminOnly?: boolean;
  /** Where a signed-in player is sent when `adminOnly` refuses them. */
  nonAdminPath?: string;
} = {}): SessionGate {
  const router = useRouter();
  const [verification, setVerification] = useState<Verification>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    currentSession(controller.signal)
      .then((session) => {
        if (controller.signal.aborted) return;
        if (adminOnly && session.role !== "ADMIN") router.replace(nonAdminPath);
        else setVerification({ status: "granted", session });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof AccessError && error.status === 401) router.replace("/entrar");
        else setVerification({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [adminOnly, nonAdminPath, attempt, router]);
  const retry = useCallback(() => {
    setVerification({ status: "checking" });
    setAttempt((value) => value + 1);
  }, []);
  return verification.status === "unavailable" ? { status: "unavailable", retry } : verification;
}
