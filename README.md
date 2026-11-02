# Futeio

Produto para ajudar uma pelada amadora a definir notas de habilidade e formar times equilibrados. O piloto atende um grupo fechado organizado pelo WhatsApp: o administrador seleciona 20 jogadores de linha e o sistema distribui quatro times de cinco. Os goleiros ficam fora do sorteio.

## Estado do projeto

Em 02/11/2026, a E1 foi autorizada e implementada: monorepo, web, API, PostgreSQL, migrations e configuração de CI. A fundação passou nas verificações locais. O MVP funcional e as entregas seguintes continuam planejados.

| Categoria | Estado |
| --- | --- |
| Escopo e decisões | Registrados nos documentos abaixo |
| Web e API | Fundação executável; sem cadastro, login ou avaliações |
| Banco | Prisma, migration e grupo piloto, sem dados reais de jogadores |
| Qualidade local | Lint, tipos, 26 testes unitários, 4 de integração, builds e smoke HTTP de produção passaram |
| CI | GitHub Actions configurado; execução remota aguarda envio ao GitHub |
| Publicação e uso real | Ainda não realizados |
| Métricas de uso e impacto | Ainda não coletadas |

## Documentação

- [Escopo aprovado e desenho do MVP](docs/pitroom/specs/2026-11-02-futeio-mvp-design.md).
- [Plano das primeiras entregas](docs/pitroom/plans/2026-11-02-primeiras-entregas.md).
- [Versões e compatibilidade verificadas](docs/compatibilidade.md).
- [E1: verificações, reprodução limpa e limitações](docs/entregas/E1-fundacao.md).
- [ADR 0001 — Monorepo e monolito modular](docs/adr/0001-monorepo-e-monolito-modular.md).
- [ADR 0002 — Identidade e acesso por links](docs/adr/0002-identidade-e-acesso-por-links.md).
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
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000).
- API: [liveness](http://127.0.0.1:3001/api/v1/health/live) e [readiness](http://127.0.0.1:3001/api/v1/health/ready).
- Encaminhamento pela web: [readiness sob a mesma origem](http://localhost:3000/api/v1/health/ready).

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

`verify` executa lint, tipos, testes unitários, integração com banco real e builds. `test:smoke` inicia as versões compiladas de web/API, verifica HTTP e encaminhamento e encerra seus processos; as portas 3000 e 3001 precisam estar livres. Não é uma suíte de jornadas de cadastro/avaliação. O comando `test:e2e` será acrescentado com essas jornadas.

Para executar as versões compiladas manualmente, após `pnpm build`, use terminais separados:

```powershell
pnpm --filter @futeio/api start
pnpm --filter @futeio/web start
```

`API_ORIGIN` é configuração de servidor do Next e participa do hash do build. Alterá-la exige novo build para produção. A web carrega `.env` da raiz por API nativa do Node, sem passar a opção de arquivo de ambiente aos workers de build.

## CI e limites da verificação

O [workflow](.github/workflows/ci.yml) executa em push, pull request e acionamento manual: instalação pelo lockfile, geração Prisma, migrations em bancos isolados, lint, tipos, testes, builds e smoke HTTP. Ações estão fixadas por SHA, com permissão de leitura e sem deploy automático.

Neste computador, os testes usaram PostgreSQL 18.6 portátil, obtido do distribuidor indicado pelo site oficial e com SHA-256 conferido. O Compose passou em `config --quiet`; contêineres não foram executados porque Docker Engine não está instalado. Não há execução remota da CI nem publicação do produto registrada nesta etapa.

## Evidências para o portfólio

A E1 já registra decisões e resultados reais das verificações locais. Resultados da CI no GitHub, exemplos do sorteio, publicação e feedback da pelada serão acrescentados nas próximas etapas. Tempos, adesão e percepção de equilíbrio só serão apresentados como resultados depois de coletados.
