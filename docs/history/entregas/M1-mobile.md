# M1 — Fundação mobile e acesso seguro

Data: 04/11/2026. Branch: `codex/mobile-app`, baseada no MVP web e na pesquisa de domínio já registrados. O usuário pediu um marco com commit para continuar o desenvolvimento no Mac, antes de concluir todos os fluxos mobile.

## Escopo implementado

React Native/Expo/Expo Router para Android e iPhone, com TypeScript, TanStack Query e SecureStore. Entrada administrativa por e-mail/senha; entrada de jogador colando seu link pessoal; restauração validada na API; logout; lista com busca/atualização e consulta de perfil/avaliações. Tema claro/escuro, navegação Stack e áreas seguras usam primitivas nativas. Não há WebView da aplicação web.

O backend recebeu transporte nativo de sessão opaca com os mesmos hashes, prazos, permissões e revogações. Endpoints nativos não exportam cookies do navegador; o bearer precisa ser validado no servidor antes de dispensar CSRF. Origin/HMAC/cookies da web permanecem. Não houve migration nem nova infraestrutura.

Os tipos gerados passaram para o workspace privado `@futeio/contracts`, com dois consumidores e somente exports de tipos. Cálculo, sorteio e acesso ao banco permanecem no Nest. Não há componentes web compartilhados com React Native.

## Evidências automatizadas locais

- `pnpm test:unit`: **200 testes aprovados** — 76 API, 63 web, 52 mobile e 9 scripts.
- `pnpm --filter @futeio/api run test:integration`: **87 testes aprovados**, incluindo os 70 anteriores e 17 de transporte nativo.
- `pnpm --filter @futeio/mobile run check:expo`: conjunto de dependências aprovado pelo SDK58.
- `pnpm install --frozen-lockfile --strict-peer-dependencies`: instalação reproduzível e peers aprovados.
- `pnpm lint`, `pnpm typecheck` e `pnpm contracts:check`: aprovados em todo o monorepo.
- `pnpm build`: API e web compiladas; Android e iOS exportados em bundles Hermes.

Os testes mobile cobrem sessão no armazenamento seguro, restauração, 401/revogação, login com falha, saída sem conexão, respostas atrasadas de sessões antigas, URLs pessoais de origem não autorizada, omissão de cookies/bloqueio de redirects, formulários, busca e projeção anônima. Os testes de integração demonstram limites compartilhados entre web/mobile, permissões, expiração, logout e revogação de links.

Os temporizadores das interações RNTL usam a fila real de microtasks para o `act` assíncrono do React. A execução unitária do Turbo é sequencial: os primeiros testes DOM excederam o orçamento quando competiam com integração/hash no Windows; o mesmo conjunto passou integralmente sem alterar as asserções ou ampliar timeouts.

O banco de teste portátil foi retomado após interrupção do ambiente. Uma primeira tentativa sem PostgreSQL em 5433 falhou por indisponibilidade; o resultado aprovado acima foi obtido com o banco ativo, sem substituir persistência por mocks nem apagar bancos.

## Limites e continuidade

Não foram compilados binários nem executados simuladores, emuladores ou aparelhos Android/iPhone neste Windows. Exportação e testes em Node não comprovam integração do Keychain/Keystore, rede nativa, teclado, gestos ou acessibilidade no sistema. A primeira tarefa no Mac é instalar/executar M1 e registrar essa evidência, incluindo tema escuro e texto ampliado.

Fotos, edição, envio de avaliações, cadastro/gestão de links e sorteios no aplicativo pertencem aos próximos marcos. A web já implementa esses recursos. O M1 exige colar o link na entrada; universal/app links e distribuição ainda não foram implementados. Não há publicação em lojas, projeto EAS, domínio adquirido ou deploy nesta entrega.

A CI foi ampliada para a checagem Expo e as tarefas mobile do Turbo; os builds mobile são exportações JavaScript, sem assinatura. O resultado remoto é consultado por commit na [branch mobile](https://github.com/roginaldosemog/futeio/actions?query=branch%3Acodex%2Fmobile-app), sem pressupor aprovação antes da execução.

As oito jornadas Chrome anteriores não foram reexecutadas localmente neste marco; o workflow preserva sua execução com Chrome instalado e sandbox ativa. Nenhuma evidência de navegador é apresentada como evidência de funcionamento nativo.

Ver [instruções para continuar no Mac](../../mobile/README.md), [matriz de compatibilidade](../compatibilidade.md) e [ADR0007](../adr/0007-acesso-nativo-com-sessao-opaca.md). Credenciais locais e bancos não são transferidos pelo Git; o administrador deve ser provisionado interativamente no novo ambiente.
