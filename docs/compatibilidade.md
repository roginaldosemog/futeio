# Compatibilidade — branch Firebase

Verificação em 2026-11-17. Versões exatas no lockfile; o primeiro rollout real ainda precisa ser validado.

| Componente | Versão | Critério |
| --- | --- | --- |
| Node | 24.22.1, linha 24 | Admin SDK exige Node 22+; App Hosting documenta 22+ |
| pnpm | 11.25.0 | Fixada; App Hosting documenta pnpm |
| Next / React | 16.4.5 / 19.3.1 | Preservadas do website; App Hosting documenta Next 13.5+ |
| TypeScript | 5.9.3 | Strict/noEmit; regras testadas com suporte nativo do Node a TS |
| Firebase Admin | 14.5.1 | Estável consultada no npm; somente servidor |
| Firebase CLI | 15.36.0 | Estável consultada no npm; desenvolvimento/testes |
| Java | 21 | Exigência atual da CLI para emuladores; CI usa Temurin |
| Sharp | 0.35.5 | Versão já usada para reencodificar fotos |
| Turborepo | 2.11.10 | Restrito ao build para integração oficial App Hosting |
| Playwright | 1.64.1 | Chrome instalado, sandbox ativa e conferida em runtime |

Fontes: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup), manifests `firebase-admin` e `firebase-tools` no registry npm, [CLI/emuladores](https://firebase.google.com/docs/emulator-suite/install_and_configure), [App Hosting](https://firebase.google.com/docs/app-hosting/frameworks-tooling) e [monorepos](https://firebase.google.com/docs/app-hosting/monorepos). Suporte documentado não substitui a validação de uma publicação real.

Next foi atualizado de 16.4.4 para 16.4.5 após a auditoria apontar [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h) e [GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8). A correção foi verificada nos avisos oficiais e nos manifests; React e o restante da interface foram preservados.
