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

A [CI Ubuntu 24.04 do código `96c82bb`](https://github.com/roginaldosemog/futeio/actions/runs/44465572993) aprovou os dois jobs: histórico e validações web/mobile. Confirmou 77 testes web, 147 mobile, 34 integrações e 14 jornadas, além dos dez testes de scripts/regras, builds, contratos, matriz Expo e auditoria. Navegador executado: `/opt/google/chrome/chrome`, `158.0.8127.36`, sandbox ativa e nenhuma flag que a desative.

A [primeira execução](https://github.com/roginaldosemog/futeio/actions/runs/44464309934) apresentou uma falha pontual no login Google web: permaneceu em `/entrar` por vinte segundos; as outras treze jornadas passaram. A comparação com `main` não demonstrou uma alteração do fluxo Google que explicasse o resultado. Foram acrescentados diagnósticos de fronteira ao E2E, sem credenciais, mudanças de timeout, retries ou relaxamento de autorização. A execução seguinte passou completa; a causa da ocorrência não foi comprovada e não deve ser apresentada como corrigida.

O índice `nativeLoginGrants.expiresAt` foi publicado em `fute-io`. A consulta ao serviço confirmou índice ascendente, TTL desabilitado nas três coleções de limpeza e faturamento desabilitado (Spark).

API publicada em [fute-io.vercel.app](https://fute-io.vercel.app), deployment `dpl_E339hB6yB1CkbyEcwP6Fkqo3M5o5`, estado `READY`, a partir desta branch. A `main` permanece em `3fd8942`, sem merge. A publicação mantém a instalação congelada do workspace e exclui o cliente mobile do upload web; os contratos compartilhados foram resolvidos no build da Vercel.

Uma conferência HTTP autenticada em produção retornou os mesmos vinte jogadores pelos transportes Cookie e Bearer e a mesma projeção de avaliações, ocultando os autores alheios. As quinze verificações do protocolo nativo passaram, incluindo transporte inválido e logout. Jogadores, notas, fotos e sorteios não foram alterados; as sessões de prova foram encerradas. Mais quatorze verificações HTTP cobriram saúde, páginas, acesso anônimo, cookies seguros, rejeição de origem/credenciais inválidas e manutenção autenticada. No Chrome instalado, o login publicado permaneceu utilizável em viewport de 390 pixels, Google ficou disponível, administração anônima redirecionou e não ocorreram erros JavaScript.

O teste em produção exercitou o protocolo HTTP, não um aparelho nativo. Login interativo real do administrador e retorno Google em Android/iPhone não foram repetidos nesta entrega; o proprietário havia confirmado Google e senha na publicação anterior. Testes com contas sintéticas no emulador são evidência distinta.

## Limitações

Não há SDK Android/emulador neste Windows nem Xcode/iOS disponível. As exportações comprovam empacotamento JavaScript, não compilação de binários ou execução em aparelhos. Google exige versão instalada com o scheme `futeio`; Expo Go pode testar senha e links se compatível com SDK58. Homologação nativa, distribuição assinada e publicação nas lojas continuam pendentes. Não foram medidas adoção, satisfação, qualidade do equilíbrio dos times ou impacto real.
