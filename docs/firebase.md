# Publicação — Vercel Hobby + Firebase Spark + Blob privado

Decisão vigente: [ADR 0010](adr/0010-vercel-spark-blob-privado.md). Não ative Blaze para este piloto. App Hosting, Cloud Storage e TTL gerenciado não são usados em produção.

O piloto foi publicado em [fute-io.vercel.app](https://fute-io.vercel.app), projeto Vercel `fute-io`, escopo Hobby `igor-gomes-projects`, com Firebase `fute-io`. O domínio próprio `fute.io` não foi comprado ou configurado. A versão inicial foi publicada a partir de `codex/website-firebase`; a preparação de colaboração promoveu o website para `main`, a base estável. A API compatível com mobile foi publicada a partir da branch `codex/mobile-firebase-api`, sem merge na principal; veja [M4](entregas/M4-mobile-firebase.md). A integração de deploy automático por Git não está conectada. Fazer push no GitHub executa a CI, mas não publica sozinho na Vercel. Veja as [evidências e limitações iniciais](entregas/F2-google-spark-vercel.md) e a [preparação da main](entregas/F3-colaboracao-privada.md).

## Contas e administrador

1. No projeto Firebase, habilite Firestore Native e os provedores Authentication Google e e-mail/senha. Crie/confirme o único administrador e anote seu UID e e-mail.
2. Entre na Vercel com conta Hobby. Crie o projeto ligado a este repositório/branch, framework Next.js, Root Directory `web`, Node 24.x. Permita arquivos fora do Root Directory para usar o lockfile/workspace da raiz. Instalação: `pnpm install --frozen-lockfile`; build: `pnpm build` a partir de `web`.
3. Crie um **Blob Store privado**, dedicado ao projeto, e conecte-o somente ao ambiente Production. A conexão fornece `BLOB_READ_WRITE_TOKEN`. Um store público não serve para este produto.
4. Crie uma conta de serviço Firebase dedicada ao site, com `roles/datastore.user` e `roles/firebaseauth.viewer`. Não use Owner/Editor. Gere a chave JSON e configure-a como segredo de servidor na Vercel. Guarde a cópia local somente em local ignorado, nunca no Git/chat. Revogue a chave ao deixar de usá-la. Se a organização impedir chaves, use identidade federada em uma entrega específica; não relaxe a política.

## Variáveis Production na Vercel

| Variável | Valor |
| --- | --- |
| `FUTEIO_FIREBASE_MODE` | `production` |
| `FIREBASE_PROJECT_ID` | ID real do projeto |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo da conta de serviço, segredo somente servidor |
| `FIREBASE_ADMIN_UID` | UID exato do único administrador |
| `ADMIN_EMAIL` | E-mail correspondente ao UID |
| `FIREBASE_WEB_API_KEY` | API key Web Firebase (identificador público usado pelo Auth) |
| `FIREBASE_WEB_APP_ID` | App ID Web registrado |
| `AUTH_SECRET` | Aleatório, pelo menos 32 caracteres; não reutilizar emulador |
| `APP_ORIGIN` | Origem HTTPS exata e estável da produção, sem barra final |
| `BLOB_READ_WRITE_TOKEN` | Token do store Blob privado |
| `CRON_SECRET` | Outro segredo aleatório de pelo menos 32 caracteres |

Não configure hosts de emulador, `STORAGE_EMULATOR_HOST` ou `FIREBASE_STORAGE_BUCKET` em produção. Não use prefixo `NEXT_PUBLIC_` para os segredos. A página de login recebe apenas a configuração pública necessária ao Firebase Auth. O SDK Web usa persistência em memória e sai após trocar o token Google por cookie HttpOnly. UID autorizado, credencial de serviço e segredos ficam no servidor.

Previews devem ficar sem credenciais de produção. Para testes externos de previews, use projeto Firebase/store/segredos separados e domínio autorizado próprio. Não publique dados reais por engano em previews.

## Rules e índices Spark

Execute `pnpm exec firebase deploy --project SEU_ID --only firestore:rules,firestore:indexes`. O alias padrão continua sendo um projeto demo para reduzir acidentes. Não faça deploy de Storage em produção.

Rules negam acesso direto do cliente ao Firestore. O Admin SDK usa IAM e exige autorização nas rotas do servidor. Os índices simples de `expiresAt` atendem à limpeza; não há configuração TTL paga.

## Publicar e validar

1. Configure todas as variáveis Production antes da primeira publicação.
2. Em Authentication > Settings > Authorized domains, acrescente o hostname da produção Vercel, preservando os existentes. Confirme também Google habilitado. Se usar domínio próprio depois, atualize `APP_ORIGIN`, os domínios autorizados e publique novamente.
3. Execute os checks do README e publique com a CLI autenticada: `pnpm dlx vercel@66.1.0 --prod`, com projeto/root directory previamente vinculados. Revise os arquivos incluídos; `.env.firebase`, `.firebase`, `.vercel`, caches e chaves não podem entrar no upload. A CLI não deve conectar um plano pago automaticamente.

   No `.vercelignore`, `/api/` exclui o workspace antigo e `/mobile/` mantém o cliente nativo fora do upload web. Preserve `packages/contracts` no upload: web e mobile compartilham os tipos REST. Não use `api` sem ancoragem: esse padrão também exclui `web/src/app/api`. Confirme que o build publicado lista `/api/v1/[...path]`, `/api/maintenance` e `/acesso/aplicativo`, além de testar os endpoints na URL real.
4. Verifique login Google e e-mail/senha com o UID configurado, rejeição de outro UID, logout, link do jogador, edição de perfil/foto, avaliações e sorteio. Testes com emulador são evidência distinta do login real publicado.
5. Confirme que o cron diário `/api/maintenance` está ativo no deployment de produção. A Vercel envia `Authorization: Bearer CRON_SECRET`; chamadas sem o segredo recebem 401. Não coloque o segredo na URL.

A limpeza remove até 500 documentos vencidos por coleção/dia: sessões, rate limits e grants de login nativo. Usa precondição de versão para não apagar documentos alterados após a leitura. Expiração é validada em cada requisição mesmo se o cron atrasar/falhar. Falhas retornam 503 e geram evento genérico sem segredos. Se houver acúmulo, execute a rotina de forma autenticada e investigue antes de ampliar o limite. Fotos órfãs exigem reconciliação manual em janela sem uploads, confirmando que nenhum perfil referencia o objeto.

O mobile usa os mesmos endereços HTTPS da publicação, sem novas variáveis privadas ou clientes OAuth Google nativos. Publique o índice `nativeLoginGrants.expiresAt` antes de habilitar o app. O Google abre a página web de autorização e requer aplicativo instalado para retornar pelo scheme; veja [ADR 0012](adr/0012-mobile-na-api-firebase.md). Não coloque credenciais Production em Expo/EAS ou no bundle.

## Operação e limites

Há um grupo fixo; lista de até 500 perfis, vinte selecionados por sorteio e cinquenta sorteios recentes no histórico. O piloto é pessoal e não comercial, conforme Hobby. Consulte as cotas de Auth/Firestore/Vercel/Blob: o número de pessoas não garante disponibilidade dentro delas. Exceder limites gratuitos pode bloquear recursos. Não há promessa de uso ilimitado nem de métricas de impacto antes de medir.

Fotos privadas são lidas pelo servidor após validar associação ao grupo, sem URLs públicas e com resposta `private, no-store`. JPEG/PNG de até 2 MiB são reencodificados, reduzidos e têm metadados removidos. O Storage emulator é somente a implementação descartável de testes; produção sempre usa Blob privado e falha se faltar sua configuração.

Defina exportação/backup antes de cadastrar dados importantes. PostgreSQL e sessões/links antigos não são importados; não apague o banco antigo. Desative/revogue o administrador no Auth em caso de comprometimento. Trocar UID ou credenciais exige atualizar variáveis e republicar. Um segundo administrador exige revisão do modelo.

## Fontes oficiais (2026-11-18)

- [Vercel Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs), [monorepos](https://vercel.com/docs/monorepos), [Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- [Hobby](https://vercel.com/docs/plans/hobby), [Blob privado](https://vercel.com/docs/vercel-blob/private-storage), [SDK Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk), [cotas Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing).
- [Cron Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing), [proteção de cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- [Firebase Admin](https://firebase.google.com/docs/admin/setup), [cotas Firestore](https://firebase.google.com/docs/firestore/quotas), [Google login](https://firebase.google.com/docs/auth/web/google-signin).
