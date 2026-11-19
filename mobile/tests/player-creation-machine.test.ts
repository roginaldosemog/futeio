import { initialPlayerCreation, playerCreationTransition, type PlayerCreationEvent, type PlayerCreationState } from '../src/features/administration/player-creation-machine';

const accessUrl = `https://example.test/acesso/jogador#token=${'P'.repeat(43)}`;
const created: PlayerCreationEvent = { type: 'created', name: 'Ana', accessUrl };
const run = (events: PlayerCreationEvent[], from: PlayerCreationState = initialPlayerCreation) => events.reduce(playerCreationTransition, from);

describe('player creation machine', () => {
  it('sends one request at a time', () => {
    const submitting = run([{ type: 'submit' }]);
    expect(submitting).toEqual({ status: 'submitting', concealed: false });
    for (const event of [{ type: 'submit' }, { type: 'invalid' }, { type: 'next' }, { type: 'reviewed' }, { type: 'hide' }] satisfies PlayerCreationEvent[]) {
      expect(playerCreationTransition(submitting, event)).toBe(submitting);
    }
  });

  it('accepts an outcome only from the request that is in flight', () => {
    for (const state of [initialPlayerCreation, run([{ type: 'submit' }, { type: 'uncertain' }])]) {
      expect(playerCreationTransition(state, created)).toBe(state);
      expect(playerCreationTransition(state, { type: 'rejected', reason: 'invalid' })).toBe(state);
    }
  });

  it('reports a local validation problem without leaving the form', () => {
    const invalid = run([{ type: 'invalid' }]);
    expect(invalid).toEqual({ status: 'editing', invalid: true });
    expect(playerCreationTransition(invalid, { type: 'invalid' })).toBe(invalid);
    expect(playerCreationTransition(invalid, { type: 'submit' })).toEqual({ status: 'submitting', concealed: false });
  });

  it('lets a refused creation be corrected and sent again', () => {
    const rejected = run([{ type: 'submit' }, { type: 'rejected', reason: 'conflict' }]);
    expect(rejected).toEqual({ status: 'rejected', reason: 'conflict' });
    expect(playerCreationTransition(rejected, { type: 'submit' })).toEqual({ status: 'submitting', concealed: false });
  });

  it('refuses another submission after an uncertain result until the roster was reviewed', () => {
    const uncertain = run([{ type: 'submit' }, { type: 'uncertain' }]);
    expect(playerCreationTransition(uncertain, { type: 'submit' })).toBe(uncertain);
    expect(playerCreationTransition(uncertain, { type: 'invalid' })).toBe(uncertain);
    const reviewed = playerCreationTransition(uncertain, { type: 'reviewed' });
    expect(reviewed).toEqual({ status: 'reviewed' });
    expect(playerCreationTransition(reviewed, { type: 'submit' })).toEqual({ status: 'submitting', concealed: false });
    expect(playerCreationTransition(initialPlayerCreation, { type: 'reviewed' })).toBe(initialPlayerCreation);
  });

  it('shows the link once and never restores it after it is hidden', () => {
    const receipt = run([{ type: 'submit' }, created]);
    expect(receipt).toEqual({ status: 'created', name: 'Ana', accessUrl });
    const hidden = playerCreationTransition(receipt, { type: 'hide' });
    expect(hidden).toEqual({ status: 'created', name: 'Ana', accessUrl: null });
    expect(playerCreationTransition(hidden, { type: 'hide' })).toBe(hidden);
    expect(playerCreationTransition(receipt, { type: 'conceal' })).toEqual(hidden);
    expect(playerCreationTransition(receipt, { type: 'next' })).toBe(initialPlayerCreation);
  });

  it('confirms a creation that finished in the background without revealing the link', () => {
    const concealed = run([{ type: 'submit' }, { type: 'conceal' }]);
    expect(concealed).toEqual({ status: 'submitting', concealed: true });
    expect(playerCreationTransition(concealed, created)).toEqual({ status: 'created', name: 'Ana', accessUrl: null });
    expect(playerCreationTransition(concealed, { type: 'uncertain' })).toEqual({ status: 'uncertain' });
  });
});
