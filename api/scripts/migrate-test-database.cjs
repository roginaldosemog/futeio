const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { requireTestDatabaseUrl } = require('./test-database.cjs');

try {
  const databaseUrl = requireTestDatabaseUrl(process.env);
  const prismaCli = resolve(__dirname, '../node_modules/prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error('Could not start the local Prisma CLI for test migrations.');
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid test database configuration.');
  process.exitCode = 1;
}
