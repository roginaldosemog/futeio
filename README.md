# fute.io — website com Firebase

Branch `codex/website-firebase`: somente o website da pelada piloto, com as telas do MVP e servidor no próprio Next.js. Preparado para Firebase Auth (administrador), Firestore (dados/sessões) e Storage (fotos privadas). Nenhum projeto real é criado, conectado ou publicado automaticamente.

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
- `firebase/`: Rules privadas e índices/TTL.
- `scripts/`: testes isolados, seed sintético e contratos.

O navegador não acessa diretamente Firestore ou Storage. As regras de avaliação, privacidade e sorteio continuam no servidor. pnpm conserva somente o workspace web; Turborepo fica restrito ao build para a integração de monorepos documentada pelo App Hosting.

## Conectar depois

Siga [a configuração Firebase](docs/firebase.md). Ela cobre administrador/UID, variáveis, Rules, IAM, TTL, App Hosting e custos. App Hosting e Storage exigem Blaze; vinte usuários não garantem custo zero. Nenhum serviço pago foi ativado nesta entrega.

Veja [a decisão vigente](docs/adr/0008-website-firebase.md), [compatibilidade](docs/compatibilidade.md) e [evidências da entrega](docs/entregas/F1-website-firebase.md).
