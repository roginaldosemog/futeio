# Futeio

Produto para ajudar uma pelada amadora a definir notas de habilidade e formar times equilibrados. O piloto atende um grupo fechado organizado pelo WhatsApp: o administrador seleciona 20 jogadores de linha e o sistema distribui quatro times de cinco. Os goleiros ficam fora do sorteio.

## Estado do projeto

Em 03/11/2026, E1 e E2 estão implementadas e verificadas localmente. A E2 permite acesso de um administrador provisionado com e-mail e senha; o envio por Resend foi adiado. Cadastro de jogadores, avaliações e sorteio continuam em entregas posteriores.

| Categoria | Estado |
| --- | --- |
| Escopo e decisões | Registrados nos documentos abaixo |
| Web e API | Login administrativo, sessão protegida e saída; sem cadastro de jogadores ou avaliações |
| Banco | Grupo piloto e evolução de identidade/sessão administrativa; sem dados reais de jogadores |
| Qualidade local de E1 | Lint, tipos, 26 testes unitários, 4 de integração, builds e smoke HTTP de produção passaram em E1 |
| Qualidade de E2 | Lint, tipos, 77 testes unitários, 19 de integração, 3 de navegador, builds, contratos e smoke passaram |
| CI | GitHub Actions configurado; execução remota aguarda envio ao GitHub |
| Publicação e uso real | Ainda não realizados |
| Métricas de uso e impacto | Ainda não coletadas |

## Documentação

- [Escopo aprovado e desenho do MVP](docs/pitroom/specs/2026-11-02-futeio-mvp-design.md).
- [Plano das primeiras entregas](docs/pitroom/plans/2026-11-02-primeiras-entregas.md).
- [Versões e compatibilidade verificadas](docs/compatibilidade.md).
- [E1: verificações, reprodução limpa e limitações](docs/entregas/E1-fundacao.md).
- [E2: acesso administrativo e verificações](docs/entregas/E2-acesso-administrativo.md).
- [ADR 0001 — Monorepo e monolito modular](docs/adr/0001-monorepo-e-monolito-modular.md).
- [ADR 0002 — Identidade, acesso administrativo e links de jogadores](docs/adr/0002-identidade-e-acesso-por-links.md).
- [ADR 0003 — Avaliações e nota consolidada](docs/adr/0003-avaliacoes-e-nota-consolidada.md).
- [ADR 0004 — Sorteio explicável e reproduzível](docs/adr/0004-sorteio-explicavel-e-reproduzivel.md).
- [ADR 0005 — Contratos e fronteiras dos clientes](docs/adr/0005-contratos-e-fronteiras-dos-clientes.md).

## Direção técnica aprovada

- Web responsiva primeiro: Next.js com App Router, TypeScript e Tailwind CSS.
- API REST: NestJS como monolito modular, com OpenAPI/Swagger.
- Persistência: PostgreSQL, Prisma e migrations.
- Dados remotos: TanStack Query nas interações que se beneficiem dele.
- Repositório único: pnpm workspaces e Turborepo.
- Mobile depois do piloto web: React Native, Expo e Expo Router, consumindo a mesma API.
- Testes por camada, ambiente local com Docker Compose e CI/CD com GitHub Actions.

As versões diretas estão fixadas e o lockfile é versionado. A matriz de compatibilidade registra as fontes oficiais e os ajustes necessários entre runtime, frameworks e ferramentas.

## Organização futura

`web/` e `api/` já existem. `mobile/` será criado na etapa mobile. Pacotes compartilhados entrarão em `packages/` somente quando houver consumidores e responsabilidade concreta.

## Executar e testar

Pré-requisitos: Node **24.22.1** (também indicado em `.node-version`), pnpm **11.25.0** e PostgreSQL **18.6**. O caminho recomendado para os bancos locais usa Docker Engine com Docker Compose. As aplicações são executadas no host.

Na raiz, prepare o ambiente (PowerShell; em outros shells, faça a cópia equivalente):

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install --frozen-lockfile
pnpm services:up
pnpm db:generate
pnpm db:migrate
pnpm db:test:migrate
pnpm admin:configure
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000).
- API: [liveness](http://127.0.0.1:3001/api/v1/health/live) e [readiness](http://127.0.0.1:3001/api/v1/health/ready).
- Encaminhamento pela web: [readiness sob a mesma origem](http://localhost:3000/api/v1/health/ready).
- Acesso administrativo: [entrar](http://localhost:3000/entrar).
- Contrato da API: [OpenAPI JSON](http://127.0.0.1:3001/api/v1/openapi.json) e [Swagger](http://127.0.0.1:3001/api/v1/docs).

`live` retorna 200 se o processo estiver disponível. `ready` consulta o PostgreSQL e retorna 200 ou 503 com mensagem sanitizada. As respostas recebem `x-request-id`.

O Compose mantém desenvolvimento e testes em serviços separados, portas 5432 e 5433. Desenvolvimento tem volume persistente; testes usam armazenamento temporário. As credenciais de `.env.example` servem somente ao desenvolvimento local. `pnpm services:down` encerra os serviços sem excluir o volume de desenvolvimento.

Também é possível usar instalações PostgreSQL próprias: crie bancos distintos, configure `DATABASE_URL` e `TEST_DATABASE_URL` em `.env` e aplique os comandos de migrations acima. O banco de teste precisa ter nome terminado em `_test` e não pode ser o mesmo da aplicação; os scripts rejeitam URLs equivalentes mesmo com queries diferentes. Nenhum script de testes executa drop/truncate.

Para verificar a fundação:

```powershell
pnpm verify
pnpm test:smoke
pnpm peers check
pnpm audit --prod
```

`verify` executa lint, tipos, testes unitários, integração com banco real e builds. `test:smoke` inicia as versões compiladas de web/API, verifica HTTP e encaminhamento e encerra seus processos; as portas 3000 e 3001 precisam estar livres. Não é uma suíte de jornadas de cadastro/avaliação.

Os testes de navegador usam o Google Chrome estável instalado no sistema, com `chromiumSandbox: true`. Mantenha o Chrome atualizado. Prepare o banco de teste e execute:

```sh
pnpm db:test:migrate
pnpm test:e2e
```

Se o Chrome estiver ausente, instale pelo mecanismo oficial: `pnpm --filter @futeio/web exec playwright install --no-remove chrome`. No CI Linux, o workflow usa `install --with-deps --no-remove chrome` para instalar o canal estável e as dependências do sistema. O navegador roda como o usuário do runner, com sandbox; falhas de instalação ou sandbox interrompem os testes, sem fallback para o Chromium empacotado. A instalação do Chrome é global; `--no-remove` preserva os caches de outros navegadores.

Referências oficiais: [canais Chrome e instalação](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge) e [opção chromiumSandbox](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-chromium-sandbox).

A fixture E2E consulta o executável e a linha de comando reais em `chrome://version` antes das jornadas, rejeita executáveis fora da instalação Chrome e flags que desativam a sandbox, incluindo `--no-sandbox`. O log `[browser-policy]` registra executável, versão e resultado dessa verificação. Os testes devem importar `test` de `web/e2e/fixtures.ts` para manter a verificação.

O orquestrador compila API e web, usa credenciais sintéticas e `TEST_DATABASE_URL`, inicia servidores isolados em 3101/3100 e os encerra após os testes. Não utiliza sua conta administrativa local. Ele recompila a web com encaminhamento para 3101: execute `pnpm build` novamente antes de iniciar a web de produção local em 3000 com a API em 3001. Não rode builds simultâneos da mesma pasta web.

Para executar as versões compiladas manualmente, após `pnpm build`, use terminais separados:

```powershell
pnpm --filter @futeio/api start
pnpm --filter @futeio/web start
```

`API_ORIGIN` é configuração de servidor do Next e participa do hash do build. Alterá-la exige novo build para produção. A web carrega `.env` da raiz por API nativa do Node, sem passar a opção de arquivo de ambiente aos workers de build.

## Administrador local — E2

`pnpm admin:configure` compila a API e executa o helper `api/scripts/configure-admin.cjs`, que solicita e-mail e senha com entrada oculta. Execute-o depois da geração Prisma. O helper exige `.env` ignorado pelo Git, grava o hash com aspas no ambiente local e não imprime senha ou hash. Identidade e vínculo administrativo só são criados ou reutilizados no banco após login válido; não há cadastro público.

| Variável | Uso |
| --- | --- |
| `ADMIN_EMAIL` | Único e-mail administrativo autorizado; não define e-mail para jogadores |
| `ADMIN_PASSWORD_HASH` | Hash scrypt provisionado; nunca a senha em texto puro |
| `APP_ORIGIN` | Origem exata da web, com HTTPS ou HTTP apenas em loopback; sem caminho, query, fragmento ou credenciais |
| `AUTH_SECRET` | Segredo aleatório de 32 bytes codificado em base64url, gerado pelo helper se ausente |

Para automação controlada, após compilar a API, `node api/scripts/configure-admin.cjs --stdin` recebe JSON com as chaves `email` e `password` pela entrada padrão. Não passe credenciais como argumentos nem as escreva em exemplos de comandos ou arquivos versionados. A forma interativa evita colocar a senha no histórico do shell. O helper aceita senha de 10 a 256 caracteres.

Depois de alterar e-mail ou senha, reinicie a API. A versão da credencial é conferida nas sessões administrativas e invalida as antigas após a reinicialização. Recuperação em E2 é novo provisionamento local autorizado, sem fluxo público de recuperação de senha.

O navegador usa `futeio_session`, `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS, com sessão administrativa de oito horas e revogação no servidor. Login e logout exigem a origem exata e token CSRF obtido em `GET /api/v1/auth/csrf`; renove o token após a rotação de sessão no login. O banco armazena hashes dos tokens.

Há limites por janela de 15 minutos: dez logins por peer de rede, cinco por e-mail e 60 solicitações CSRF por peer. Sem confiança em `X-Forwarded-For`, clientes encaminhados pelo Next compartilham o orçamento do proxy nesta etapa. O envio Resend e o login administrativo por link estão adiados: o adaptador não está registrado e não há rotas de solicitação/resgate de link administrativo.

Após compilar a API, `pnpm contracts:generate` atualiza o contrato OpenAPI e os tipos de cliente; `pnpm contracts:check` verifica divergência sem depender de credenciais locais. As quatro variáveis administrativas também são repassadas pelo Turbo quando fornecidas pelo ambiente do processo. Os resultados estão no relatório E2.

Os jogadores continuam com acesso por link pessoal sem e-mail ou senha nas entregas E3/E4. E2 não implementa nem autoriza essas entregas.

## CI e limites da verificação

O [workflow](.github/workflows/ci.yml) executa em push, pull request e acionamento manual: instalação pelo lockfile, geração Prisma, migrations em bancos isolados, lint, tipos, testes, builds e smoke HTTP. Ações estão fixadas por SHA, com permissão de leitura e sem deploy automático.

Neste computador, os testes usaram PostgreSQL 18.6 portátil, obtido do distribuidor indicado pelo site oficial e com SHA-256 conferido. O Compose passou em `config --quiet`; contêineres não foram executados porque Docker Engine não está instalado. Não há execução remota da CI nem publicação do produto registrada nesta etapa.

## Evidências para o portfólio

A E1 já registra decisões e resultados reais das verificações locais. Resultados da CI no GitHub, exemplos do sorteio, publicação e feedback da pelada serão acrescentados nas próximas etapas. Tempos, adesão e percepção de equilíbrio só serão apresentados como resultados depois de coletados.
