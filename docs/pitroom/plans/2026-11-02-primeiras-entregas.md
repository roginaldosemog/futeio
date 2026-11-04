# Primeiras entregas do Futeio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use pitroom-driven-development to implement this plan task-by-task (each task runs as `pitroom run -i --plan <this file> --step N`). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Limite de autorização atualizado:** E1–E3 foram entregues. O pedido para concluir o site autoriza E4–E7 e a preparação operacional de E8, detalhadas no plano `2026-11-03-completar-mvp-web.md`. Resend e mobile seguem adiados; contratar serviços e publicar depende de hospedagem/domínio/orçamento definidos.

**Goal:** Entregar, em uma execução futura autorizada, a base verificável do produto, o acesso administrativo, o cadastro com nota inicial e o acesso restrito dos jogadores por link.

**Architecture:** Uma web Next.js consome uma API NestJS modular, com PostgreSQL/Prisma. Identidades, perfis e credenciais são separados; regras e permissões pertencem ao backend. O piloto tem um grupo e web responsiva.

**Tech Stack:** TypeScript, Next.js App Router, Tailwind CSS, NestJS, OpenAPI, PostgreSQL, Prisma, pnpm workspaces, Turborepo, Docker Compose e GitHub Actions; Jest, React Testing Library, Supertest e Playwright nas respectivas camadas. Versões serão verificadas antes da configuração, sem instalação nesta etapa de planejamento.

**Spec:** [Escopo e arquitetura aprovados](../specs/2026-11-02-futeio-mvp-design.md), em conjunto com os [ADRs](../../adr/0001-monorepo-e-monolito-modular.md).

## Global Constraints

- Autorização atual abrange a conclusão funcional do MVP web; ver o plano complementar de E4–E7. Mobile e envio de e-mail permanecem adiados.
- "O MVP atende um único grupo fechado."
- "O aplicativo mobile virá depois da validação da web responsiva."
- "E-mail do jogador não é solicitado no MVP."
- "Cada cadastro gera um link pessoal de acesso, para o administrador compartilhar manualmente."
- "Autoavaliação é permitida e tem o mesmo peso." — ADR 0003.
- "Clientes não importam Prisma nem módulos internos do Nest."
- "As regras puras de cálculo e sorteio permanecem no backend."
- Configuração de versões exige consulta oficial na data da execução, registro da matriz e lockfile. Não interpretar versões de tutoriais como compatibilidade verificada.
- Cada tarefa só é concluída com suas verificações executadas e saída inspecionada. Não marcar testes planejados como passando.
- Não há Redis, filas, microsserviços, IA ou componentes compartilhados web/mobile nesta execução inicial.
- Caminhos e contratos de E1 foram materializados; os das entregas seguintes continuam futuros. O README registra os comandos já existentes e verificados.

## Recorte e dependências

Este plano detalha E1–E4. Perfil com foto, avaliações completas e sorteio têm critérios no escopo e receberão planos próprios antes de sua implementação. Isso evita preparar agora código e infraestrutura de subsistemas que ainda não serão entregues.

Ordem: E1 → E2 → E3 → E4. Não executar tarefas em paralelo sem resolver as interfaces consumidas. O primeiro resultado utilizável pelo administrador é E3; o primeiro acesso real de jogador é E4. Nenhum desses marcos equivale ao MVP completo.

O plano especifica contratos e casos de aceitação. Não contém implementação pronta para transcrição; os testes e o código serão escritos somente na execução autorizada, com as versões já verificadas.

## Mapa previsto de arquivos

| Caminho | Responsabilidade |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json` | Pacotes, versões resolvidas e tarefas do monorepo |
| `.gitignore`, `.env.example`, `compose.yaml`, `.github/workflows/ci.yml` | Segredos fora do Git, ambiente documentado, PostgreSQL local e verificações |
| `docs/compatibilidade.md` | Matriz de versões, fontes oficiais, data e evidência de instalação limpa |
| `web/src/app/` | Rotas, layout, páginas de entrada e adaptação da API sob a mesma origem |
| `web/src/features/access/` | Solicitação de login, resgate, sessão, saída e mensagens de acesso |
| `web/src/features/players/` | Cadastro e listagem administrativa, exibição do perfil mínimo |
| `api/src/modules/health/` | Disponibilidade do processo e prontidão do banco |
| `api/src/modules/access/` | Identidade, sessão, e-mail, credenciais, guards e política de acesso |
| `api/src/modules/players/` | Cadastro e consulta de perfis, caso de uso transacional |
| `api/src/modules/evaluations/` | Persistência da contribuição inicial; cálculo completo é entrega E6 |
| `api/prisma/schema.prisma`, `api/prisma/migrations/` | Modelo e evolução versionada do banco |
| `api/test/` | Integração com PostgreSQL isolado e cenários de autorização |
| `web/e2e/` | Jornadas reais de navegador; dados fictícios e ambiente isolado |

Nomes e caminhos podem ser ajustados antes da implementação se o scaffold da versão escolhida exigir. Mudanças precisam atualizar contratos e referências neste plano; não criar duas convenções concorrentes.

## Convenções de interfaces

- Prefixo externo de API: `/api/v1`. As rotas abaixo omitem esse prefixo para legibilidade.
- `AccessContext`: identidade autenticada (`identityId`), grupo (`groupId`), papel da sessão (`ADMIN` ou `PLAYER`) e `playerId` quando houver perfil associado. Derivado exclusivamente da sessão validada no servidor.
- `SessionView`: papel da sessão e perfil associado quando existir. Não inclui segredo, hash de credencial, e-mail de outros membros ou identificadores de autores de avaliações alheias.
- `PlayerSummary`: `id`, `name` e `photoUrl` opcional. A projeção administrativa acrescenta a informação de nota inicial; a listagem nunca contém credenciais.
- Respostas de erro: código estável e identificador de requisição; não expor stack, segredo ou existência de e-mail não autorizado. `400` para entrada inválida, `401` para sessão/credencial inválida, `403` para papel insuficiente e `404` para recurso fora do grupo.
- Sessões no PostgreSQL, com expiração e revogação verificadas em cada requisição protegida. O valor bruto da credencial não integra o contexto persistido de sessão.
- Comandos futuros na raiz: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build` e `pnpm test:e2e`. Cada comando deverá existir antes de ser citado como verificável no README.
- Pacotes futuros: `@futeio/api` e `@futeio/web`. Comandos de testes específicos abaixo pressupõem esses nomes.

## Critério comum de conclusão

Cada tarefa entrega uma alteração revisável, documentação de execução atualizada e testes dos comportamentos relevantes. Fluxos web devem funcionar em tela pequena e por teclado, com rótulos, foco e mensagens de erro. Logs e relatórios de teste não podem conter credenciais reais.

Depois dos testes da tarefa, executar as verificações da CI que ela afeta, inspecionar a saída e revisar o diff. Commit é uma ação futura do responsável pela integração, depois da revisão; trabalhadores não devem fazer commits por conta própria. Não publicar nem enviar mensagens aos jogadores como parte desses passos.

---

### Task 1: E1 — Fundação executável com web, API e PostgreSQL

**Worker:** standard

**Files:**
- Criar: arquivos de workspace, configuração e CI listados no mapa; `api/src/main.ts`, `api/src/app.module.ts`, `api/src/modules/health/health.controller.ts`, `api/src/modules/health/health.service.ts`.
- Criar: `api/prisma/schema.prisma` com registro mínimo de grupo piloto, primeira migration e provisionamento desse grupo; `web/src/app/layout.tsx`, `web/src/app/page.tsx` e configuração de estilos e encaminhamento de API correspondente à versão verificada.
- Criar: `docs/compatibilidade.md` e instruções operacionais no `README.md`.
- Testar: `api/test/health.e2e-spec.ts`.

**Interfaces:**
- Consome: escopo e ADR 0001; nenhum pacote de aplicação já existe.
- Produz: workspace com `@futeio/api` e `@futeio/web`; conexão de banco injetável no Nest; `GET /health/live` e `GET /health/ready`; comandos raiz da seção de convenções.
- `live` retorna `200` com estado simples do processo. `ready` retorna `200` quando o banco responde e `503` quando não responde, sem revelar configuração de conexão.

- [x] **Passo 1 — Verificar compatibilidade antes de gerar arquivos.** Consultar documentação oficial de Node.js, pnpm, Turbo, Next/React, Nest, Prisma/PostgreSQL, Tailwind e runners de teste; registrar versões exatas, versões mínimas declaradas, fontes e data em `docs/compatibilidade.md`. Verificar especialmente runtime/ESM do Prisma com Nest e versão React exigida pelo Next. Mobile não será instalado agora.
- [x] **Passo 2 — Preparar o mínimo necessário ao teste de integração.** Criar workspace web/API, banco local por Compose e banco de teste isolado; validar configuração obrigatória na inicialização. Adicionar teste para `live=200`, `ready=200` com PostgreSQL disponível e `ready=503` com dependência indisponível. Não expor nenhuma tabela de produto por endpoint.
- [x] **Passo 3 — Demonstrar a falha e implementar saúde/conexão.** Executar `pnpm --filter @futeio/api run test:integration --runInBand health.e2e-spec.ts` antes dos endpoints; a falha esperada é ausência do comportamento da rota, não configuração quebrada do runner. Implementar conexão e endpoints; executar o mesmo comando esperando os três cenários passando.
- [x] **Passo 4 — Integrar a web e documentar a execução limpa.** A página inicial identifica Futeio e o estado de planejamento/desenvolvimento, sem simular funcionalidades prontas. Documentar as variáveis e comandos reais de instalação, subida do banco, migrations, desenvolvimento e testes. Confirmar que a web chega à API pela origem prevista, sem copiar regras para o Next.
- [x] **Passo 5 — Configurar CI e verificar.** GitHub Actions instala pelo lockfile, gera o cliente Prisma, aplica migrations no PostgreSQL isolado e executa lint, tipos, unitários existentes, integração e builds. Verificar os mesmos comandos localmente; não usar uma suíte vazia como evidência de teste de produto. Testes E2E de produto entram com as jornadas seguintes.
- [x] **Passo 6 — Revisar e integrar.** Revisar arquivos gerados, segredos e instruções. Na execução autorizada, inicializar Git somente se ainda necessário e criar o commit revisado `chore: establish web api and database foundation`. Nenhum Git foi inicializado na etapa documental.

**Conclusão:** um ambiente limpo consegue preparar o banco, executar web/API e repetir os testes de saúde. O README deixa de apresentar comandos como futuros somente depois dessa comprovação. Não declarar publicação nesta entrega.


Evidência de E1: código no commit `9038860`, verificado também em cópia limpa. Ver [relatório da entrega](../../entregas/E1-fundacao.md). A execução de E2 foi autorizada posteriormente, em 03/11/2026; seu [relatório](../../entregas/E2-acesso-administrativo.md) ainda aguarda verificações finais. A conclusão de E1 não certifica CI remota ou publicação.

Adaptação do ambiente em E1: Docker Engine não estava disponível. A definição Compose foi criada e validada com a CLI oficial; os bancos reais usados nos testes foram PostgreSQL 18.6 portátil, com clusters separados. A marcação dos passos registra a implementação e as verificações locais descritas no relatório; não certifica subida de contêineres ou execução do workflow no GitHub.

### Task 2: E2 — Administrador provisionado com e-mail e senha

**Worker:** capable

Estado em 03/11/2026: E2 implementada e verificada localmente no commit `22742a2`. O usuário adiou o envio Resend e o link administrativo. Evidências no [relatório E2](../../entregas/E2-acesso-administrativo.md). E3 e seguintes permanecem fora desta autorização.

**Files:**
- Acesso: `api/src/modules/access/` com configuração, password, sessão, CSRF, guard administrativo, rate limit, DTOs e controller. O adaptador Resend existente fica desconectado e sem rotas de envio/resgate.
- Provisionamento: `api/scripts/configure-admin.cjs`; configuração documentada em `.env.example`, com valores reais somente no `.env` ignorado.
- Persistência: schema e migrations de identidade, vínculo, sessão e contadores de limite no PostgreSQL.
- Contratos: `api/src/openapi.ts`, `api/scripts/generate-openapi.cjs`, `api/openapi.json` e tipos gerados consumidos pela web, sem Prisma no cliente.
- Interface: `web/src/features/access/`, `web/src/app/entrar/page.tsx` e `web/src/app/administracao/page.tsx`.
- Testes: password/configuração/CSRF e sessão na API, `api/test/admin-access.e2e-spec.ts`, testes RTL em `web/src/features/access/` e `web/e2e/admin-access.spec.ts`.

**Interfaces:**
- Consome: banco, grupo piloto e regras de ambiente de E1. Não depende de chave ou entrega Resend.
- Produz: `GET /auth/csrf`, `POST /auth/admin/login` com e-mail/senha, `GET /auth/me`, `POST /auth/logout`, contexto autenticado e guard administrativo reutilizável. Prefixo externo: `/api/v1`.
- Login e logout exigem origem exata e `x-csrf-token`. Login válido retorna 200 e sessão ADMIN; e-mail desconhecido ou senha incorreta retorna 401 genérico, sem criar identidade. Entrada malformada retorna 400; falha de origem/CSRF retorna 403; limite excedido retorna 429 e Retry-After.
- `GET /auth/csrf` cria/reutiliza contexto de navegador e fornece HMAC vinculado à sessão. Login rotaciona a sessão, revoga a anterior e exige renovar o CSRF. Cookie `futeio_session`: HttpOnly, SameSite=Lax, Secure em HTTPS, TTL administrativo de oito horas e hash persistido no banco.
- Publica OpenAPI em `/api/v1/openapi.json` e Swagger em `/api/v1/docs`. Não publica rotas `admin/request-link` ou `admin/redeem`.

- [x] **Passo 1 — Provisionar sem versionar segredos.** Validar ADMIN_EMAIL, ADMIN_PASSWORD_HASH, APP_ORIGIN e AUTH_SECRET. O hash usa scrypt N=32768/r=8/p=3, salt de 16 bytes e chave de 64 bytes em base64url; o segredo tem 32 bytes. Gerar Prisma e compilar API antes de usar `pnpm admin:configure`; o helper solicita senha oculta ou recebe JSON por stdin, exige `.env` ignorado e grava hash entre aspas. Criar/reutilizar identidade e vínculo ADMIN apenas após login válido. Alterar credenciais exige reinício e invalida sessões antigas por credentialVersion.
- [x] **Passo 2 — Registrar RED/GREEN dos cenários relevantes.** Cobrir hash diferente com salts distintos, senha incorreta e hash malformado, configuração inválida e origem insegura. Na integração com PostgreSQL real: login autorizado, e-mail desconhecido, senha incorreta, ausência de CSRF, token de outra sessão, origem incorreta, sessão expirada/revogada, logout, rotação concorrente com um vencedor e credenciais reprovisionadas após reinício. Registrar os comandos e resultados no relatório, não apenas a existência dos testes.
- [x] **Passo 3 — Implementar sessão, autorização e limites.** Manter tokens crus fora do banco/logs; não usar localStorage para sessão. Aplicar contadores atômicos em janela fixa de 15 minutos: login 10 por peer e 5 por e-mail; CSRF 60 por peer. Não confiar em X-Forwarded-For; documentar orçamento compartilhado no proxy Next. Testar o bloqueio real e reinício da janela com relógio controlado; não substituir banco por mock para comprovar concorrência.
- [x] **Passo 4 — Fixar contrato reproduzível do primeiro consumidor.** Decorar DTOs/rotas, gerar OpenAPI e tipos com `pnpm contracts:generate`, verificar divergência com `pnpm contracts:check` e consumir os tipos na web. Geração usa fixtures isoladas e não credenciais locais. Os contratos não contêm hashes ou segredos, nem rotas de envio/resgate adiadas. Não exportar Prisma para o cliente.
- [x] **Passo 5 — Implementar a jornada web.** Formulário e-mail/senha em `/entrar`, sessão e saída em `/administracao`, proteção da área administrativa e tratamento de 401/403/429 e falhas de rede. Buscar CSRF antes do login e renová-lo após a rotação; não repetir silenciosamente um login ou logout com resultado incerto. Rótulos, foco, teclado e estados de envio devem ser testados. Não simular cadastro de jogadores que só será implementado em E3.
- [x] **Passo 6 — Verificar a entrega integrada.** Executar instalação pelo lockfile, migrations isoladas, `pnpm verify`, `pnpm contracts:check`, `pnpm test:e2e`, `pnpm test:smoke`, peers e audit. Inspecionar cookie/origem, sessão, credenciais de fixture e vazamentos; usar dados fictícios isolados. E-mail real não é critério E2 porque o envio foi explicitamente adiado. Preencher comandos, contagens, exit codes, ambiente e limitações no relatório E2 somente depois de executar.
- [x] **Passo 7 — Revisar e integrar.** Conferir diff e ausência de segredos; atualizar README, ADR 0002, matriz e relatório. Fazer commits revisados apenas pelo responsável pela integração, com autoria exclusiva do usuário e sem coautoria. Não iniciar E3, contratar serviços ou publicar por consequência deste passo.

**Conclusão exigida:** o administrador provisionado autentica com senha, recebe sessão protegida, consulta a área administrativa e encerra/invalida o acesso conforme os critérios. Não há cadastro público, recuperação automática, envio Resend ou links administrativos. Verificações registradas: 77 unitários, 19 integrações PostgreSQL, três jornadas de navegador, builds, contratos e smoke; revisão independente concluída. Sem publicação ou execução remota da CI.

### Task 3: E3 — Cadastro transacional com nota inicial e link pessoal

**Worker:** standard

Estado em 03/11/2026: implementada e verificada no commit `ab5c2ca`, em branch própria. [Relatório E3](../../entregas/E3-cadastro-jogadores.md): 94 unitários, 36 integrações, seis jornadas de navegador e CI GitHub/Ubuntu aprovada. E4 não foi iniciada.

**Files:**
- Criar: `api/src/modules/players/players.module.ts`, `players.controller.ts`, `create-player.service.ts` e DTOs de entrada/saída.
- Criar: `api/src/modules/evaluations/initial-rating.service.ts` e `api/src/modules/access/player-credential.service.ts` como responsabilidades internas injetáveis.
- Alterar: schema/migrations e registro dos módulos no Nest.
- Criar: `web/src/features/players/create-player-form.tsx`, `player-list.tsx` e `web/src/app/administracao/jogadores/page.tsx`.
- Testar: `api/test/create-player.e2e-spec.ts`, `web/src/features/players/create-player-form.test.tsx` e `web/e2e/create-player.spec.ts`.

**Interfaces:**
- Consome: `AccessContext`, guard administrativo, conexão/transações e grupo piloto de E2.
- Produz: `POST /players` com `name`, `initialRating` e opção administrativa `linkToCurrentAdministrator` (padrão falso); resposta `201` com perfil criado e `accessUrl` exibida uma vez. A opção vincula o perfil à identidade administrativa já existente quando o próprio administrador também joga; uma identidade possui no máximo um perfil nesse grupo. `GET /players` retorna projeção de lista para o papel autenticado, sem segredo de acesso.
- Persistência produz jogador, identidade associada (nova ou a do administrador explicitamente vinculado), contribuição inicial do administrador e credencial ativa, de forma atômica. A identidade administrativa independe de ter perfil.
- Nome: texto após remoção de espaços nas extremidades, de 1 a 100 caracteres; nomes iguais são permitidos. Nota: inteiro entre 0 e 10, sem coerção silenciosa de decimais ou ausência. Limites de texto são parâmetros técnicos documentados, não uma regra de unicidade.

- [x] **Passo 1 — Escrever casos de validação e autorização.** Aceitar notas 0 e 10; rejeitar ausência, -1, 11, 7,5, texto em vez de número, nome vazio e nome acima do limite. Aceitar dois jogadores com o mesmo nome e IDs diferentes. Sem sessão retorna `401`; sessão de jogador será testada em E4 como `403`.
- [x] **Passo 2 — Escrever os casos transacionais.** Cadastro válido produz exatamente uma contribuição do administrador, uma credencial e um perfil no mesmo grupo. O cadastro explicitamente vinculado ao próprio administrador reutiliza a identidade; rejeitar um segundo perfil para ela. Forçar falha na criação da nota/credencial e verificar ausência de perfil parcial. Verificar que hash é persistido e valor bruto não reaparece na listagem. Criar jogador não depende de e-mail nem de login prévio do destinatário.
- [x] **Passo 3 — Demonstrar falha e implementar o caso de uso.** Rodar `pnpm --filter @futeio/api run test:integration --runInBand create-player.e2e-spec.ts`, implementar a transação e repetir esperando todos os cenários passando. A contribuição inicial usa a identidade do administrador autenticado, nunca um autor recebido do cliente.
- [x] **Passo 4 — Ampliar o contrato existente.** Acrescentar os DTOs de jogadores ao OpenAPI e regenerar os tipos pela ferramenta escolhida em E2. Verificar na CI que o cliente corresponde ao contrato e não importa Prisma. Sanitizar exemplos Swagger: usar somente segredos fictícios.
- [x] **Passo 5 — Construir o fluxo administrativo.** Consumir os contratos gerados em formulário simples com rótulos, faixa da nota e mensagens de validação; mostrar o link pessoal somente após sucesso, com ação de copiar e orientação de envio individual. Desabilitar envio duplicado enquanto a requisição estiver pendente. Não configurar repetição automática da mutação de cadastro: diante de resultado incerto, consultar a lista antes de cadastrar novamente.
- [x] **Passo 6 — Verificar e integrar.** Executar integração, `pnpm --filter @futeio/web run test:unit --runInBand create-player-form.test.tsx` e `pnpm test:e2e` (o orquestrador executa o conjunto de jornadas) usando a sessão administrativa de teste. Atualizar README e ADRs com decisões realmente executadas. Commit futuro revisado: `feat: register players with initial rating and personal access link`.

**Conclusão:** o administrador cadastra um participante e recebe um link compartilhável. O participante já consta no grupo com nota inicial, sem precisar abrir o link. Nesta entrega, o resgate do link pelo jogador ainda depende de E4.

### Task 4: E4 — Resgate, sessão restrita e revogação do acesso do jogador

**Worker:** capable

**Files:**
- Criar: `api/src/modules/access/player-access.controller.ts`, `player-access.service.ts` e testes de política de sessão.
- Alterar: `session.service.ts`, `player-credential.service.ts`, controllers de jogadores e migrations necessárias para relacionamento entre credencial e sessão.
- Criar: `web/src/app/acesso/jogador/page.tsx`, `web/src/app/jogadores/[id]/page.tsx` e componentes de resultado de resgate/rotação.
- Testar: `api/test/player-access.e2e-spec.ts`, `web/src/features/access/player-access.test.tsx` e `web/e2e/player-access.spec.ts`.

**Interfaces:**
- Consome: identidade, credencial, perfil e contribuição inicial de E3; sessão e guards de E2.
- Produz: `POST /auth/player/redeem` com credencial, sessão `PLAYER`, `GET /players/:id` com perfil mínimo, `POST /players/:id/access-link/rotate` e `DELETE /players/:id/access-link`, estes dois exclusivos do administrador.
- Link válido abre sessão; o segredo reutilizável continua válido até revogação. Logout encerra apenas a sessão atual. Rotação devolve nova `accessUrl` uma vez e invalida o segredo anterior e suas sessões. A mesma operação também gera um link quando não há credencial ativa. Revogação sem rotação deixa o jogador sem novo acesso até o administrador gerar outro link.
- Perfil mínimo nesta entrega: identificação, nome e foto opcional já armazenada. Edição e upload são E5; tabela de avaliações é E6. Não apresentar controles falsamente funcionais.

- [ ] **Passo 1 — Fixar o transporte e escrever os cenários.** Definir a página de entrada que recebe o segredo sem propagá-lo para logs ou terceiros e o remove do endereço após resgate. Registrar sessão de jogador com duração absoluta inicial proposta de sete dias; a expiração da sessão não revoga o link. Testar token válido, inválido e revogado, expiração da sessão, reabertura do mesmo link, logout e nova entrada.
- [ ] **Passo 2 — Testar as fronteiras de acesso.** Jogador acessa perfis do grupo, mas não cadastra outro perfil, não gira/revoga links e não gera sorteios futuros. A lista não devolve e-mail administrativo, hash ou link. Contexto de grupo/autor vem da sessão; trocar IDs no request não concede acesso. Uma identidade com vínculo administrativo usando a credencial de jogador continua com sessão `PLAYER`.
- [ ] **Passo 3 — Testar revogação e concorrência.** Criar duas sessões derivadas do mesmo link, rotacionar e exigir `401` para ambas e para novo resgate do segredo antigo. Cobrir também revogar sem substituição → gerar novo link pelo endpoint de rotação → acessar pelo novo link, mantendo segredo e sessões antigas inválidos. Repetir com resgate simultâneo à rotação: depois do commit da revogação, nenhuma sessão derivada do segredo antigo pode autenticar. Perfil e nota inicial permanecem intactos.
- [ ] **Passo 4 — Demonstrar falha e implementar.** Rodar `pnpm --filter @futeio/api run test:integration --runInBand player-access.e2e-spec.ts` antes do resgate e registrar falha de comportamento. Implementar troca da credencial por sessão, escopo de papel, verificação de validade em cada requisição e revogação consistente. Ampliar OpenAPI com os endpoints de E4 e regenerar os tipos de cliente antes de consumi-los na web. Repetir os casos esperando sucesso.
- [ ] **Passo 5 — Implementar a experiência web mínima.** Resgate mostra o perfil acessado e oferece saída; link inválido orienta solicitar outro ao administrador. O administrador tem ação explícita de gerar novo link e aviso de que o anterior deixará de funcionar. Não renderizar links secretos em tabelas, atributos de elementos ou dados de hidratação de listagens.
- [ ] **Passo 6 — Verificar e integrar.** Executar integração, `pnpm --filter @futeio/web run test:unit --runInBand player-access.test.tsx`, `pnpm run test:e2e player-access.spec.ts` e regressão dos testes de acesso/cadastro. Inspecionar respostas da API, URLs finais e logs. Atualizar instruções de compartilhamento e recuperação. Commit futuro revisado: `feat: grant and revoke player access through personal links`.

**Conclusão:** um participante sem e-mail acessa seu perfil pelo link, continua restrito ao papel de jogador e perde o acesso quando o administrador revoga a credencial. Ainda não há avaliações completas, foto enviada ou sorteio implementado.

## Sequência depois de E4

| Entrega | Dependência e recorte para o próximo plano |
| --- | --- |
| E5 — Perfil | E4; edição autorizada de nome, escolha de armazenamento, upload validado e entrega privada de foto |
| E6 — Avaliações | E4/E5; uma nota vigente, autoavaliação, atualização imediata, média com cortes, lista de pendências, tabela com autoria protegida e concorrência |
| E7 — Sorteio | E6; seleção de 20 distintos, notas consistentes, algoritmo puro, semente, resultados e snapshots versionados |
| E8 — Piloto | E5–E7; provedor de hospedagem e orçamento definidos, HTTPS, migrations, backup/restauração, jornadas completas e coleta real de feedback |
| E9 — Mobile | Feedback web; plano próprio para Expo, autenticação mobile e testes com React Native Testing Library |

Os casos numéricos da seção 4 do escopo serão os primeiros testes de E6. Em E7, testar invariantes e reprodução antes de comparar distribuições. Medir custo/qualidade da heurística usando cenários identificados como sintéticos. Não incluir calendário ou presença para suportar avaliações abertas.

## Rastreabilidade de requisitos

| Requisitos do escopo | Entrega |
| --- | --- |
| RF-01 — Grupo fechado | E2, E4 e regressões em E5–E8 |
| RF-02 — Acesso administrativo | E2 |
| RF-03 e RF-04 — Cadastro, nota e link | E3 |
| RF-05 — Sessão do jogador | E4; edição de nome/foto em E5 |
| RF-06 — Revogação | E4 |
| RF-07 a RF-11 — Avaliar e consultar com privacidade | E6, plano próprio |
| RF-12 e RF-13 — Seleção, algoritmo e registro | E7, plano próprio |
| Operação e evidências | Base em E1/E2, publicação e coleta em E8 |
| Mobile | E9, fora desta execução inicial |

## Evidência e encerramento de cada entrega

Registrar comandos realmente executados, resultado, revisão e limitações no histórico de entrega. Não marcar checkboxes por existir um arquivo. Documento de entrega deve separar teste automatizado, inspeção manual, ambiente usado e resultado de produção.

Ao final de E4, atualizar o plano com o que efetivamente foi entregue e preparar E5/E6 a partir do código existente. Nenhuma execução está agendada ou disparada por este plano.
