# F4 — Integração na main e abertura do código

Data: 2026-11-19. Autorização do mantenedor: reunir o trabalho na `main`, protegê-la e tornar o repositório público. A abertura do código não abre os dados da pelada nem altera a autorização do aplicativo.

## Integração e histórico

Os três commits da branch `codex/mobile-firebase-api` foram integrados por fast-forward, de `3fd8942` até `62cb0a8`, sem rebase, squash ou reescrita do histórico. Todos têm Igor Gomes como autor e committer. As oito tags `archive/2026-11-19/*` continuam preservando versões anteriores. A configuração e os guias atuais acompanham a `main`; os relatórios anteriores continuam sendo registros históricos.

O código integrado tinha [CI Ubuntu aprovada em `62cb0a8`](https://github.com/roginaldosemog/futeio/actions/runs/44466886897), incluindo web, mobile, emuladores Firebase, builds e Chrome com sandbox. A CI da `main` deve terminar antes da mudança de visibilidade. Não houve alteração de comportamento do produto nesta preparação.

## Revisão anterior à abertura

- Gitleaks 8.30.1: 35 commits e todas as refs locais examinados, sem achados.
- Conteúdo de 599 blobs históricos comparado com 68 padrões privados locais, incluindo credenciais reais de servidor, tokens e links/IDs de jogadores: sem correspondências. Valores reais não foram impressos ou versionados pelo procedimento.
- Todos os 18 logs de Actions disponíveis baixados e examinados, também pelo Gitleaks: sem achados ou correspondências aos padrões privados conhecidos.
- Nenhum artefato, release, issue ou comentário publicado encontrado. Nenhum segredo/variável/environment do GitHub Actions configurado. Somente o mantenedor possui acesso de escrita/administração.
- `.env*` reais, `.firebase`, `.vercel`, credenciais de serviço e links pessoais permanecem ignorados. A varredura não prova ausência de todos os tipos possíveis de informação sensível.

## Política a aplicar e conferir no GitHub

O GitHub retornou 403 para proteção enquanto o repositório era privado no plano atual. Por isso, a configuração é preparada antes e aplicada imediatamente após a mudança para público. Não é necessário contratar um plano pago. Referência: [disponibilidade de proteção de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

`.github/main-protection.json` define:

- Pull request obrigatório e os checks `History secret scan` e `Website, Firebase emulators and Chrome`, com branch atualizada.
- Checks vinculados ao aplicativo GitHub Actions (`app_id: 15368`, confirmado na API), histórico linear e conversas resolvidas.
- Regras aplicáveis também a administradores, sem force push ou exclusão da `main`.
- Zero aprovações adicionais obrigatórias enquanto houver um único mantenedor; o autor não pode aprovar seu próprio PR.

A abertura também prevê relatórios privados de vulnerabilidades, alertas/varredura/proteção de segredos disponíveis gratuitamente para código público e aprovação de workflows de todos os contribuidores externos via forks. As permissões de Actions continuam de leitura, com ações permitidas limitadas e fixadas por SHA. Não se deve interpretar o arquivo de política como confirmação de que o GitHub a aplicou: confira a API/interface após a operação.

## Limites preservados

Os serviços de produção continuam no ambiente Production da Vercel/Firebase Spark/Blob privado, sem integração automática de deploy por Git. Nenhum perfil, avaliação, foto ou sorteio real foi incluído no repositório. Relatos de falhas devem usar o canal privado indicado em `SECURITY.md`. Uma licença de reutilização ainda não foi definida; esta operação não adiciona uma licença automaticamente.

A homologação instalada do aplicativo em Android/iPhone e a ocorrência pontual do login Google no emulador continuam com os limites registrados em [M4](M4-mobile-firebase.md). A integração/publicação do código não constitui evidência nova de uso real ou impacto.
