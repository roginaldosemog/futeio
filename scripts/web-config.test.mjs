import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('website has no external API proxy and preserves browser protections', async () => {
 const config = await readFile(new URL('../web/next.config.ts', import.meta.url), 'utf8');
 assert.doesNotMatch(config, /API_ORIGIN|rewrites/);
 for (const header of ['nosniff', 'DENY', 'no-referrer']) assert.ok(config.includes(header));
 const playwright = await readFile(new URL('../web/playwright.config.ts', import.meta.url), 'utf8');
 assert.match(playwright, /channel: 'chrome'/);
 assert.match(playwright, /chromiumSandbox: true/);
});
