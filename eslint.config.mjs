import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/generated/**', '**/coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['scripts/**/*.mjs', 'api/scripts/**/*.cjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', URL: 'readonly', AbortSignal: 'readonly', module: 'readonly', require: 'readonly', __dirname: 'readonly' } }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['api/**/*.ts'], languageOptions: { globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly' } } },
  { files: ['api/**/*.spec.ts', 'api/test/**/*.ts'], languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', jest: 'readonly' } } }
);
