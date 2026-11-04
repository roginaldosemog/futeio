import { calculateRating, discardedPerSide } from './calculate-rating';

describe('consolidated rating', () => {
  it.each([
    [[7], 7], [[7, 9], 8], [[2, 4, 6, 8], 5],
    [[0, 4, 6, 8, 10], 6], [[0, 2, 4, 6, 8, 10], 5],
    [[0, 1, 2, 3, 4, 5, 6, 7, 8, 10], 4.5],
    [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5],
    [[0, 0, 5, 10, 10], 5], [Array(20).fill(7), 7],
  ] as Array<[number[], number]>)('calculates %j as %s', (input, expected) => {
    const original = [...input];
    expect(calculateRating(input)).toBe(expected);
    expect(input).toEqual(original);
  });
  it('keeps unrounded precision and removes occurrences, including tied extremes', () => {
    expect(calculateRating([0, 0, 1, 2, 10])).toBe(1);
    expect(calculateRating([0, 0, 1, 1, 2, 3, 4, 5, 10, 10, 10])).toBe(26 / 7);
    expect(calculateRating([1, 1, 2])).toBe(4 / 3);
  });
  it.each([[1, 0], [2, 0], [4, 0], [5, 1], [10, 1], [11, 2], [15, 2], [100, 2]])('trims %i votes by %i per side', (count, trim) => {
    expect(discardedPerSide(count)).toBe(trim);
  });
  it.each([[], [-1], [11], [1.5], [NaN], [Infinity]].map((ratings) => [ratings]))('rejects invalid contributions %j', (ratings) => {
    expect(() => calculateRating(ratings)).toThrow(RangeError);
  });
});
