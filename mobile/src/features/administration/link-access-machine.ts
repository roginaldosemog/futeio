/**
 * Rotating or revoking a player's personal link.
 *
 *   idle ──choose──▶ confirming ──confirm──▶ submitting ──rotated──▶ rotated
 *    ▲                   │                       │       ──revoked──▶ revoked
 *    └─────cancel────────┘                       └───────failed────▶ failed
 *
 * `choose` restarts from any settled state. `conceal` is sent when the app
 * leaves the foreground: a link is a credential, so it is dropped from the
 * screen and a response that arrives later never brings it back. The outcome
 * itself (rotated, revoked, failed) is still reported, because the previous
 * link stopped working either way.
 *
 * Catalog: docs/mobile-estados.md.
 */
export type LinkAction = 'rotate' | 'revoke';

export type LinkAccessState =
  | { status: 'idle' }
  | { status: 'confirming'; action: LinkAction }
  | { status: 'submitting'; action: LinkAction; concealed: boolean }
  /** `url: null` means the link was hidden and cannot be shown again. */
  | { status: 'rotated'; url: string | null }
  | { status: 'revoked' }
  | { status: 'failed' };

export type LinkAccessEvent =
  | { type: 'choose'; action: LinkAction }
  | { type: 'cancel' }
  | { type: 'confirm' }
  | { type: 'rotated'; url: string }
  | { type: 'revoked' }
  | { type: 'failed' }
  | { type: 'hide' }
  | { type: 'conceal' };

export const initialLinkAccess: LinkAccessState = { status: 'idle' };

export function linkAccessTransition(state: LinkAccessState, event: LinkAccessEvent): LinkAccessState {
  switch (event.type) {
    case 'choose':
      return state.status === 'submitting' ? state : { status: 'confirming', action: event.action };
    case 'cancel':
      return state.status === 'confirming' ? { status: 'idle' } : state;
    case 'confirm':
      return state.status === 'confirming' ? { status: 'submitting', action: state.action, concealed: false } : state;
    case 'rotated':
      return state.status === 'submitting' ? { status: 'rotated', url: state.concealed ? null : event.url } : state;
    case 'revoked':
      return state.status === 'submitting' ? { status: 'revoked' } : state;
    case 'failed':
      return state.status === 'submitting' ? { status: 'failed' } : state;
    case 'hide':
      return state.status === 'rotated' && state.url !== null ? { status: 'rotated', url: null } : state;
    case 'conceal':
      if (state.status === 'confirming') return { status: 'idle' };
      if (state.status === 'submitting' && !state.concealed) return { ...state, concealed: true };
      if (state.status === 'rotated' && state.url !== null) return { status: 'rotated', url: null };
      return state;
  }
}
