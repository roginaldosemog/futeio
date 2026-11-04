import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const temporaryRoot = realpathSync(tmpdir());
const schemaTarget = join(repositoryRoot, 'api', 'openapi.json');
const typesTarget = join(repositoryRoot, 'packages', 'contracts', 'src', 'api-types.ts');
const typeHeader = '// Generated from api/openapi.json by pnpm contracts:generate. Do not edit.\n\n';
const runtimeKeys = new Set([
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP',
  'HOME', 'USERPROFILE', 'LOCALAPPDATA',
]);

class ContractError extends Error {}

function subprocessEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => runtimeKeys.has(name.toUpperCase())),
  );
}

function runTool(script, args, stage) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: subprocessEnvironment(),
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const status = Number.isInteger(result.status) ? ` (exit ${result.status})` : '';
    throw new ContractError(`${stage} failed${status}. Verify dependencies and build the API before generating contracts.`);
  }
}

function readText(path) {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
}

function assertOwnedTemporaryDirectory(directory) {
  const resolvedDirectory = resolve(directory);
  const child = relative(temporaryRoot, resolvedDirectory);
  if (
    !child || isAbsolute(child) || child.startsWith('..') ||
    dirname(resolvedDirectory) !== temporaryRoot ||
    !basename(resolvedDirectory).startsWith('futeio-contracts-')
  ) {
    throw new ContractError('Refusing to remove a directory outside the contract temporary workspace.');
  }
  return resolvedDirectory;
}

let temporaryDirectory;
try {
  const args = process.argv.slice(2);
  const mode = args[0] ?? '--write';
  if (args.length > 1 || !['--write', '--check'].includes(mode)) {
    throw new ContractError('Usage: node scripts/contracts.mjs [--write|--check]');
  }

  temporaryDirectory = mkdtempSync(join(temporaryRoot, 'futeio-contracts-'));
  const schemaOutput = join(temporaryDirectory, 'openapi.json');
  const typesOutput = join(temporaryDirectory, 'api-types.ts');

  runTool(
    join(repositoryRoot, 'api', 'scripts', 'generate-openapi.cjs'),
    [schemaOutput],
    'API schema generation',
  );

  const packagePath = require.resolve('openapi-typescript/package.json');
  const packageMetadata = JSON.parse(readFileSync(packagePath, 'utf8'));
  const cliEntry = packageMetadata.bin?.['openapi-typescript'];
  if (typeof cliEntry !== 'string') {
    throw new ContractError('The installed openapi-typescript package does not expose its CLI.');
  }
  runTool(
    resolve(dirname(packagePath), cliEntry),
    // An optional request property stays optional even when the server has a default.
    [schemaOutput, '--output', typesOutput, '--default-non-nullable', 'false'],
    'Shared API type generation',
  );
  writeFileSync(typesOutput, `${typeHeader}${readText(typesOutput)}`, 'utf8');

  const artifacts = [[schemaOutput, schemaTarget], [typesOutput, typesTarget]];
  if (mode === '--check') {
    const changed = artifacts.some(([generated, tracked]) => (
      !existsSync(tracked) || readText(generated) !== readText(tracked)
    ));
    if (changed) {
      throw new ContractError('Contract artifacts are missing or outdated. Run pnpm contracts:generate and review both generated files.');
    }
    console.log('The API schema and shared API types match their generated contracts.');
  } else {
    for (const [generated, tracked] of artifacts) {
      mkdirSync(dirname(tracked), { recursive: true });
      writeFileSync(tracked, readText(generated), 'utf8');
    }
    console.log('Generated api/openapi.json and packages/contracts/src/api-types.ts.');
  }
} catch (error) {
  console.error(error instanceof ContractError
    ? error.message
    : 'Contract generation failed. Verify dependencies and build the API before generating contracts.');
  process.exitCode = 1;
} finally {
  if (temporaryDirectory) {
    try {
      const ownedDirectory = assertOwnedTemporaryDirectory(temporaryDirectory);
      rmSync(ownedDirectory, { recursive: true, force: true });
    } catch {
      console.error('The contract temporary workspace could not be safely removed.');
      process.exitCode = 1;
    }
  }
}
