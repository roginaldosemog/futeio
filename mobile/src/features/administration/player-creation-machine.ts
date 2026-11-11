/**
 * Creating a player. The request is not idempotent and its result carries a
 * personal link that is shown once.
 *
 *   editing ──submit──▶ submitting ──created────▶ created ──next──▶ editing
 *      ▲                    │        ──rejected──▶ rejected ──submit──▶ submitting
 *      └──invalid──┐        └────────uncertain──▶ uncertain ──reviewed──▶ reviewed ──submit──▶ submitting
 *
 * `uncertain` accepts no submission: the player may already exist, so the
 * roster must be refreshed first. `conceal` is sent when the app leaves the
 * foreground: the link is dropped and a late response never brings it back,
 * but the confirmed creation is still reported.
 *
 * Catalog: docs/maquinas-de-estado.md.
 */
export type PlayerCreationState =
  | { status: 'editing'; invalid: boolean }
  | { status: 'submitting'; concealed: boolean }
  /** `accessUrl: null` means the link was hidden and cannot be shown again. */
  | { status: 'created'; name: string; accessUrl: string | null }
  | { status: 'rejected'; reason: 'invalid' | 'conflict' | 'other' }
  | { status: 'uncertain' }
  | { status: 'reviewed' };

export type PlayerCreationEvent =
  | { type: 'invalid' }
  | { type: 'submit' }
  | { type: 'created'; name: string; accessUrl: string }
  | { type: 'rejected'; reason: 'invalid' | 'conflict' | 'other' }
  | { type: 'uncertain' }
  | { type: 'reviewed' }
  | { type: 'hide' }
  | { type: 'conceal' }
  | { type: 'next' };

export const initialPlayerCreation: PlayerCreationState = { status: 'editing', invalid: false };

const open = (state: PlayerCreationState) => state.status === 'editing' || state.status === 'rejected' || state.status === 'reviewed';

export function playerCreationTransition(state: PlayerCreationState, event: PlayerCreationEvent): PlayerCreationState {
  switch (event.type) {
    case 'invalid':
      return open(state) && !(state.status === 'editing' && state.invalid) ? { status: 'editing', invalid: true } : state;
    case 'submit':
      return open(state) ? { status: 'submitting', concealed: false } : state;
    case 'created':
      return state.status === 'submitting' ? { status: 'created', name: event.name, accessUrl: state.concealed ? null : event.accessUrl } : state;
    case 'rejected':
      return state.status === 'submitting' ? { status: 'rejected', reason: event.reason } : state;
    case 'uncertain':
      return state.status === 'submitting' ? { status: 'uncertain' } : state;
    case 'reviewed':
      return state.status === 'uncertain' ? { status: 'reviewed' } : state;
    case 'hide':
      return state.status === 'created' && state.accessUrl !== null ? { ...state, accessUrl: null } : state;
    case 'conceal':
      if (state.status === 'submitting' && !state.concealed) return { status: 'submitting', concealed: true };
      if (state.status === 'created' && state.accessUrl !== null) return { ...state, accessUrl: null };
      return state;
    case 'next':
      return state.status === 'created' ? initialPlayerCreation : state;
  }
}
