export const DRAW_ALGORITHM_VERSION = 'seeded-greedy-swaps-v1';
export const DRAW_ATTEMPTS = 64;
export const DRAW_MAX_SWAPS = 32;

export interface RatedPlayer { id: string; rating: number }
export interface BalancedTeams { teams: RatedPlayer[][]; spread: number; variance: number }

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(input: readonly T[], random: () => number): T[] {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function teamIndicators(teams: readonly (readonly RatedPlayer[])[]): { spread: number; variance: number } {
  const sums = teams.map((team) => team.reduce((sum, player) => sum + player.rating, 0));
  const average = sums.reduce((sum, total) => sum + total, 0) / sums.length;
  return { spread: Math.max(...sums) - Math.min(...sums), variance: sums.reduce((sum, total) => sum + (total - average) ** 2, 0) / sums.length };
}

function improves(candidate: { spread: number; variance: number }, current: { spread: number; variance: number }): boolean {
  const tolerance = 1e-10;
  return candidate.spread < current.spread - tolerance || (Math.abs(candidate.spread - current.spread) <= tolerance && candidate.variance < current.variance - tolerance);
}

/** Fixed search budget and canonical input make reproduction independent of database order and CPU speed. */
export function balanceTeams(input: readonly RatedPlayer[], seed: string): BalancedTeams {
  const seedLength = [...seed].length;
  if (input.length !== 20 || new Set(input.map((player) => player.id)).size !== 20 || input.some((player) => !player.id || !Number.isFinite(player.rating) || player.rating < 0 || player.rating > 10) || seedLength === 0 || seedLength > 64) {
    throw new RangeError('Twenty distinct rated players and a seed of one to sixty-four characters are required.');
  }
  const canonical = [...input].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const random = seededRandom(seed);
  let best: BalancedTeams | undefined;
  for (let attempt = 0; attempt < DRAW_ATTEMPTS; attempt++) {
    const ordered = shuffled(canonical, random).sort((left, right) => right.rating - left.rating);
    const teams: RatedPlayer[][] = Array.from({ length: 4 }, () => []);
    for (const player of ordered) {
      const available = shuffled([0, 1, 2, 3], random).filter((index) => teams[index]!.length < 5);
      available.sort((left, right) => teams[left]!.reduce((sum, member) => sum + member.rating, 0) - teams[right]!.reduce((sum, member) => sum + member.rating, 0));
      teams[available[0]!]!.push({ ...player });
    }
    let score = teamIndicators(teams);
    for (let pass = 0; pass < DRAW_MAX_SWAPS; pass++) {
      let swap: [number, number, number, number] | undefined;
      let improvedScore = score;
      for (let left = 0; left < 4; left++) for (let right = left + 1; right < 4; right++) {
        for (let first = 0; first < 5; first++) for (let second = 0; second < 5; second++) {
          const one = teams[left]![first]!;
          const two = teams[right]![second]!;
          teams[left]![first] = two; teams[right]![second] = one;
          const candidate = teamIndicators(teams);
          teams[left]![first] = one; teams[right]![second] = two;
          if (improves(candidate, improvedScore)) { improvedScore = candidate; swap = [left, right, first, second]; }
        }
      }
      if (!swap) break;
      const [left, right, first, second] = swap;
      [teams[left]![first], teams[right]![second]] = [teams[right]![second]!, teams[left]![first]!];
      score = improvedScore;
    }
    if (!best || improves(score, best)) best = { teams, ...score };
  }
  return best!;
}
