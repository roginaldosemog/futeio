/** Versioned business rule. Never round here: presentation and snapshots have different needs. */
export const RATING_CALCULATION_VERSION = 'trimmed-mean-v1';

export function discardedPerSide(count: number): 0 | 1 | 2 {
  return count >= 11 ? 2 : count >= 5 ? 1 : 0;
}

export function calculateRating(ratings: readonly number[]): number {
  if (ratings.length === 0 || ratings.some((rating) => !Number.isInteger(rating) || rating < 0 || rating > 10)) {
    throw new RangeError('At least one integer rating between zero and ten is required.');
  }
  const sorted = [...ratings].sort((left, right) => left - right);
  const trim = discardedPerSide(sorted.length);
  const included = sorted.slice(trim, sorted.length - trim);
  return included.reduce((sum, rating) => sum + rating, 0) / included.length;
}
