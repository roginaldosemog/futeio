# Compatibilidade — branch Firebase

Verificação web em 2026-11-18; reintegração mobile em 2026-11-19. Versões exatas no lockfile; o rollout real deve ser registrado separadamente dos testes locais.

| Componente | Versão | Critério |
| --- | --- | --- |
| Node | 24.22.1 local, linha 24 | Admin SDK exige Node 22+; Vercel configurada para 24.x |
| pnpm | 11.25.0 | Fixada pelo packageManager; workspace/lockfile da raiz |
| Next / React | 16.4.5 / 19.3.1 | Integração Next.js oficial da Vercel |
| TypeScript | 5.9.3 | Strict/noEmit; regras testadas com suporte nativo do Node a TS |
| Firebase Admin | 14.5.1 | Estável consultada no npm; somente servidor |
| Firebase Web SDK | 13.4.0 | Estável verificada no npm em 2026-11-18; somente Auth/App para login Google |
| Firebase CLI | 15.36.0 | Estável consultada no npm; desenvolvimento/testes |
| Java | 21 | Exigência atual da CLI para emuladores; CI usa Temurin |
| Sharp | 0.35.5 | Versão já usada para reencodificar fotos |
| Vercel Blob SDK | 2.9.0 | Estável no npm; Node >=20; API privada somente no servidor |
| Vercel CLI | 66.1.0 | Estável no npm; Node >=20; publicação via pnpm dlx |
| Turborepo | 2.11.10 | Build web e exports mobile; cache inclui variáveis públicas de destino |
| Playwright | 1.64.1 | Chrome instalado, sandbox ativa e conferida em runtime |
| Expo / Router | 58.0.26 / 58.0.32 | Atualizações de manutenção recomendadas por `expo install --check` |
| React Native / React mobile | 0.88.1 / 19.3.0 | Pares recomendados pelo SDK58, independentes do React web |
| TypeScript mobile | 6.0.3 | Configuração Expo strict; web mantém 5.9.3 |
| TanStack Query mobile | 5.105.3 | Dados remotos em memória, sem persistência de consultas |
| SecureStore / WebBrowser | 58.0.3 / 58.1.0 | Credencial do aparelho e retorno pelo navegador do sistema |
| Jest Expo / RNTL | 58.0.15 / 14.1.0 | Testes React Native com preset do SDK |

Fontes: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup), manifests oficiais no registry npm, [CLI/emuladores](https://firebase.google.com/docs/emulator-suite/install_and_configure), [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) e [SDK Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk). Suporte documentado não substitui a validação de uma publicação real.

O SDK Web Firebase fixa um transporte Node Firestore antigo. O override restrito `@firebase/firestore>@grpc/grpc-js: 1.14.6` aplica as correções oficiais [GHSA-m9gg-hp2v-232j](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) e [GHSA-f596-whhp-79r4](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4), sem mudar versões principais. Esse transporte não é importado no login Web (somente App/Auth).

O SDK Blob inclui `@vercel/cli-config` com Zod fixado em versão vulnerável. O override restrito `@vercel/cli-config>zod: 4.6.7` aplica a [correção oficial de limites de coleções](https://github.com/colinhacks/zod/pull/6652) da mesma versão principal. A auditoria de produção deve ser executada novamente a cada atualização do lockfile.

Na publicação real, o runtime Node 24 da Vercel recusou `require(esm)` usado por `jwks-rsa@4.1.0` para carregar `jose@6.2.17`, impedindo carregar Firebase Auth. A incompatibilidade está registrada nos projetos [Firebase Admin](https://github.com/firebase/firebase-admin-node/issues/3181) e [JWKS](https://github.com/auth0/node-jwks-rsa/issues/507). Um patch versionado via pnpm troca somente os dois imports de JOSE por importação dinâmica, mantendo versões, algoritmos e filtros de chaves públicas. O callback Passport continua recebendo erros de importação. O teste `scripts/firebase-module.test.mjs` reproduziu a falha com `--no-experimental-require-module` e verifica carregamento Auth, conversão JWKS RSA, assinatura e callbacks válido/malformado após o patch. Reavaliar/remover o patch quando houver correção upstream compatível, repetindo o teste e a publicação real.

Next foi atualizado de 16.4.4 para 16.4.5 após a auditoria apontar [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h) e [GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8). A correção foi verificada nos avisos oficiais e nos manifests; React e o restante da interface foram preservados.

A reintegração usa a matriz oficial do SDK58, validada por `expo install --check`; o comando sugeriu somente atualizações de manutenção dos módulos Expo e do preset Jest. Plugins de StatusBar e WebBrowser estão explicitados em `app.config.ts`. Referências: [SDK58](https://expo.dev/changelog/sdk-58), [WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/) e [atualização de SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/). Compatibilidade de dependências não comprova execução em aparelho.

A auditoria após restaurar Expo/Jest identificou `glob` e `minimatch` modernos desatualizados. Os overrides limitados a `glob >=9 <14.0.2` e `minimatch >=7 <11.0.1` aplicam as correções oficiais [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) e [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). São mudanças de versão principal das dependências transitivas: preservam as APIs legadas abaixo desses intervalos e exigem repetir testes, export Metro e build web. O [changelog do glob](https://github.com/isaacs/node-glob/blob/main/changelog.md) documenta as mudanças de matching; não representam atualização do SDK Expo.
