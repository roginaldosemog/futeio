import { AccessError } from "./api-client";

/**
 * How a non-idempotent write (create player, create draw) failed.
 *
 * - `rejected`: the server refused the request, so nothing was recorded. The
 *   input may be corrected and submitted again.
 * - `uncertain`: timeout, lost connection, 5xx or 429. The write may have been
 *   recorded, so the page must reconcile with the server (refresh the list,
 *   open the history) before offering the same action again.
 *
 * Catalog: docs/maquinas-de-estado.md.
 */
export type WriteFailure = "rejected" | "uncertain";

export function writeFailure(error: unknown): WriteFailure {
  return error instanceof AccessError && error.status < 500 && error.status !== 429
    ? "rejected"
    : "uncertain";
}
