import { initialLinkAccess, linkAccessTransition, type LinkAccessEvent, type LinkAccessState } from '../src/features/administration/link-access-machine';
import { AccessError } from '../src/lib/api';
import { writeFailure } from '../src/lib/write-outcome';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const url = `https://example.test/acesso/jogador#token=${'P'.repeat(43)}`;
const run = (events: LinkAccessEvent[], from: LinkAccessState = initialLinkAccess) => events.reduce(linkAccessTransition, from);

describe('link access machine', () => {
  it('reaches the server only through an explicit confirmation', () => {
    expect(run([{ type: 'confirm' }])).toBe(initialLinkAccess);
    expect(run([{ type: 'choose', action: 'rotate' }, { type: 'cancel' }])).toEqual({ status: 'idle' });
    expect(run([{ type: 'choose', action: 'revoke' }, { type: 'confirm' }])).toEqual({ status: 'submitting', action: 'revoke', concealed: false });
  });

  it('ignores every user event while a request is in flight', () => {
    const submitting = run([{ type: 'choose', action: 'rotate' }, { type: 'confirm' }]);
    for (const event of [{ type: 'confirm' }, { type: 'cancel' }, { type: 'choose', action: 'revoke' }, { type: 'hide' }] satisfies LinkAccessEvent[]) {
      expect(linkAccessTransition(submitting, event)).toBe(submitting);
    }
  });

  it('accepts an outcome only from the request that is in flight', () => {
    for (const state of [initialLinkAccess, run([{ type: 'choose', action: 'rotate' }])]) {
      expect(linkAccessTransition(state, { type: 'rotated', url })).toBe(state);
      expect(linkAccessTransition(state, { type: 'revoked' })).toBe(state);
      expect(linkAccessTransition(state, { type: 'failed' })).toBe(state);
    }
  });

  it('shows a rotated link until it is hidden and never restores it', () => {
    const rotated = run([{ type: 'choose', action: 'rotate' }, { type: 'confirm' }, { type: 'rotated', url }]);
    expect(rotated).toEqual({ status: 'rotated', url });
    const hidden = linkAccessTransition(rotated, { type: 'hide' });
    expect(hidden).toEqual({ status: 'rotated', url: null });
    expect(linkAccessTransition(hidden, { type: 'hide' })).toBe(hidden);
    expect(linkAccessTransition(rotated, { type: 'conceal' })).toEqual({ status: 'rotated', url: null });
  });

  it('reports a rotation that finished in the background without revealing the link', () => {
    const concealed = run([{ type: 'choose', action: 'rotate' }, { type: 'confirm' }, { type: 'conceal' }]);
    expect(concealed).toEqual({ status: 'submitting', action: 'rotate', concealed: true });
    expect(linkAccessTransition(concealed, { type: 'rotated', url })).toEqual({ status: 'rotated', url: null });
    expect(linkAccessTransition(concealed, { type: 'revoked' })).toEqual({ status: 'revoked' });
    expect(linkAccessTransition(concealed, { type: 'failed' })).toEqual({ status: 'failed' });
  });

  it('drops an unconfirmed choice when the app leaves the foreground', () => {
    expect(run([{ type: 'choose', action: 'revoke' }, { type: 'conceal' }])).toEqual({ status: 'idle' });
  });

  it('starts over from any settled state and clears the previous result', () => {
    const settled: LinkAccessState[] = [{ status: 'rotated', url }, { status: 'revoked' }, { status: 'failed' }];
    for (const state of settled) expect(linkAccessTransition(state, { type: 'choose', action: 'rotate' })).toEqual({ status: 'confirming', action: 'rotate' });
  });
});

describe('write failure', () => {
  it('lets a refused request be corrected and sent again', () => {
    for (const status of [400, 401, 403, 404, 409]) expect(writeFailure(new AccessError(status))).toBe('rejected');
  });

  it('treats anything the server may have recorded as uncertain', () => {
    for (const status of [429, 500, 502, 503]) expect(writeFailure(new AccessError(status))).toBe('uncertain');
    expect(writeFailure(new Error('offline'))).toBe('uncertain');
    expect(writeFailure(undefined)).toBe('uncertain');
  });
});
