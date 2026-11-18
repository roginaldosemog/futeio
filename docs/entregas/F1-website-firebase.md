# F1 — Website preparado para Firebase

Conclusão da validação local: 2026-11-18. Branch: `codex/website-firebase`, origem `codex/mobile-app` em `6c54d8e`.

## Implementado

Website Next.js com as mesmas telas, REST no próprio servidor e Firebase Admin SDK. Auth administrativo por UID/e-mail configurados, sessões opacas HttpOnly, links pessoais revogáveis, perfis/fotos privados no Storage, avaliações vigentes transacionais e sorteios imutáveis no Firestore. Sem Expo, NestJS, Prisma ou PostgreSQL nesta branch. Documentação anterior preservada em `docs/history`.

Inclui emuladores sem projeto real, regras de cliente deny-all, configuração explícita sem fallback entre local/produção, índices TTL, preparação App Hosting e CI Ubuntu com Java 21/Chrome. Código de e-mail não faz parte desta alternativa. Nenhum projeto, banco, bucket ou faturamento real foi configurado.

## Verificação

- Lint: passou, sem avisos.
- Build de produção Next 16.4.5: passou, sem credencial Firebase.
- Testes de scripts: 7 passaram. Regras puras: 2 passaram. Interface: 63 passaram em 14 suítes.
- Integração nos emuladores oficiais Auth/Firestore/Storage: 15 passaram.
- E2E: 8 jornadas passaram no Chrome instalado 157.0.8103.79, sandbox ativa, nenhum argumento desativando sandbox. Executável: C:/Program Files/Google/Chrome/Application/chrome.exe.
- Tipos: passou, incluindo o build isolado E2E.
- CI Ubuntu: workflow versionado executa estes checks a cada push; consulte o resultado do commit na aba Actions. Esta seção registra a execução local em Windows.
- Contratos OpenAPI/tipos gerados: consistência verificada.
- Auditoria de produção: 0 alertas após atualização Next 16.4.4 → 16.4.5.

Integração cobre: configuração incompleta/mistura de ambientes, senha inválida, UID não autorizado, conta desativada, login concorrente, erro temporário no Auth, CSRF/Origin, expiração, quotas, cadastro/nota inicial, permissão de edição, atualização de voto, autoavaliação, privacidade dos autores, votos simultâneos, limiares de cinco/onze, rotação/revogação e corrida com resgate, normalização/foto privada, confirmação de upload perdida, seleção de vinte/snapshot imutável e bloqueio de acesso REST direto ao Firestore/Storage.

Uma revisão independente identificou a necessidade de consumir a sessão anterior atomicamente e de não apagar uma foto cujo commit possa ter sido confirmado. Ambos foram corrigidos e têm regressões executadas nos emuladores.

## Limitações e pendências reais

- Conectar projeto, configurar IAM/segredos/UID, publicar Rules/TTL, habilitar Blaze conscientemente e fazer o primeiro rollout real. Emuladores não comprovam IAM, faturamento, TTL agendado ou buildpack real.
- Não há migração automática dos dados PostgreSQL nem métricas de uso/impacto ou custo real.
- Fotos órfãs privadas podem exigir limpeza após falha de compensação; procedimento no guia operacional.
- Auditoria completa das ferramentas: 4 alertas moderados (`uuid`, `@opentelemetry/core`, `glob`, `minimatch`) e 1 alto (`picomatch`), fora da árvore de produção conforme `pnpm audit --prod`. Envolvem Firebase CLI e ferramentas de lint/teste. Não foram aplicados overrides de versões maiores incompatíveis. Picomatch não tinha versão corrigida indicada no resultado da auditoria. Os padrões de arquivos dessas ferramentas são definidos pelo repositório, não por entrada dos jogadores. Acompanhar as atualizações dos mantenedores.
- O SDK pode emitir `MetadataLookupWarning` na primeira conexão local sem credenciais Google; os testes completos ainda passam usando somente o projeto demo e os três hosts locais.

Comandos e conexão futura: `README.md` e `docs/firebase.md`.
