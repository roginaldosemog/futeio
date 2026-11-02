# Futeio

Produto para ajudar uma pelada amadora a definir notas de habilidade e formar times equilibrados. O piloto atende um grupo fechado organizado pelo WhatsApp: o administrador seleciona 20 jogadores de linha e o sistema distribui quatro times de cinco. Os goleiros ficam fora do sorteio.

## Estado do projeto

Em 02/11/2026, o escopo e a arquitetura inicial foram aprovados para documentação e planejamento. **A implementação ainda não foi autorizada nem iniciada.**

| Categoria | Estado |
| --- | --- |
| Escopo e decisões | Registrados nos documentos abaixo |
| Aplicações, banco e infraestrutura | Não implementados |
| Testes e CI/CD | Planejados; não executados |
| Publicação e uso real | Ainda não realizados |
| Métricas de qualidade e impacto | Sem resultados coletados |

## Documentação

- [Escopo aprovado e desenho do MVP](docs/pitroom/specs/2026-11-02-futeio-mvp-design.md).
- [Plano das primeiras entregas](docs/pitroom/plans/2026-11-02-primeiras-entregas.md).
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

As versões serão verificadas nas documentações oficiais no momento da configuração. Nenhuma combinação de versões foi homologada para instalação nesta etapa.

## Organização futura

As aplicações ocuparão `web/`, `api/` e, na etapa mobile, `mobile/`. Pacotes compartilhados entrarão em `packages/` somente quando houver consumidores e responsabilidade concreta. Essas pastas de aplicações e pacotes **não foram criadas** nesta etapa.

## Executar e testar

Ainda não há aplicação, dependências ou comandos de execução disponíveis. A primeira entrega deverá acrescentar os comandos exatos de preparação, migrations, execução local e testes, depois de verificá-los em um ambiente limpo. Os comandos escritos no plano são contratos futuros, não comandos já existentes neste repositório.

## Evidências para o portfólio

As evidências serão construídas durante a execução: decisões com justificativas, resultados reais dos testes e da CI, exemplos reproduzíveis do sorteio, registros de publicação e feedback da pelada. Tempos, adesão e percepção de equilíbrio só serão apresentados como resultados depois de coletados.
