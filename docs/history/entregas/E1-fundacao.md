# E1 — Fundação do monorepo

Data: 02/11/2026. Código verificado: commit `9038860`, branch `feat/e1-foundation`.

Estado: implementada, revisada e verificada localmente. Workflow de CI preparado; execução no GitHub pendente de envio dos commits. Produto não publicado e ainda não usado pelo grupo.

## O que foi entregue

- Um repositório com pnpm workspaces/Turborepo, dependências diretas fixadas e lockfile.
- Web Next.js App Router com Tailwind, página informativa responsiva em português e encaminhamento `/api/v1/*` pelo servidor.
- API NestJS, configuração validada, logs estruturados, identificação de requisições e erros sanitizados.
- `GET /api/v1/health/live` com 200 para processo disponível; `GET /api/v1/health/ready` com consulta real ao PostgreSQL, 200 ou 503.
- Prisma 7, migration inicial e um grupo piloto. Nenhum jogador, conta ou credencial de produto fictícia foi inserido.
- Serviços Compose separados de desenvolvimento/teste; migrations de teste recusam o banco da aplicação e bancos sem sufixo `_test`.
- GitHub Actions com ações fixadas por SHA: dependências pelo lockfile, geração, migrations, lint, tipos, testes, builds e smoke.
- README com preparação, execução, verificação e limites conhecidos.

Cadastro, login, perfis editáveis, avaliações, sorteio e mobile permanecem fora desta entrega. Não há suíte vazia de Playwright, Storybook, cache de produto, fila ou infraestrutura de publicação.

## Evidências executadas pelo responsável pela integração

| Verificação | Resultado observado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; lockfile aceito pela política de dependências |
| `pnpm peers check` | Exit 0; nenhuma incompatibilidade de peer dependency |
| `pnpm db:generate` | Exit 0; cliente Prisma 7.10.1 gerado |
| `pnpm db:migrate` | Exit 0; migration inicial aplicada ao banco de desenvolvimento |
| `pnpm db:test:migrate` | Exit 0; mesma migration aplicada ao banco de teste separado |
| Consulta aos dois bancos | Exatamente o grupo `pelada-piloto` em cada banco |
| `pnpm lint` e `pnpm typecheck` via `pnpm verify` | Exit 0 para scripts, API e web |
| `pnpm test:unit` via `pnpm verify` | 5 testes nativos Node de configuração/portas e 21 testes Jest da API: 26 passando |
| `pnpm test:integration` via `pnpm verify` | 4 testes passando com PostgreSQL real, sem mock de banco |
| `pnpm build` via `pnpm verify` | Exit 0; API compilada e web gerada para produção |
| `pnpm test:smoke` | Exit 0; binários compilados de web/API, banco real e encaminhamento sob a origem da web |
| `pnpm audit --prod` | Exit 0; nenhuma vulnerabilidade conhecida retornada na consulta |
| Docker Compose 5.7.0 `config --quiet` | Exit 0; configuração válida |
| Revisão independente | SPEC PASS e QUALITY APPROVED após correção do parsing da origem |
| `git diff --check` | Sem erros de whitespace |

O modo watch da API também foi exercitado com Nest CLI: compilação sem erros e endpoints live/ready retornando 200. Seu processo temporário foi encerrado. Não foi realizada uma auditoria visual completa nem um teste com usuários; o escopo de interface da E1 é uma página estática informativa.

Ao encerrar a verificação, os processos temporários de web, API e dos dois clusters PostgreSQL foram encerrados. Nenhum serviço Windows foi instalado; os binários e dados de validação permanecem em cache local fora do repositório.

### Reprodução em uma cópia limpa

Foi criado um clone local independente do commit `9038860`, fora da pasta de desenvolvimento, sem `node_modules`, cliente Prisma gerado, build ou cache Turbo. Somente `.env.example` foi copiado para `.env`.

Na cópia limpa, os comandos abaixo terminaram com exit code 0:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:test:migrate
pnpm verify
pnpm test:smoke
```

Os bancos PostgreSQL já haviam sido provisionados e migrados no primeiro ensaio. Na cópia limpa, migrations confirmaram ausência de pendências; testes e builds rodaram novamente sem cache Turbo. Portanto, foram comprovadas separadamente a aplicação da migration em bancos novos e a preparação da aplicação a partir dos arquivos versionados. Não houve instalação de Docker Engine ou teste de subida de contêineres.

### Evidência de testes antes da implementação das correções

- Liveness: expectativa 200 recebeu 404 com o módulo sem a rota; após implementação, os quatro cenários HTTP passaram.
- Isolamento: URL de teste semanticamente igual à da aplicação não era recusada; após normalização de host/porta/nome, os testes do guard passaram.
- Smoke: porta já ocupada não era rejeitada; o teste acusou ausência de rejeição e passou após o preflight de portas.
- Origem da API: uma origem malformada preservava a entrada no erro do parser; o teste acusou a mensagem original e passou após erro genérico sem `input`/`cause`.

Erros de instalação/importação do runner não foram contabilizados como falhas de comportamento para demonstrar TDD.

## Ambiente e limites

Windows x64, Node 24.22.1, pnpm 11.25.0 e PostgreSQL 18.6. Dois clusters locais atenderam às portas 5432 e 5433, somente em loopback, com autenticação SCRAM e bancos separados. Foram processos portáteis de validação, não serviços Windows instalados.

O ZIP foi obtido da EDB, distribuidor indicado pelo [site oficial do PostgreSQL](https://www.postgresql.org/download/windows/). SHA-256 verificado contra o arquivo oficial adjacente:

```text
e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2
```

A CLI Compose também foi obtida da release oficial e teve seu SHA-256 conferido. A imagem prevista é `postgres:18.6-bookworm`; sua execução neste computador não foi comprovada, pois não há Docker Engine. Não há conclusão sobre execução Linux/contêiner ou CI remota até o workflow efetivamente rodar no GitHub.

O Jest habilita VM Modules para carregar Nest 12 ESM; o runner emite o aviso experimental correspondente. A API compilada executou sem essa opção. As decisões de versão e a razão do plugin direto de lint estão na [matriz de compatibilidade](../compatibilidade.md).

## Decisões durante a execução

| Decisão | Motivo e limite |
| --- | --- |
| Prisma 7.10.1 e TypeScript 5.9.3 | Evitar CLI Prisma 8 RC e respeitar a interseção dos peers; novas versões exigem nova homologação |
| ESLint 10 com plugins Next/Hooks diretos | Evitar ESLint 9 fora de suporte sem forçar peers de plugins antigos; não equivale a uma auditoria de acessibilidade |
| CommonJS na API e cliente Prisma; configuração ESM da web | Manter a geração Prisma explícita e compatível com Node 24; testes exigem configuração ESM própria no Jest |
| Leitura nativa do `.env` na configuração Next | Impedir que opção de CLI seja propagada para workers que a rejeitam |
| Origem da API no hash do Turbo e parsing sanitizado | Evitar build em cache para outro backend e exposição de uma configuração malformada |
| PostgreSQL portátil para comprovação local | Testar com banco real sem instalar componentes de sistema; execução Compose/GitHub permanece uma verificação distinta |
| Execução com colaboração nativa e revisão independente | Pitroom indisponível; não foi instalada uma ferramenta de orquestração adicional |

O trabalho foi mantido em branch própria na pasta original. Os commits usam exclusivamente a identidade Git de Igor Gomes, sem trailers de coautoria. O remoto indicado foi configurado, mas nenhum push, merge, PR ou deploy foi realizado nesta entrega local.

## Continuidade

Atualização de continuidade em 03/11/2026: o usuário autorizou E2 e adiou envio Resend/link administrativo, substituindo-os por provisionamento manual do único administrador com e-mail e senha. A escolha de serviço de e-mail deixa de ser pré-condição de E2; ver a revisão do [ADR 0002](../adr/0002-identidade-e-acesso-por-links.md) e o [relatório E2](E2-acesso-administrativo.md), ainda com fechamento pendente. O histórico e as verificações acima continuam sendo evidências exclusivamente de E1. Antes de declarar CI verde, enviar os commits e inspecionar o resultado real do workflow. Antes do piloto, cumprir os critérios de publicação/operação de E8.

Não há métricas de desempenho ou impacto do produto neste relatório. Contagens de testes e resultados de comandos são evidências de verificação da fundação.
