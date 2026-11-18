# fute.io — website com Firebase

Branch `codex/website-firebase`: website da pelada piloto, com servidor no próprio Next.js. Publicação na Vercel Hobby, Firebase Spark para Auth/Firestore e Vercel Blob privado para fotos. A disponibilidade da publicação e os testes executados ficam registrados nas entregas; configuração preparada não significa publicação concluída.

Piloto publicado: **[fute-io.vercel.app](https://fute-io.vercel.app)**. Login do administrador: [entrar](https://fute-io.vercel.app/entrar). A publicação e suas verificações estão na [entrega F2](docs/entregas/F2-google-spark-vercel.md).

NestJS, PostgreSQL/Prisma e Expo permanecem nas branches anteriores. Dados e sessões antigos **não são migrados**. As decisões anteriores estão em `docs/history/`; não use os comandos históricos nesta branch.

## Rodar sem conta Firebase

Requisitos: Node 24.22.1 (linha 24), pnpm 11.25.0, Java 21 no PATH e Chrome estável para E2E.

1. `pnpm install --frozen-lockfile`.
2. Copie `.env.example` para `.env.firebase` (ignorado). O `.env` antigo não é carregado nesta versão.
3. Terminal 1: `pnpm firebase:emulators`.
4. Terminal 2: `pnpm firebase:seed` e depois `pnpm dev`.
5. Abra [localhost:3000](http://localhost:3000). O login sintético está em `web/test/admin-fixture.mjs`, exclusivo dos emuladores. Cadastre jogadores pela interface. Painel dos emuladores: [localhost:4000](http://127.0.0.1:4000).

Os emuladores descartam dados ao parar. Para persistir dados sintéticos, use as opções oficiais `--export-on-exit=.emulator-data` e, após o primeiro export, `--import=.emulator-data`. Essa pasta é ignorada. Não exponha as portas dos emuladores na internet nem use credenciais de teste em produção.

## Verificar

Execute `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm contracts:check`, `pnpm test:integration` e `pnpm test:e2e`. O atalho `pnpm verify` executa essa sequência. Instale antes o Chrome com `pnpm --filter @futeio/web exec playwright install --with-deps --no-remove chrome`.

Integração e E2E iniciam emuladores próprios `demo-futeio-test` e recusam portas ocupadas. Não carregam credenciais reais nem reutilizam a aplicação local. E2E usa build separado `web/.next-validation`, servidor 3100 e Chrome instalado com sandbox ativa, conferindo o executável e os argumentos.

## Estrutura

- `web/src/app`: interface e rotas REST Node em `api/v1`.
- `web/src/server`: autorização, validação e operações Firebase; regras puras em `domain`.
- `web/contracts/openapi.json`: contrato REST; `pnpm contracts:generate` gera os tipos locais.
- `firebase/`: Rules privadas, índices e emuladores locais.
- `scripts/`: testes isolados, seed sintético e contratos.

O navegador não acessa diretamente Firestore nem Blob. As regras de avaliação, privacidade e sorteio continuam no servidor. O Storage do Firebase é usado apenas pelo ambiente local de testes. pnpm conserva somente o workspace web; Turborepo executa o build.

O administrador pode entrar com Google ou e-mail/senha, sempre limitado ao UID/e-mail configurados. O Firebase Web SDK é usado apenas para autenticar com Google em memória e trocar o token pela sessão HttpOnly; os jogadores continuam pelos links. Veja [a decisão do login Google](docs/adr/0009-login-google-do-administrador.md).

## Publicar

Siga [a configuração Vercel + Firebase Spark](docs/firebase.md). Ela cobre credenciais de servidor, Blob privado, Google/e-mail, Rules e limpeza diária. O piloto utiliza as cotas gratuitas; limites podem suspender recursos. Não exige ativar Blaze.

Veja [a decisão de hospedagem](docs/adr/0010-vercel-spark-blob-privado.md), [a migração Firebase](docs/adr/0008-website-firebase.md), [compatibilidade](docs/compatibilidade.md) e [evidências da entrega inicial](docs/entregas/F1-website-firebase.md).

Login Google, preparação Spark/Vercel e verificações: [entrega F2](docs/entregas/F2-google-spark-vercel.md).
