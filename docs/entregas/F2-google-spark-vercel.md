# F2 — Google, Spark e publicação Vercel

Data: 2026-11-18. Branch: `codex/website-firebase`.

## Implementado

- Login Google e e-mail/senha do único administrador, restritos ao UID/e-mail configurados. Token Google recente e verificado é trocado pela mesma sessão opaca HttpOnly. Persistência Firebase em memória, descarte após troca e proteção contra conclusão do popup após desmontagem da tela.
- Jogadores mantêm links pessoais; perfis, notas anônimas e sorteios permanecem privados ao grupo.
- Fotos de produção no Vercel Blob privado: upload normalizado pelo servidor, caminho interno em Firestore e leitura autenticada sem cache. Compensação preserva objeto referenciado após confirmação de commit perdida.
- Credencial Firebase de servidor explícita, validando o projeto; Firebase Storage restrito aos emuladores locais.
- TTL pago removido; cron diário autenticado, limitado a 500 vencidos por coleção, com precondição de versão. Expiração permanece obrigatória no servidor.
- Configuração Vercel, exclusões de upload e documentação de variáveis/operação. App Hosting removido desta branch.
- Correções transitivas restritas de gRPC/Zod, mantendo auditoria de produção e lockfile congelado na CI.

## Evidências locais

Windows, Node 24.22.1, pnpm 11.25.0, Java 21:

| Verificação | Resultado |
| --- | --- |
| Instalação com lockfile congelado | Passou |
| Auditoria de dependências de produção | Nenhuma vulnerabilidade conhecida reportada |
| Lint, TypeScript e contratos gerados | Passaram |
| Testes unitários | 79 passaram (8 infraestrutura/compatibilidade, 2 regras puras, 69 interface) |
| Integração isolada | 20 passaram |
| Build de produção isolado | Passou, incluindo rota de manutenção |
| E2E | 10 passaram |

E2E executou o Chrome instalado `157.0.8103.79` em `C:/Program Files/Google/Chrome/Application/chrome.exe`, com `channel: chrome`, `chromiumSandbox: true` e lista vazia de argumentos que desativam a sandbox.

Integração cobre Google aprovado/rejeitado, token inválido/provider incorreto/antigo, concorrência de sessão/votos, privacidade, expiração, links, normalização de fotos e commit ambíguo. O teste do SDK Blob usa transporte interceptado sem rede e confirma autenticação, acesso privado, cache desativado, rejeição de URLs arbitrárias e falha quando falta token. E2E do Google usa popup do Auth emulator e conta sintética; não equivale ao login Google real em produção.

## Configurado no Firebase real

Projeto `fute-io`, sem migração de dados antigos:

- Rules Firestore publicadas e índices de expiração confirmados pela API.
- Faturamento confirmado desativado em 2026-11-18; TTL não habilitado nas duas coleções.
- Conta de serviço dedicada com apenas `roles/datastore.user` e `roles/firebaseauth.viewer`. Consulta ao UID do administrador e leitura Firestore verificadas usando essa identidade.
- Credencial privada armazenada localmente em pasta ignorada, sem entrar no Git. Nenhum bucket de produção, App Hosting ou serviço pago provisionado nesta entrega.

## Publicação real e verificações

Publicado em **[fute-io.vercel.app](https://fute-io.vercel.app)** na Vercel Hobby. Firebase permanece Spark. Projeto Next.js com Root Directory `web`, Node 24.x e acesso aos arquivos do workspace/lockfile da raiz. Blob privado dedicado `futeio-private-photos` em `iad1`, conectado apenas a Production. Credenciais de servidor configuradas somente em Production; previews não recebem esses acessos. O domínio autorizado do Firebase inclui `fute-io.vercel.app`, preservando os anteriores.

Versão funcional publicada: commit [`b4a6315`](https://github.com/roginaldosemog/futeio/commit/b4a63155a53fef0e06e08c14b93204561cba222c), deployment [`dpl_9ifKHAxdnDW1Dwu4VHmziTm6eePH`](https://vercel.com/igor-gomes-projects/fute-io/9ifKHAxdnDW1Dwu4VHmziTm6eePH). A [CI Ubuntu desse commit foi aprovada](https://github.com/roginaldosemog/futeio/actions/runs/44412656404), incluindo 79 testes unitários, 20 de integração, 10 E2E, build, tipos, contratos, lint e auditoria de produção. É evidência separada dos testes locais. A publicação anterior `f6b180c` já tinha [CI aprovada](https://github.com/roginaldosemog/futeio/actions/runs/44288083064), mas isso não detectava as incompatibilidades específicas do pacote/runtime Vercel.

Dois problemas encontrados e corrigidos na publicação:

1. Padrão `api` sem ancoragem no `.vercelignore` também excluía as rotas Next.js. Corrigido para `/api/`, limitado ao workspace antigo na raiz; novo build confirmou as duas rotas de API.
2. O runtime Vercel recusou `require(esm)` em `jwks-rsa`. Patch pnpm preserva JOSE 6 e as regras criptográficas, usando import dinâmico nos dois pontos. Regressão reproduziu a falha antes da correção e passou depois, inclusive com JWKS RSA e callbacks Passport. Detalhes e referência upstream em [compatibilidade](../compatibilidade.md).

Verificações reais em 2026-11-18:

- 14 verificações HTTP: páginas e readiness Firestore responderam 200; dados de jogadores/sorteios sem sessão responderam 401; origem incorreta respondeu 403; e-mail não autorizado/token Google inválido foram rejeitados; logout respondeu 200 e o acesso permaneceu bloqueado sem autenticação; cron sem segredo respondeu 401 e com segredo respondeu 200.
- Cookie de sessão confirmado `HttpOnly`, `Secure`, `SameSite=Lax`; respostas de sessão sem cache. Segredo de sessão e UID administrativo ausentes do HTML de login.
- No Blob real, JPEG sintético enviado e lido pelo adapter privado com igualdade dos bytes. Download direto sem credencial respondeu **403**. O objeto sintético foi removido ao final.
- Cron diário `0 6 * * *` confirmado no projeto, apontando para `/api/maintenance`. A chamada autenticada foi testada; ainda não se afirma execução automática futura do agendador.
- Chrome instalado `157.0.8103.79`, sandbox ativa e sem argumentos que a desativam: tela publicada em viewport 390×844 sem rolagem horizontal, campos de login visíveis, botão Google pronto, administração anônima redirecionando ao login e nenhum erro JavaScript capturado.

O responsável confirmou no chat, em 2026-11-18: **“Entrei com Google e e-mail/senha”**, usando o site publicado. Esta é uma confirmação manual do usuário, distinta dos testes automatizados com contas sintéticas. Não foram cadastrados jogadores reais para os testes automatizados de publicação. Não há senha, chave privada ou token de armazenamento no repositório. Os commits continuam somente com a autoria do responsável.

Deploy automático por Git não foi conectado: push executa a CI e a publicação ocorre pela CLI autenticada. O domínio próprio `fute.io` não foi comprado/configurado; o endereço publicado é o domínio gratuito da Vercel.

Nenhuma métrica de uso real ou impacto foi medida nesta entrega. Recursos gratuitos têm cotas; número de jogadores não garante disponibilidade ilimitada. Veja [configuração](../firebase.md) e [ADR 0010](../adr/0010-vercel-spark-blob-privado.md).
