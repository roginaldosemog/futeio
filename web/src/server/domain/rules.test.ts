import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRating, discardedPerSide } from "./calculate-rating.ts";
import { balanceTeams, teamIndicators } from "./balance-teams.ts";

test("ratings use the initial vote, average two votes and trim at five and eleven", () => {
  assert.equal(calculateRating([7]), 7);
  assert.equal(calculateRating([0, 9]), 4.5);
  assert.equal(discardedPerSide(4), 0);
  assert.equal(discardedPerSide(5), 1);
  assert.equal(discardedPerSide(10), 1);
  assert.equal(discardedPerSide(11), 2);
  assert.equal(calculateRating([0, 1, 2, 3, 10]), 2);
  assert.equal(calculateRating([0, 0, 1, 2, 3, 4, 5, 6, 7, 10, 10]), 4);
  assert.equal(calculateRating([0, 0, 0, 10, 10]), 10 / 3);
  const values = [10, 2, 0, 4, 8];
  const before = [...values];
  calculateRating(values);
  assert.deepEqual(values, before);
  for (const values of [[], [-1], [11], [2.5], [NaN], [Infinity]]) assert.throws(() => calculateRating(values), RangeError);
});

test("draws reproduce four teams of five without mutating players or using input order", () => {
  const players = Array.from({ length: 20 }, (_, index) => ({ id: `player-${index}`, rating: index % 11 }));
  const before = structuredClone(players);
  const draw = balanceTeams(players, "reproducible-seed");
  assert.deepEqual(draw.teams.map((team) => team.length), [5, 5, 5, 5]);
  assert.equal(new Set(draw.teams.flat().map((player) => player.id)).size, 20);
  assert.deepEqual(draw, balanceTeams([...players].reverse(), "reproducible-seed"));
  assert.deepEqual(players, before);
  assert.deepEqual(teamIndicators(draw.teams), { spread: draw.spread, variance: draw.variance });
  assert.equal(balanceTeams(players.map((player) => ({ ...player, rating: 10 })), "equal").spread, 0);
  assert.throws(() => balanceTeams(players.slice(1), "seed"), RangeError);
  assert.throws(() => balanceTeams([...players.slice(1), players[1]!], "seed"), RangeError);
  assert.throws(() => balanceTeams(players, ""), RangeError);
  assert.throws(() => balanceTeams(players, "x".repeat(65)), RangeError);
  for (const rating of [-1, 11, Infinity, NaN]) assert.throws(() => balanceTeams([{ ...players[0]!, rating }, ...players.slice(1)], "seed"), RangeError);
});
