/**
 * Rotating or revoking a player's personal link.
 *
 *   idle ──choose──▶ confirming ──confirm──▶ submitting ──rotated──▶ rotated ──hide──▶ idle
 *    ▲                   │           ▲           │       ──revoked──▶ revoked
 *    └─────cancel────────┘           │           └───────failed────▶ failed
 *                                    └──────────confirm (retry)────────┘
 *
 * `choose` restarts from any settled state, so a result or an error from the
 * previous attempt never sits beside a new confirmation. A link is a
 * credential: it exists only in `rotated` and is gone after `hide`.
 *
 * Catalog: docs/maquinas-de-estado.md.
 */
export type LinkAction = "rotate" | "revoke";

export type LinkAccessState =
  | { status: "idle" }
  | { status: "confirming"; action: LinkAction }
  | { status: "submitting"; action: LinkAction }
  | { status: "rotated"; url: string; copy: "idle" | "copied" | "unavailable" }
  | { status: "revoked" }
  /** `action` keeps the confirmation open for a retry; `null` after cancel. */
  | { status: "failed"; action: LinkAction | null };

export type LinkAccessEvent =
  | { type: "choose"; action: LinkAction }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "rotated"; url: string }
  | { type: "revoked" }
  | { type: "failed" }
  | { type: "copied" }
  | { type: "copyUnavailable" }
  | { type: "hide" };

export const initialLinkAccess: LinkAccessState = { status: "idle" };

export function linkAccessTransition(
  state: LinkAccessState,
  event: LinkAccessEvent,
): LinkAccessState {
  switch (event.type) {
    case "choose":
      return state.status === "submitting"
        ? state
        : { status: "confirming", action: event.action };
    case "cancel":
      if (state.status === "confirming") return { status: "idle" };
      if (state.status === "failed" && state.action) return { status: "failed", action: null };
      return state;
    case "confirm":
      return (state.status === "confirming" || state.status === "failed") && state.action
        ? { status: "submitting", action: state.action }
        : state;
    case "rotated":
      return state.status === "submitting"
        ? { status: "rotated", url: event.url, copy: "idle" }
        : state;
    case "revoked":
      return state.status === "submitting" ? { status: "revoked" } : state;
    case "failed":
      return state.status === "submitting" ? { status: "failed", action: state.action } : state;
    case "copied":
      return state.status === "rotated" && state.copy !== "copied"
        ? { ...state, copy: "copied" }
        : state;
    case "copyUnavailable":
      return state.status === "rotated" && state.copy !== "unavailable"
        ? { ...state, copy: "unavailable" }
        : state;
    case "hide":
      return state.status === "rotated" ? { status: "idle" } : state;
  }
}
