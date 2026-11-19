# Fute.io — Mobile

React Native, Expo Router, TypeScript e TanStack Query para Android e iPhone. Este aplicativo usa a API do website e os mesmos dados Firebase/Blob. Não usa a API NestJS arquivada nem acessa Firestore diretamente. O contrato OpenAPI compartilhado está em `@futeio/contracts`.

## Executar

Na raiz, use Node 24.22.1 e pnpm 11.25.0:

```sh
git fetch origin
git switch codex/mobile-firebase-api
pnpm install --frozen-lockfile
cp mobile/.env.example mobile/.env
pnpm dev:mobile
```

No PowerShell, substitua `cp` por `Copy-Item` se necessário. O exemplo já aponta para a publicação atual:

```dotenv
EXPO_PUBLIC_API_URL=https://fute-io.vercel.app/api/v1
EXPO_PUBLIC_WEB_URL=https://fute-io.vercel.app
```

Esses endereços são públicos e entram no bundle. Nunca adicione senhas, chaves privadas ou credenciais Firebase Admin. Reinicie o Metro após alterar o arquivo. Com esses endereços, cadastros, notas, fotos e sorteios afetam o grupo real; use os emuladores para testes que modifiquem dados sintéticos.

Não precisa iniciar o servidor local para usar a publicação. Para desenvolvimento totalmente local, siga o README da raiz e use uma origem HTTPS acessível ao celular para o web e `/api/v1`. `localhost` no celular é o próprio celular. O túnel do Metro transporta o aplicativo, não a API. Não publique as portas dos emuladores Firebase. HTTP de loopback é aceito apenas em desenvolvimento e sujeito às restrições do runtime nativo.

## Acesso

- Administrador: mesma conta Firebase, por e-mail/senha ou Google. A autorização continua limitada ao UID/e-mail do servidor.
- Jogador: cole o mesmo link pessoal enviado pelo administrador. Não precisa de conta Firebase ou e-mail.
- Google abre o navegador do sistema, exige confirmação e retorna um código único protegido por PKCE. O app só aceita seu callback fixo e o state gerado naquela tentativa. Senha e verifier não são salvos.
- A sessão opaca fica no SecureStore, vinculada à API configurada. Troca de ambiente remove a credencial anterior. Cookies do navegador e Bearer do app são separados. Consulte a [ADR 0012](../docs/adr/0012-mobile-na-api-firebase.md).

**Google exige uma versão instalada do Fute.io**, com o scheme `futeio`. Expo Go pode testar e-mail/senha e links se sua versão suportar o SDK58. O botão informa a limitação em Expo Go. Não há publicação nas lojas, EAS ou conta pública de administrador nesta entrega.

## Compilar no Mac ou Android

Instale Xcode/CocoaPods para iOS; Android Studio, SDK Android e JDK compatível com o Expo para Android. Use os [guias oficiais de compilação local](https://docs.expo.dev/guides/local-app-development/) e [emulador Android](https://docs.expo.dev/workflow/android-studio-emulator/).

```sh
pnpm mobile:ios
pnpm mobile:android
```

Esses comandos geram `mobile/ios` e `mobile/android`, ignorados pelo Git, com os plugins do Expo. Para aparelho físico, passe `--device` ao comando Expo (`pnpm --filter @futeio/mobile exec expo run:ios --device` ou equivalente Android). iOS físico exige assinatura Apple. Identificadores atuais: `com.futeio.app`. Alterar scheme/plugins requer recompilação.

## Funcionalidades e privacidade

Lista com busca e atualização por gesto, indicação de avaliação pendente/nota dada, perfis, avaliação e autoavaliação inteiras de 0 a 10, edição de nome/foto conforme permissão, cadastro administrativo com nota inicial, vínculo ao próprio perfil, compartilhamento/rotação/revogação de links, seleção de vinte jogadores e consulta de sorteios gravados. O cliente não calcula médias nem distribui times. Goleiros continuam fora da seleção de vinte jogadores de linha.

Fotos são selecionadas pelo seletor do sistema, sem câmera/microfone ou acesso amplo à biblioteca. A cópia JPEG gerada pelo manipulador é apagada após uso; o original escolhido não é removido. O seletor pode manter cópias privadas de cache. A API reencodifica a foto e a entrega como bytes autenticados, sem passar Bearer ao componente Image ou URLs Blob ao cliente.

Ao deixar o app ou abrir um seletor/compartilhamento, uma cobertura oculta a interface. Formulários permanecem em memória até validar a sessão no retorno. Logout/401/troca de identidade limpam consultas e credencial; não há persistência do cache ou fila offline. Escritas não são repetidas automaticamente. Após resposta incerta de cadastro/sorteio, confira a lista/histórico antes de repetir. O bloqueio local não garante idempotência entre reinicializações.

## Verificar e homologar

```sh
pnpm mobile:check
pnpm test:mobile
pnpm typecheck
pnpm lint
pnpm --filter @futeio/mobile build
pnpm contracts:check
```

`build` exporta JavaScript para Android/iOS; não compila binários nem prova execução em aparelhos. Integração e E2E do servidor usam somente o projeto Firebase de demonstração isolado, incluindo a troca PKCE e o acesso aos mesmos dados pelos dois transportes.

Homologação em aparelhos ainda necessária: Google/cancelamento/retorno, senha/link/revogação, seletor de foto e Share com retomada, atividade Android recriada, texto ampliado, leitor de tela, claro/escuro e sorteio de vinte jogadores. Não registre tokens, fotos, e-mail ou notas em telemetria. Evidências desta adaptação ficam na [entrega M4](../docs/entregas/M4-mobile-firebase.md).
