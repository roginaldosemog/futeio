# E3 — Cadastro de jogadores, nota inicial e link pessoal

Data: 03/11/2026. Estado: implementada e verificada localmente e no GitHub/Ubuntu. Código: `ab5c2ca`; ajuste do modo de revisão: `e306d6a`.

## Escopo implementado

O administrador acessa `/administracao/jogadores` pelo menu, cadastra nome e nota inteira de 0 a 10 e consulta a lista do grupo. Nomes iguais são permitidos. A opção “Este é o meu perfil” reutiliza sua identidade administrativa, sem criar outro avaliador ou conceder papel administrativo a um jogador comum.

O cadastro cria identidade/vínculo quando necessário, perfil, contribuição inicial do administrador e credencial na mesma transação. Falha na nota ou credencial desfaz todas as gravações. O vínculo de perfil com identidade é único no grupo; duas requisições concorrentes para o perfil próprio produzem um cadastro e um conflito 409.

A resposta 201 apresenta o link pessoal para copiar. O backend persiste somente seu hash; listagens devolvem id, nome, nota e indicação de perfil próprio. O resultado e o link somem ao iniciar outro cadastro, sair da página ou recarregar. O acesso pelo link ainda pertence à E4 e a interface informa essa limitação.

## Decisões e fronteiras

- `POST /api/v1/players`: nome, initialRating e linkToCurrentAdministrator opcional, padrão false. `GET /api/v1/players`: lista administrativa do grupo da sessão. Cliente não escolhe autor, grupo, identidade ou papel.
- AdminGuard e CSRF protegem criação; a listagem exige ADMIN nesta entrega. Anônimo recebe 401; PLAYER recebe 403. Não foi implementado resgate de link, edição de perfil, avaliações de membros ou sorteio.
- Evaluation guarda a contribuição inicial com chave única de grupo/alvo/avaliador. A nota mostrada em E3 é essa contribuição; médias e cortes de extremos continuam em E6.
- FKs compostas impedem relacionar avaliação/credencial a um perfil de outro grupo. PostgreSQL valida faixa de nota, nome e unicidade de credencial ativa por perfil. A migration não altera ou apaga registros existentes.
- Credencial opaca de 32 bytes aleatórios, SHA-256 persistido e segredo no fragmento de `/acesso/jogador#token=...`. Não há segredo em listagens ou exemplos OpenAPI.
- TanStack Query 5.105.3 gerencia a lista e invalidação. QueryClient restrito à página privada, limpo ao desmontar ou perder autorização. A lista recebe somente o resumo do jogador; a mutation é resetada ao limpar o resultado. Não há persistência em storage ou retry automático de cadastro.
- POST201 confirmado permanece sucesso mesmo se a atualização da lista falhar. Resultado incerto orienta conferir a lista e bloqueia novo envio até atualização bem-sucedida, reduzindo cadastro duplicado por repetição automática.
- Swagger declara explicitamente o booleano; geração com `--default-non-nullable false` preserva entrada opcional com default no servidor. Tipos gerados são consumidos sem importar Prisma.

## Evidências de desenvolvimento

O teste inicial da API recebeu 404 quando esperava cadastro201, antes da implementação. Os 16 primeiros testes novos da interface falharam com comportamento ausente antes do código. O cenário de privacidade foi acrescentado e os testes de foco demonstraram falha antes da correção.

Revisão independente aprovou backend, interface e o cleanup de fixtures após corrigir o foco: a confirmação recebe foco no título, e “Cadastrar outro jogador” devolve foco ao Nome. Também foram corrigidos o tipo booleano no Swagger e a geração de opcionais detectados pela integração TypeScript.

O cleanup E2E observa somente IDs dos cadastros201 do próprio servidor, remove esses perfis e identidades sintéticas e preserva dados de outros testes. O namespace administrativo reservado precisa estar vazio ao iniciar; se já existe, o servidor falha sem removê-lo.

## Verificações

Baseline preservada: Windows, Node 24.22.1, pnpm 11.25.0, PostgreSQL 18.6 portátil em clusters separados. Quatro migrations aplicadas em desenvolvimento e testes. Nenhum jogador fictício foi cadastrado no banco de desenvolvimento para comprovar a interface.

Verificações finais, todas com exit code 0:

| Comando | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Lockfile e peers consistentes |
| `pnpm verify` | Lint, tipos, unitários, integração e builds passaram |
| `pnpm test:unit` (em verify) | **94**: nove de tooling, 44 da API e 41 da web |
| `pnpm test:integration` (em verify) | **36**: 17 de cadastro, 15 de acesso e quatro de saúde |
| `pnpm test:e2e` | **Seis** jornadas com API e banco reais; Windows Chrome 156.0.8078.80, sandbox solicitada, flags de desativação ausentes |
| `pnpm contracts:check` | Schema e tipos correspondentes |
| `pnpm test:smoke` | Web/API compiladas, PostgreSQL e encaminhamento na mesma origem |
| `pnpm peers check` e `pnpm audit --prod` | Nenhum problema de peers ou vulnerabilidade conhecida retornada |

A inspeção visual conferiu 1440, 390 e 320 px, estados vazio/sucesso/erro/carregamento, lista com 25 nomes sintéticos/longos, teclado e foco. Não houve corte horizontal; campos têm 52 px. Usou respostas interceptadas somente no contexto do navegador, sem escrita no banco, e não constitui evidência adicional de integração. O detector de interface retornou lista vazia. Duas capturas também foram inspecionadas por revisão independente.

O teste pontual de namespace criou uma identidade sentinela no banco guardado de testes, verificou que o servidor recusou iniciar e preservou o ID preexistente, e removeu somente o ID criado pelo teste em finally. Não houve limpeza de tabelas inteiras. Os servidores de teste/revisão liberaram as portas 3100/3101.

Durante QA foi encontrado um problema no modo interativo: após `stop`, os servidores eram encerrados mas stdin mantinha o processo Node ativo. O ajuste pausa stdin; nova execução TTY de `pnpm test:e2e --serve` confirmou encerramento com exit0. A web foi recompilada com API_ORIGIN normal e o ambiente local 3000/3001 foi restaurado; a lista sem sessão retorna 401.

## CI de base confirmada

Antes da E3, [a execução E1/E2 em main](https://github.com/roginaldosemog/futeio/actions/runs/41711754646) concluiu com sucesso no runner `ubuntu-24.04`, commit `6213eb0`. Chrome real: `/opt/google/chrome/chrome`, versão156.0.8078.79, sandbox solicitada e nenhuma flag de desativação. O histórico revisado foi enviado ao repositório remoto inicialmente vazio; a E3 foi desenvolvida em branch separada.

## Limites

E4 e seguintes não foram iniciadas. Resend permanece desconectado; não houve envio de e-mail, publicação do produto ou coleta de métricas de uso/impacto. Os resultados sintéticos são testes, não adesão de jogadores reais. Não houve merge na main; a E3 está na branch `feat/e3-player-registration`.

## CI da E3

[Execução 41716159752](https://github.com/roginaldosemog/futeio/actions/runs/41716159752), commit `ab5c2ca`: **success** no GitHub/Ubuntu 24.04. O workflow executou instalação, migrations em PostgreSQL de contêiner, lint, tipos, 94 unitários, 36 integrações, builds, contratos, smoke e seis jornadas Chrome. O registro efetivo confirmou:

```json
{"executable":"/opt/google/chrome/chrome","version":"156.0.8078.79","channel":"chrome","chromiumSandbox":true,"sandboxDisablingFlags":[]}
```

As versões de navegador são observações dessas execuções, não promessa de atualização contínua ou auditoria de todas as camadas da sandbox. Playwright e caches compartilhados foram preservados.
