# Primeiras entregas do Futeio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use pitroom-driven-development to implement this plan task-by-task (each task runs as `pitroom run -i --plan <this file> --step N`). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Limite de autorização:** o planejamento começou em 02/11/2026 com autorização somente documental. Em mensagem posterior, o usuário autorizou implementar **apenas E1** e fazer commits com sua autoria. E2–E4 não estão autorizadas. A existência deste arquivo não autoriza contratar serviços, publicar o produto ou executar as entregas seguintes.

**Goal:** Entregar, em uma execução futura autorizada, a base verificável do produto, o acesso administrativo, o cadastro com nota inicial e o acesso restrito dos jogadores por link.

**Architecture:** Uma web Next.js consome uma API NestJS modular, com PostgreSQL/Prisma. Identidades, perfis e credenciais são separados; regras e permissões pertencem ao backend. O piloto tem um grupo e web responsiva.

**Tech Stack:** TypeScript, Next.js App Router, Tailwind CSS, NestJS, OpenAPI, PostgreSQL, Prisma, pnpm workspaces, Turborepo, Docker Compose e GitHub Actions; Jest, React Testing Library, Supertest e Playwright nas respectivas camadas. Versões serão verificadas antes da configuração, sem instalação nesta etapa de planejamento.

**Spec:** [Escopo e arquitetura aprovados](../specs/2026-11-02-futeio-mvp-design.md), em conjunto com os [ADRs](../../adr/0001-monorepo-e-monolito-modular.md).

## Global Constraints

- Autorização atual limitada a E1; E2–E4 continuam planejadas.
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
- [ ] **Passo 6 — Revisar e integrar.** Revisar arquivos gerados, segredos e instruções. Na execução autorizada, inicializar Git somente se ainda necessário e criar o commit revisado `chore: establish web api and database foundation`. Nenhum Git foi inicializado na etapa documental.

**Conclusão:** um ambiente limpo consegue preparar o banco, executar web/API e repetir os testes de saúde. O README deixa de apresentar comandos como futuros somente depois dessa comprovação. Não declarar publicação nesta entrega.

### Task 2: E2 — Login administrativo por e-mail autorizado

**Worker:** capable

**Files:**
- Criar: `api/src/modules/access/access.module.ts`, `access.controller.ts`, `admin-login.service.ts`, `session.service.ts`, `email-sender.port.ts`, adaptador de e-mail e `admin.guard.ts`.
- Alterar: `api/prisma/schema.prisma`, migrations, `.env.example` e configuração da API para a identidade administrativa e grupo piloto.
- Criar: `web/src/features/access/admin-login-form.tsx`, `web/src/app/entrar/page.tsx` e `web/src/app/acesso/administrador/page.tsx`.
- Criar: publicação OpenAPI e geração dos tipos de acesso consumidos pela web; criar pacote em `packages/` somente se esta for a forma selecionada de distribuição do contrato.
- Testar: `api/test/admin-access.e2e-spec.ts`, `api/src/modules/access/admin-login.service.spec.ts`, `web/src/features/access/admin-login-form.test.tsx` e `web/e2e/admin-access.spec.ts`.

**Interfaces:**
- Consome: conexão e convenções de E1; apenas um grupo piloto provisionado internamente.
- Produz: `POST /auth/admin/request-link` com e-mail, `POST /auth/admin/redeem` com credencial, `GET /auth/me`, `POST /auth/logout`, `AccessContext` e guard administrativo reutilizável.
- Solicitar link de e-mail autorizado ou não autorizado responde `202` com a mesma mensagem; só o autorizado recebe e-mail. Redeem válido cria sessão `ADMIN`; inválido, expirado ou já usado retorna `401`. `me` retorna `SessionView` ou `401`; logout invalida a sessão atual.

- [ ] **Passo 1 — Fixar o adaptador e parâmetros antes do código dependente.** Escolher serviço transacional e mecanismo de teste, documentando custo, configuração e recuperação de falha de envio. A escolha não autoriza contratação paga sem alinhamento. Registrar expiração inicial de 15 minutos para o link e, como ponto de partida técnico, sessão administrativa de oito horas de duração absoluta. Limites de tentativas devem ter valores explícitos no teste e configuração antes da conclusão.
- [ ] **Passo 2 — Escrever os cenários de acesso.** Cobrir e-mail permitido/proibido com resposta pública equivalente; prova de que informar e-mail não autentica; token inválido, expirado e repetido; dois resgates concorrentes com um único sucesso; sessão expirada; logout; requisição protegida sem sessão; bloqueio por origem/CSRF e por excesso de tentativas. Testes de tempo usam relógio controlado.
- [ ] **Passo 3 — Executar os testes e implementar o mínimo.** Rodar `pnpm --filter @futeio/api run test:integration --runInBand admin-access.e2e-spec.ts`, registrar a falha de comportamento e implementar identidade, envio, consumo atômico e sessão. Guardar somente hashes dos segredos. Usar adaptador falso em testes determinísticos; testar separadamente o adaptador real com destino controlado pelo responsável.
- [ ] **Passo 4 — Fixar o contrato do primeiro consumidor interativo.** Publicar endpoints e DTOs de autenticação em OpenAPI, escolher a geração de tipos compatível com a matriz e produzir os tipos consumidos pela web antes da jornada de login. A CI verifica divergências; clientes não importam Prisma. Usar apenas segredos fictícios nos exemplos Swagger. A verificação de encaminhamento de saúde de E1 não exige um cliente interativo de produto.
- [ ] **Passo 5 — Implementar a jornada web.** Usar os contratos gerados no formulário rotulado, confirmação genérica de envio, tratamento de link vencido e entrada administrativa. Validar resgate e cookie seguro; remover a credencial da URL e impedir cache de dados de sessão. A página de resgate não carrega scripts/recursos de terceiros que recebam a credencial. Nenhum segredo é escrito em logs.
- [ ] **Passo 6 — Verificar integração e navegador.** Repetir a integração, executar `pnpm --filter @futeio/web run test:unit --runInBand admin-login-form.test.tsx` e `pnpm run test:e2e admin-access.spec.ts`. Inspecionar cookie, erros e logs de teste com credenciais fictícias. Validar envio real em ambiente controlado antes de declarar o login pronto para o piloto; usar somente fake não comprova entrega de e-mail.
- [ ] **Passo 7 — Revisar e integrar.** Atualizar instruções de bootstrap, e-mail e revogação administrativa, manter segredos fora do repositório e registrar fontes dos controles no ADR 0002. Commit futuro revisado: `feat: authenticate administrator with email access link`.

**Conclusão:** o responsável autorizado recebe e usa um link para obter sessão administrativa; conhecer ou digitar seu e-mail não concede privilégios. Existe um guard e contexto de acesso reutilizáveis pelas próximas entregas.

### Task 3: E3 — Cadastro transacional com nota inicial e link pessoal

**Worker:** standard

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

- [ ] **Passo 1 — Escrever casos de validação e autorização.** Aceitar notas 0 e 10; rejeitar ausência, -1, 11, 7,5, texto em vez de número, nome vazio e nome acima do limite. Aceitar dois jogadores com o mesmo nome e IDs diferentes. Sem sessão retorna `401`; sessão de jogador será testada em E4 como `403`.
- [ ] **Passo 2 — Escrever os casos transacionais.** Cadastro válido produz exatamente uma contribuição do administrador, uma credencial e um perfil no mesmo grupo. O cadastro explicitamente vinculado ao próprio administrador reutiliza a identidade; rejeitar um segundo perfil para ela. Forçar falha na criação da nota/credencial e verificar ausência de perfil parcial. Verificar que hash é persistido e valor bruto não reaparece na listagem. Criar jogador não depende de e-mail nem de login prévio do destinatário.
- [ ] **Passo 3 — Demonstrar falha e implementar o caso de uso.** Rodar `pnpm --filter @futeio/api run test:integration --runInBand create-player.e2e-spec.ts`, implementar a transação e repetir esperando todos os cenários passando. A contribuição inicial usa a identidade do administrador autenticado, nunca um autor recebido do cliente.
- [ ] **Passo 4 — Ampliar o contrato existente.** Acrescentar os DTOs de jogadores ao OpenAPI e regenerar os tipos pela ferramenta escolhida em E2. Verificar na CI que o cliente corresponde ao contrato e não importa Prisma. Sanitizar exemplos Swagger: usar somente segredos fictícios.
- [ ] **Passo 5 — Construir o fluxo administrativo.** Consumir os contratos gerados em formulário simples com rótulos, faixa da nota e mensagens de validação; mostrar o link pessoal somente após sucesso, com ação de copiar e orientação de envio individual. Desabilitar envio duplicado enquanto a requisição estiver pendente. Não configurar repetição automática da mutação de cadastro: diante de resultado incerto, consultar a lista antes de cadastrar novamente.
- [ ] **Passo 6 — Verificar e integrar.** Executar integração, `pnpm --filter @futeio/web run test:unit --runInBand create-player-form.test.tsx` e `pnpm run test:e2e create-player.spec.ts` usando a sessão administrativa de teste. Atualizar README e ADRs com decisões realmente executadas. Commit futuro revisado: `feat: register players with initial rating and personal access link`.

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
