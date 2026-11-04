import { balanceTeams, DRAW_ALGORITHM_VERSION } from './balance-teams';

const players = Array.from({ length: 20 }, (_, index) => ({ id: `player-${String(index).padStart(2, '0')}`, rating: index % 11 }));

describe('deterministic team balancing', () => {
  it('uses every player once in four teams of five without mutating the input', () => {
    const original = structuredClone(players);
    const result = balanceTeams(players, 'invariants');
    expect(result.teams).toHaveLength(4);
    expect(result.teams.every((team) => team.length === 5)).toBe(true);
    expect(result.teams.flat().map((player) => player.id).sort()).toEqual(players.map((player) => player.id).sort());
    expect(players).toEqual(original);
    expect(DRAW_ALGORITHM_VERSION).toBe('seeded-greedy-swaps-v1');
  });
  it('reproduces the same result despite input order', () => {
    expect(balanceTeams([...players].reverse(), 'reproducible')).toEqual(balanceTeams(players, 'reproducible'));
  });
  it('finds the known perfectly balanced distribution for ratings zero through nine twice', () => {
    const result = balanceTeams(players.map((player, index) => ({ ...player, rating: index % 10 })), 'known-solution');
    expect(result.spread).toBe(1); // Total 90 cannot be split into four equal integer totals.
    expect(result.variance).toBe(0.25);
  });
  it('handles equal ratings and extreme values', () => {
    expect(balanceTeams(players.map((player) => ({ ...player, rating: 7 })), 'equal')).toMatchObject({ spread: 0, variance: 0 });
    expect(balanceTeams(players.map((player, index) => ({ ...player, rating: index < 4 ? 10 : 0 })), 'extremes')).toMatchObject({ spread: 0, variance: 0 });
  });
  it('accepts fractional effective ratings without rounding them', () => {
    const result = balanceTeams(players.map((player) => ({ ...player, rating: 4 / 3 })), 'fractions');
    expect(result.teams.flat().every((player) => player.rating === 4 / 3)).toBe(true);
    expect(result.spread).toBe(0);
  });
  it.each([19, 21])('rejects %i participants', (count) => {
    expect(() => balanceTeams(Array.from({ length: count }, (_, index) => ({ id: String(index), rating: 5 })), 'invalid')).toThrow(RangeError);
  });
  it('rejects duplicate IDs, invalid ratings and empty seeds', () => {
    expect(() => balanceTeams([...players.slice(0, 19), players[0]!], 'duplicate')).toThrow(RangeError);
    for (const rating of [-1, 11, NaN, Infinity]) expect(() => balanceTeams([{ ...players[0]!, rating }, ...players.slice(1)], 'invalid')).toThrow(RangeError);
    expect(() => balanceTeams(players, '')).toThrow(RangeError);
  });
});
