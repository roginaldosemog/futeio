const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

// Preserve only runtime necessities; the contract must not depend on local credentials.
const runtimeKeys = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP',
  'HOME', 'USERPROFILE', 'LOCALAPPDATA',
]);
for (const name of Object.keys(process.env)) {
  if (!runtimeKeys.has(name.toUpperCase())) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://futeio_contract:futeio_contract@127.0.0.1:1/futeio_contract',
  API_HOST: '127.0.0.1',
  API_PORT: '3001',
});

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

async function generate() {
  if (process.argv.length > 3) throw new Error('Invalid contract generator arguments.');

  const { createAdminFixture } = await import('../test/support/admin-fixture.mjs');
  Object.assign(process.env, createAdminFixture());

  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module.js');
  const { configureApplication } = require('../dist/app.setup.js');
  const { createOpenApiDocument } = require('../dist/openapi.js');
  const outputPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(__dirname, '../openapi.json');

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    configureApplication(app);
    await app.init();
    const document = createOpenApiDocument(app);
    const serialized = `${JSON.stringify(sortKeys(document), null, 2)}\n`;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized, 'utf8');
  } finally {
    await app.close();
  }
}

generate().catch(() => {
  console.error('OpenAPI generation failed. Build the API and verify its fixture-only bootstrap.');
  process.exitCode = 1;
});
