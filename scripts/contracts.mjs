import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
const source = new URL('../web/contracts/openapi.json', import.meta.url);
const target = new URL('../web/src/generated/api-types.ts', import.meta.url);
const generated = astToString(await openapiTS(JSON.parse(await readFile(source, 'utf8')), { defaultNonNullable: false }));
if (process.argv.includes('--write')) await writeFile(target, generated);
else if ((await readFile(target, 'utf8')) !== generated) throw new Error('Run pnpm contracts:generate and commit updated types.');
else console.log('Website contracts are current.');
