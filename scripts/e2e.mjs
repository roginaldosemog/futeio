import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assertPortsAvailable } from './ports.mjs';
import { createProcessGroup } from './process-group.mjs';

const require = createRequire(import.meta.url);
const { requireTestDatabaseUrl } = require('../api/scripts/test-database.cjs');
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const apiDirectory = fileURLToPath(new URL('../api/', import.meta.url));
const webDirectory = fileURLToPath(new URL('../web/', import.meta.url));
const baseUrl = 'http://127.0.0.1:3100';
const apiOrigin = 'http://127.0.0.1:3101';
const runtimeKeys = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'CI']);
const runtimeEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => runtimeKeys.has(key.toUpperCase())));
const group = createProcessGroup();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void group.stop().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--serve')) {
    throw new Error('Usage: pnpm test:e2e [--serve]');
  }
  if (args[0] === '--serve' && !process.stdin.isTTY) {
    throw new Error('The review server requires an interactive terminal; run the normal test:e2e command for automated validation.');
  }
  requireTestDatabaseUrl(process.env);
  await assertPortsAvailable([{ host: '127.0.0.1', port: 3100 }, { host: '127.0.0.1', port: 3101 }]);
  const buildEnvironment = { ...runtimeEnvironment, NEXT_TELEMETRY_DISABLED: '1', API_ORIGIN: apiOrigin };
  await group.run('API compilation', ['node_modules/typescript/bin/tsc', '-p', 'api/tsconfig.build.json'], repositoryRoot, runtimeEnvironment);
  await group.run('Production web build for E2E', ['node_modules/next/dist/bin/next', 'build'], webDirectory, buildEnvironment, { showOutput: true });

  group.start('Isolated E2E API', ['test/support/e2e-server.mjs'], apiDirectory, {
    ...runtimeEnvironment,
    DATABASE_URL: process.env.DATABASE_URL,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  }, { ipc: true });
  group.start('Production E2E web', ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], webDirectory, {
    ...buildEnvironment, NODE_ENV: 'production',
  });
  await group.waitForHttp(`${apiOrigin}/api/v1/health/ready`);
  await group.waitForHttp(`${baseUrl}/entrar`);
  await group.waitForHttp(`${baseUrl}/api/v1/health/ready`);

  if (args[0] === '--serve') {
    console.log('Isolated E2E servers are ready at http://127.0.0.1:3100. Stop this process after the review.');
    await new Promise((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (input) => {
        if (input.trim() === 'stop') {
          process.stdin.pause();
          resolve();
        }
      });
    });
  } else {
    await group.run('Playwright E2E', ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.config.ts'], webDirectory, {
      ...runtimeEnvironment,
      E2E_BASE_URL: baseUrl,
      FUTEIO_E2E_ISOLATED: '1',
    }, { showOutput: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The isolated E2E validation failed.');
  process.exitCode = 1;
} finally {
  await group.stop();
}
