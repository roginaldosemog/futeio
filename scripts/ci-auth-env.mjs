import { appendFileSync } from 'node:fs';
import { createAdminFixture } from '../api/test/support/admin-fixture.mjs';

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV) {
  throw new Error('CI authentication fixtures require the GitHub Actions environment file.');
}

const fixtures = createAdminFixture('http://127.0.0.1:3000');
appendFileSync(process.env.GITHUB_ENV, `${Object.entries(fixtures).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
console.log('Configured isolated CI authentication fixtures.');
