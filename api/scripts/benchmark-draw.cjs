// Synthetic search measurements, never a claim about adoption or on-field balance.
const { performance } = require('node:perf_hooks');
const { balanceTeams, DRAW_ALGORITHM_VERSION, DRAW_ATTEMPTS, DRAW_MAX_SWAPS } = require('../dist/modules/draws/balance-teams.js');

const scenarios = {
  equal: Array(20).fill(7),
  extremes: Array.from({ length: 20 }, (_, index) => index < 4 ? 10 : 0),
  integer: Array.from({ length: 20 }, (_, index) => index % 11),
  fractional: Array.from({ length: 20 }, (_, index) => ((index * 7) % 31) / 3),
};
for (const [scenario, ratings] of Object.entries(scenarios)) {
  const players = ratings.map((rating, index) => ({ id: `synthetic-${String(index).padStart(2, '0')}`, rating }));
  for (let warmup = 0; warmup < 3; warmup++) balanceTeams(players, `benchmark-${warmup}`);
  const measurements = [];
  const spreads = [];
  for (let iteration = 0; iteration < 20; iteration++) {
    const started = performance.now();
    const result = balanceTeams(players, `benchmark-${iteration}`);
    measurements.push(performance.now() - started);
    spreads.push(result.spread);
  }
  measurements.sort((left, right) => left - right);
  process.stdout.write(`${JSON.stringify({ scenario, synthetic: true, algorithmVersion: DRAW_ALGORITHM_VERSION, attempts: DRAW_ATTEMPTS, maxSwapsPerAttempt: DRAW_MAX_SWAPS, runs: measurements.length,
    medianMs: Number(((measurements[9] + measurements[10]) / 2).toFixed(3)), p95Ms: Number(measurements[Math.ceil(measurements.length * 0.95) - 1].toFixed(3)), maxMs: Number(measurements[19].toFixed(3)), minSpread: Math.min(...spreads), maxSpread: Math.max(...spreads) })}\n`);
}
