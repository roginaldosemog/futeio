# ADR 0001 — Monorepo e monolito modular

Data: 02/11/2026.

Estado: decisão aceita; fundação implementada em E1 com web/API no monorepo, PostgreSQL/Prisma e módulo de saúde. Os módulos de negócio e o mobile permanecem planejados.

## Contexto

O produto precisa de web e mobile, mas começará com um único grupo real e web responsiva. O objetivo é evoluir arquitetura, testes e operação por necessidades verificáveis, mantendo um único repositório.

## Decisão

Manter `web/`, `api/` e, posteriormente, `mobile/` na raiz. Usar pnpm workspaces e Turborepo para dependências e tarefas. Acrescentar pacotes compartilhados somente com responsabilidade e consumidores concretos.

O backend será uma aplicação NestJS organizada em acesso, jogadores, avaliações e sorteios. PostgreSQL será o banco; Prisma e migrations ficam sob responsabilidade da API. Web e API podem ter processos e deploys distintos, sem dividir o backend em microsserviços.

Registrar o grupo no modelo e nas verificações de acesso, mas disponibilizar apenas o grupo piloto. Não implementar criação pública de grupos ou plataforma de multitenancy.

## Alternativas consideradas

- Repositórios separados: acrescentariam coordenação de contratos e ferramentas sem necessidade atual.
- Backend dentro do Next.js: possível para um produto web, mas o Nest foi escolhido para concentrar regras e servir também ao mobile planejado.
- Microsserviços e mensageria: aumentariam operação e consistência distribuída sem um problema concreto que justificasse esse custo.

## Consequências e revisão

O monorepo exige disciplina para impedir importações de banco/backend pelos clientes. A CI deve verificar os pacotes afetados e os contratos compartilhados. Independência de deploy não implica independência de regras de negócio.

Revisar fronteiras se surgirem responsabilidades com escala, equipes ou ciclos de vida realmente independentes. Redis, filas e serviços adicionais exigem uma decisão baseada em necessidade observada.
