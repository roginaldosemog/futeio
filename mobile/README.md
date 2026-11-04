# Fute.io — Mobile

Aplicativo React Native com Expo, Expo Router, TypeScript e TanStack Query. M1 introduziu acesso e consultas; M2/M3 acrescentaram avaliações, perfil/foto, administração e sorteios. Android e iPhone são os alvos; tablets e publicação nas lojas ficam fora desta entrega. A API Nest continua sendo a autoridade de acesso e negócio. Execução nativa em aparelhos ainda precisa ser homologada.

## Implementado

- Entrada do administrador com as credenciais provisionadas no servidor.
- Entrada do jogador: copiar o link enviado pelo administrador e colar no aplicativo. Não pede e-mail ou senha do jogador.
- Sessão opaca e revogável no SecureStore, vinculada ao aparelho, verificada na API ao abrir/retomar o app.
- Lista com busca, atualização por gesto e indicação de avaliação pendente/nota dada.
- Consulta de perfil e avaliações, preservando a projeção anônima da API.
- Avaliação e autoavaliação com nota inteira de 0 a 10; nova contribuição substitui a anterior no servidor.
- Edição de nome e seleção/remoção de foto para o próprio jogador ou administrador, conforme permissão da API.
- Cadastro administrativo com nota inicial obrigatória e vínculo único ao próprio perfil.
- Compartilhamento explícito de links e confirmação para rotação/revogação; segredos são ocultados ao sair da tela ou deixar o app.
- Seleção administrativa de vinte jogadores de linha, quatro times, histórico e consulta dos snapshots do servidor.
- Navegação por Stack, tratamento de teclado, áreas seguras, controles de pelo menos 48 pontos e temas claro/escuro.
- Contratos de API compartilhados por `@futeio/contracts`, sem importar banco ou regras de negócio.

Não há criação pública de administrador nem dados de demonstração automáticos. Não há cálculo de médias ou sorteio implementado no cliente. Os relatórios [M1](../docs/entregas/M1-mobile.md) e [M2/M3](../docs/entregas/M2-M3-mobile.md) separam código implementado, verificações e limites.

## Fotos, retomada e resultados incertos

O app usa o seletor de imagens do sistema, sem câmera/microfone ou pedido de acesso amplo à biblioteca. A foto é decodificada com limites de dimensão e enviada como JPEG. O arquivo novo gerado pelo manipulador é removido; o arquivo original selecionado nunca é apagado. O seletor do sistema pode produzir sua própria cópia no cache privado, inclusive com metadados originais. Isso é diferente da foto recebida pela API, normalizada pelo backend e carregada em memória sem entregar o bearer ao componente Image.

Ao abrir seletor/compartilhamento ou sair do app, uma cobertura oculta a interface. Formulários e consultas ativas permanecem em memória até a validação da mesma sessão, preservando edições; logout, falha de acesso ou troca de identidade removem os dados privados. Não há persistência das consultas. Um 401 retira o conteúdo autenticado antes de aguardar a limpeza do SecureStore.

Escritas não ficam enfileiradas offline e não são repetidas automaticamente. Um cadastro com resposta incerta exige atualizar/conferir a lista. Um sorteio incerto bloqueia nova submissão até sair para conferir o histórico. Sucesso de sorteio bloqueia repetição e permite abrir o resultado. O bloqueio de incerteza é local à tela/sessão montada, sem garantia de idempotência entre reinicializações; confira o histórico após interrupções.

## Retomar no Mac

Instale Git, Node **24.22.1**, pnpm **11.25.0**, Docker Desktop (ou PostgreSQL 18.6 com bancos separados), Xcode com iOS Simulator e CocoaPods. Android Studio/JDK são necessários para compilação e emulador Android. Siga os guias oficiais de [ambiente iOS](https://docs.expo.dev/guides/local-app-development/) e [Android](https://docs.expo.dev/workflow/android-studio-emulator/).

```sh
git clone https://github.com/roginaldosemog/futeio.git
cd futeio
git switch --track origin/codex/mobile-app
pnpm install --frozen-lockfile
cp .env.example .env
cp mobile/.env.example mobile/.env
pnpm services:up
pnpm db:generate
pnpm db:migrate
pnpm db:test:migrate
pnpm admin:configure
```

Se o clone já existir, use `git fetch origin` e `git switch codex/mobile-app`, conferindo alterações locais antes. O helper `admin:configure` recebe e-mail/senha interativamente e grava somente hash no `.env` ignorado. Credenciais e bancos do Windows não são sincronizados pelo Git. Não copie senhas para prompts ou arquivos versionados.

No `.env` da raiz configure `APP_ORIGIN` para a origem web usada pelos links, além dos bancos e credenciais administrativas. No `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=https://SEU-ENDERECO/api/v1
EXPO_PUBLIC_WEB_URL=https://SEU-ENDERECO
```

São endereços públicos, nunca chaves privadas. Reinicie o Metro depois de alterar essas variáveis. `EXPO_PUBLIC_WEB_URL` deve corresponder exatamente à origem usada pela API ao gerar os links. A API pode usar outra origem HTTPS em `EXPO_PUBLIC_API_URL`. O aplicativo rejeita links de outra origem e não navega para o endereço colado.

Para os celulares físicos, use uma API/web acessível por HTTPS. `localhost` no aparelho é o próprio aparelho. O túnel do Metro expõe o bundle, não publica a API; se usar um túnel web, encaminhe também `/api/v1`. Um domínio temporário do Windows não deve ser presumido ativo no Mac. Não há exceção ATS/cleartext global na configuração nativa. HTTP de loopback é aceito pelo cliente somente em desenvolvimento, sujeito às políticas de rede do runtime.

Em terminais separados:

```sh
pnpm dev
pnpm dev:mobile
```

Depois de instalar os novos módulos de foto, recompile o aplicativo nativo. Para compilar e executar a partir do Mac:

```sh
pnpm --filter @futeio/mobile run ios
pnpm --filter @futeio/mobile run android
```

Os comandos geram `mobile/ios` e `mobile/android`, ignorados pelo Git, usando config plugins do Expo. Use simulador/emulador disponível ou selecione um aparelho pelo mecanismo oficial do Expo; execução em iPhone físico requer assinatura Apple. Os identificadores `com.futeio.app` são provisórios, sem registro ou publicação nas lojas. Não foi criado projeto EAS.

O SDK58 está fixado explicitamente. O anúncio de lançamento registra uma transição do Expo Go nas lojas; confirme compatibilidade do Expo Go instalado antes de depender dele. A compilação de desenvolvimento local é o caminho reproduzível para testar plugins e comportamento nativo. [Release SDK58](https://expo.dev/changelog/sdk-58)

## Verificar

```sh
pnpm --filter @futeio/mobile run check:expo
pnpm --filter @futeio/mobile run lint
pnpm --filter @futeio/mobile run typecheck
pnpm --filter @futeio/mobile run test:unit
pnpm --filter @futeio/mobile run build
pnpm contracts:check
```

`build` exporta os bundles JavaScript de Android e iOS. Não compila binários nem prova execução nos sistemas. Lint, tipos e testes usam os scripts do monorepo/CI. A API deve ser compilada antes de gerar/verificar os contratos, conforme README da raiz.

## Homologação nativa e próximos marcos

1. Executar em iOS e Android, usando dados sintéticos: login/link/revogação, autoavaliação, edição/foto, compartilhamento e sorteio de vinte jogadores. Registrar capturas nativas, tema escuro e texto ampliado.
2. Validar retorno de seletor/Share sem perder rascunhos, revogação durante modal, HTTP 401 com armazenamento lento, Back com POST pendente e retorno após resposta incerta. No Android, incluir destruição da Activity enquanto o seletor estiver aberto; resultados órfãos devem ser descartados, sem upload para uma sessão nova.
3. Definir domínio e assinatura para universal/app links, distribuição e publicação. Atualmente o link é colado na entrada; o scheme configurado não implementa esses mecanismos.
4. Coletar feedback da pelada real e medir uso/impacto depois da publicação.

Não alterar as regras de negócio para reproduzi-las no aplicativo. Não registrar tokens, fotos, e-mail ou notas em telemetria. No logout, dados de consultas e credencial local são removidos; se o servidor estiver inacessível, o app informa que não confirmou a revogação remota, e o prazo absoluto da sessão continua valendo.
