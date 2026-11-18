# Conectar ao Firebase depois

Este guia não executa criação de recursos nem publicação. Use primeiro os emuladores conforme o README. Não reutilize credenciais sintéticas no ambiente real.

## Serviços e administrador

1. Crie um projeto seu, habilite Blaze conscientemente e crie o **Cloud Firestore Standard, modo Native**, banco `(default)`. Escolha a região próxima do grupo antes de criar os dados.
2. Habilite Authentication → E-mail/senha. Crie manualmente seu único administrador com senha forte exclusiva. Anote o UID exato e o e-mail. O website não oferece cadastro público; criar outra conta Auth não concede acesso ao grupo.
3. Crie o bucket privado de Cloud Storage. Anote o nome real, sem `gs://`; não deduza o nome apenas do ID do projeto.
4. Obtenha a Web API key da configuração do projeto. Restrições da chave devem permitir Identity Toolkit API. A chave identifica o projeto, não substitui autorização. A senha é enviada pelo servidor ao endpoint oficial de login e não é registrada em log.

Jogadores não precisam de usuário Firebase. Compartilhe cada link pessoal em conversa privada. Revogue ou gere outro link pela administração em caso de exposição.

## Configuração de runtime

| Variável | Valor |
| --- | --- |
| `FUTEIO_FIREBASE_MODE` | `production` |
| `FIREBASE_PROJECT_ID` | ID real sem prefixo `demo-` |
| `FIREBASE_STORAGE_BUCKET` | Nome real do bucket |
| `FIREBASE_ADMIN_UID` | UID autorizado do Auth |
| `ADMIN_EMAIL` | E-mail correspondente ao UID |
| `FIREBASE_WEB_API_KEY` | Chave do projeto para Auth REST |
| `APP_ORIGIN` | Origem HTTPS exata, sem barra final ou caminho |
| `AUTH_SECRET` | Segredo aleatório novo, mínimo de 32 caracteres |

Gere um segredo com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Guarde-o no Secret Manager/ambiente ignorado, nunca no Git ou chat. Não use `NEXT_PUBLIC_` nessas configurações. Remova as três variáveis de emulador em produção. Não há fallback para dados locais ou outro projeto.

Remova também `STORAGE_EMULATOR_HOST` caso esteja definido; é um alias aceito pelo SDK de Storage. Em desenvolvimento ele deve corresponder exatamente ao host local configurado. Produção recusa esse alias.

O Admin SDK usa Application Default Credentials. No App Hosting, use a identidade do serviço, sem baixar JSON de chave. Em outro servidor, configure a credencial fora do repositório. Conceda permissões mínimas de leitura/escrita Firestore, consulta/verificação de usuários Auth e leitura/criação/exclusão de objetos no bucket. Não torne o bucket público para resolver erros de IAM.

Confirme também que o bucket não tem concessões `allUsers` ou `allAuthenticatedUsers`. Rules privadas não compensam permissões públicas concedidas fora delas. Essa configuração de IAM não é simulada pelos testes locais.

## Rules e TTL

Antes de disponibilizar o website, publique explicitamente no projeto escolhido:

```sh
pnpm exec firebase deploy --project SEU_PROJECT_ID --only firestore:rules,firestore:indexes,storage
```

Essa é uma ação futura, não executada por esta entrega. O alias versionado aponta apenas para `demo-futeio`. As Rules negam leitura/escrita direta, inclusive de contas Firebase Auth. O servidor usa IAM e verifica grupo, perfil e função. Não substitua Rules por acesso público ou apenas `request.auth != null`: membros com links não são contas Auth.

Os índices incluem TTL para `sessions.expiresAt` e `rateLimits.expiresAt`. Confirme no Console que as políticas ficaram ativas. TTL é assíncrono, pode ter cobrança e não define a validade da sessão: o servidor confere expiração a cada requisição. Os emuladores não validam o agendador TTL real.

## App Hosting

Esta aplicação é Next.js dinâmico; não é exportação estática. Use App Hosting, sem depender da integração experimental de frameworks do Firebase Hosting.

1. Conecte o repositório, escolha `codex/website-firebase`, diretório da aplicação **`web`**, Node **24** e pnpm **11.25.0**. A raiz mantém a identificação de workspace Turborepo, conforme a integração documentada.
2. Substitua os placeholders em `web/apphosting.yaml`. Crie os segredos referenciados: `futeio-admin-uid`, `futeio-admin-email`, `futeio-auth-api-key`, `futeio-auth-secret`; conceda acesso à identidade de runtime. Essas variáveis são somente de runtime, sem credenciais reais no build.
3. Mantenha inicialmente mínimo zero e máximo uma instância. A primeira requisição pode esperar inicialização. Escolha região compatível com Firestore/Storage quando possível; ajuste memória se houver necessidade medida.
4. Faça um rollout de validação antes dos convites: login, cadastro/link de um participante sintético, notas, foto privada, sorteio e revogação. Confira acesso anônimo e conta Auth não autorizada.

Build local e emuladores não comprovam IAM, restrições de chave, domínio, buildpack com as versões exatas ou deploy real. Esses pontos permanecem para o primeiro rollout.

App Hosting e Storage exigem Blaze. Configure alertas e acompanhe Firestore, Storage, Cloud Run, builds e logs. Alertas não interrompem gastos; máximo de uma instância não é teto de cobrança. Não há promessa de custo zero com vinte usuários. Nenhum recurso foi provisionado nesta entrega.

## Dados e operação

Há um grupo fixo no piloto. Até 500 perfis podem ser listados; cada sorteio escolhe vinte. O histórico lista cinquenta sorteios recentes. Backup/exportação de Firestore e fotos deve ser definido antes de usar dados reais.

O PostgreSQL anterior não é importado. Sessões e links antigos não funcionam nesta arquitetura; não apague o banco antigo durante a transição. Se precisar transportar registros, planeje uma importação separada e validada antes dos convites.

Uma falha ao remover foto antiga pode deixar objeto privado órfão. Para limpar: compare `players.photoPath` com os objetos, aguarde uma janela sem uploads e remova somente objetos sem referência confirmada. Não há limpeza automática que possa apagar uploads em andamento.

Desative/revogue o administrador no Auth em caso de comprometimento e remova suas sessões no Console. Trocar o UID autorizado também exige atualizar variáveis/reiniciar a aplicação. Um segundo administrador exige revisão do modelo atual.

## Fontes oficiais consultadas em 2026-11-17

- [Admin SDK](https://firebase.google.com/docs/admin/setup) e [login Auth REST](https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password).
- [Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure) e [projetos demo](https://firebase.google.com/docs/emulator-suite/connect_firestore).
- [Índices/TTL](https://firebase.google.com/docs/reference/firestore/indexes) e [expiração TTL](https://firebase.google.com/docs/firestore/ttl).
- [Frameworks e ferramentas](https://firebase.google.com/docs/app-hosting/frameworks-tooling), [monorepos](https://firebase.google.com/docs/app-hosting/monorepos) e [configuração App Hosting](https://firebase.google.com/docs/app-hosting/configure).
- [Custos App Hosting](https://firebase.google.com/docs/app-hosting/costs) e [faturamento Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
