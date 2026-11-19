# M4 — Mobile na API do website

Data: 2026-11-19. Branch: `codex/mobile-firebase-api`, a partir de `main` em `3fd8942`. Não implica merge na principal ou publicação em lojas.

## Implementado

- Aplicativo Expo restaurado do tag `archive/2026-11-19/codex/mobile-app`, conectado à API Next.js/Firebase atual. Não há backend NestJS ou banco separado nesta entrega.
- Tipos REST gerados uma vez em `@futeio/contracts` para web/mobile. Regras, projeções de privacidade, fotos e sorteios permanecem nos serviços do servidor.
- Administrador por e-mail/senha e Google, limitado à mesma conta configurada. Google usa navegador, consentimento explícito, state e código único protegido por PKCE.
- Jogadores usam os mesmos links pessoais. Sessões nativas opacas no SecureStore, vinculadas à API, sem cookies. Sessões web existentes permanecem válidas, separadas do transporte Bearer.
- Revogação/expiração, troca de ambiente, logout e respostas tardias cobertos; credenciais da API antiga são descartadas. Limpeza diária inclui grants expirados, sem TTL pago/Blaze.
- CI incorpora testes mobile, matriz Expo e exportações Android/iOS, mantendo emuladores isolados e Chrome com sandbox.

Decisão e limites: [ADR 0012](../adr/0012-mobile-na-api-firebase.md). Execução: [mobile/README.md](../../mobile/README.md).

## Verificado localmente

Windows, Node 24.22.1/pnpm 11.25.0:

| Verificação | Resultado |
| --- | --- |
| Lint e TypeScript web/mobile | Sem erros |
| Testes de scripts e regras puras | 10 aprovados |
| Testes de interface web | 77 aprovados |
| Testes mobile | 147 aprovados, 12 suítes |
| Integração Firebase | 34 aprovados, somente projeto de demonstração isolado |
| E2E | 14 jornadas aprovadas, incluindo transporte nativo e consentimento Google/senha |
| Build Next.js e exports Android/iOS | Concluídos |
| Matriz Expo e pares de dependências | Compatíveis |
| Auditoria de dependências de produção | Sem vulnerabilidades conhecidas no momento da verificação |
| Histórico Git | 32 commits anteriores examinados pelo Gitleaks, sem achados |

Chrome realmente executado: `C:/Program Files/Google/Chrome/Application/chrome.exe`, versão `157.0.8103.79`, `channel: chrome`, `chromiumSandbox: true`, sem flags que desativam a sandbox. Servidores E2E mantiveram build `.next-validation`, porta 3100 e projeto `demo-futeio-test` separados do desenvolvimento/produção.

As jornadas conferiram os mesmos cadastros, avaliações e sorteios via Cookie/Bearer, fotos privadas, ações administrativas negadas a jogadores, rotação de link e logout. O consentimento foi inspecionado em viewport de 390 pixels; a captura é de navegador, não de aparelho nativo. A revisão independente do código não encontrou achados materiais; isso não garante ausência de falhas.

Os overrides de dependências transitivas e a matriz de versões estão em [compatibilidade](../compatibilidade.md). A instalação com lockfile congelado também foi verificada.

## CI e publicação

A evidência da execução Ubuntu e da publicação compatível será acrescentada após concluir a validação remota. Até esse registro, resultados locais não devem ser apresentados como execução em CI ou implantação desta branch.

## Limitações

Não há SDK Android/emulador neste Windows nem Xcode/iOS disponível. As exportações comprovam empacotamento JavaScript, não compilação de binários ou execução em aparelhos. Google exige versão instalada com o scheme `futeio`; Expo Go pode testar senha e links se compatível com SDK58. Homologação nativa, distribuição assinada e publicação nas lojas continuam pendentes. Não foram medidas adoção, satisfação, qualidade do equilíbrio dos times ou impacto real.
