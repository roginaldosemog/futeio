# E2 — Acesso administrativo

Data: 03/11/2026. Estado: implementada e verificada localmente. Código: `22742a2`.

## Escopo entregue

O responsável adiou o envio por Resend e autorizou um único administrador provisionado com e-mail e senha. `/entrar` autentica, `/administracao` consulta a sessão e oferece saída. Não há cadastro público ou recuperação automática. Identidade e vínculo ADMIN são criados/reutilizados somente após credenciais válidas.

O adaptador Resend permanece desconectado, com comentário no módulo e sem rotas de solicitação/resgate. Não é necessário configurar chave e nenhum e-mail real foi enviado. A tabela preparatória de links administrativos permanece na migration já aplicada; ela não concede acesso pelo fluxo atual. A retomada do envio terá entrega e validação próprias.

Jogadores, notas, avaliações, sorteio e mobile continuam planejados. Os links pessoais dos jogadores em E3/E4 não foram substituídos por senha. Referências: [ADR 0002](../adr/0002-identidade-e-acesso-por-links.md), [escopo](../pitroom/specs/2026-11-02-futeio-mvp-design.md) e [plano](../pitroom/plans/2026-11-02-primeiras-entregas.md).

## Decisões implementadas

- Provisionamento por entrada oculta ou stdin, sem senha em argumentos ou arquivos versionados. O helper exige `.env` ignorado e escreve hash entre aspas. A execução por stdin foi verificada localmente; o prompt interativo foi revisado, sem teste automatizado de terminal.
- scrypt assíncrono nativo: N=32768, r=8, p=3, salt aleatório de 16 bytes e chave de 64 bytes. Perfil fixo; sem parâmetros escolhidos pelo cliente. E-mail desconhecido também executa a verificação de senha e recebe o mesmo erro genérico.
- Sessão opaca com hash no PostgreSQL, cookie HttpOnly/SameSite=Lax, Secure em HTTPS e expiração absoluta de oito horas. Login rotaciona a sessão em transação; logout a revoga. A versão ligada ao e-mail e hash configurados invalida sessões antigas após reprovisionamento e reinício da API.
- HMAC CSRF ligado à sessão, pré-sessão de 30 minutos e origem exata nas mutações. O cliente obtém novo CSRF antes de login e logout. O formulário declara POST também no HTML, impedindo fallback GET com senha na URL antes da hidratação/sem JavaScript.
- Contadores atômicos no PostgreSQL: dez logins por peer, cinco por e-mail e 60 consultas CSRF por peer, em janelas de 15 minutos. Cabeçalhos de encaminhamento não alteram a identidade do peer; clientes do proxy Next compartilham o orçamento nesta E2.
- OpenAPI/Swagger, geração determinística de tipos e verificação de divergências. Nenhum cliente importa Prisma. Variáveis administrativas são repassadas pelo Turbo em modo estrito sem se tornarem variáveis públicas do Next.

## Verificações executadas

Windows, Node 24.22.1, pnpm 11.25.0 e PostgreSQL 18.6 portátil, com clusters de aplicação e testes separados. Migrations foram aplicadas em ambos. Os testes automatizados usam credenciais sintéticas; o teste pontual da conta local autorizada não registrou suas credenciais no repositório.

Todos os comandos abaixo concluíram com exit code 0:

| Verificação | Comando | Resultado observado |
| --- | --- | --- |
| Lockfile e compatibilidade de peers | `pnpm install --frozen-lockfile --strict-peer-dependencies` | Instalação consistente |
| Cliente e migrations | `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:test:migrate` | Cliente gerado; três migrations aplicadas/atualizadas |
| Cadeia completa | `pnpm verify` | Lint, tipos, unitários, integração e builds passaram |
| Unitários, incluídos em verify | `pnpm test:unit` | **77**: nove de tooling, 44 da API e 24 da web |
| Integração PostgreSQL, incluída em verify | `pnpm test:integration` | **19**: 15 de acesso e quatro de saúde |
| Contratos | `pnpm contracts:generate`, `pnpm contracts:check` | Schema e tipos correspondentes |
| Navegador | `pnpm test:e2e` | API/web compiladas, **três** jornadas Chromium passaram e processos encerrados |
| Smoke final | `pnpm test:smoke` | Web/API de produção, consulta real ao banco e encaminhamento na mesma origem |
| Peers | `pnpm peers check` | Nenhum problema encontrado |
| Auditoria de produção | `pnpm audit --prod` | Nenhuma vulnerabilidade conhecida retornada na consulta |

O E2E usa portas 3100/3101, relógio de teste e banco validado pelo guard. Conferiu-se que a identidade sintética foi removida e as portas foram liberadas. Após E2E, `pnpm verify` recompilou a web com a origem normal da API (3001); o smoke final utilizou 3000/3001. O smoke com portas alternativas 3100/3101 também passou.

A integração cobre erros genéricos, ausência de acesso anônimo, CSRF/origem, DTOs, rotação e disputa concorrente, expiração, logout, rejeição de papel PLAYER, mudança de credencial, atributo Secure, limite por e-mail/peer, reinício de janela e rotas de e-mail indisponíveis. A troca de configuração é controlada no teste; não se trata de um teste completo de recuperação operacional com reinício de processos.

Os três cenários de navegador verificam proteção da administração e teclado em viewport móvel; senha incorreta/e-mail desconhecido com mensagem equivalente; login, persistência após reload, logout sem CSRF rejeitado e revogação na saída. Não demonstram as jornadas futuras de jogadores.

Também foram verificados login, consulta da sessão e logout da conta administrativa local autorizada, sem envio de mensagens. A inspeção visual conferiu 1440×1000, 390×844 e 320×568: sem rolagem horizontal, campos/botão com 52 px, foco por teclado e link de pular conteúdo. Capturas locais não são resultados de produção nem estão versionadas.

## Desenvolvimento e revisão

Os testes de password demonstraram RED com implementação ausente e GREEN após scrypt. O teste do formulário demonstrou RED sem o atributo POST e GREEN após a correção. Os registros de execução incluem falhas intermediárias corrigidas; não foram somadas às contagens finais.

Uma revisão independente de segurança/qualidade aprovou o fluxo ativo após corrigir o repasse das quatro variáveis no Turbo e o fallback POST do formulário. O dry run do Turbo confirmou as declarações de passthrough em modo estrito. A inspeção do conteúdo preparado para commit confirmou ausência de `.env`, senha fornecida, hash local, segredo de assinatura e chave do provedor.

## Limites e próximos passos

Docker Engine não está disponível neste computador: os testes usaram PostgreSQL real portátil. A validação Compose da E1 permanece histórica; não houve execução de contêineres em E2. A CI está configurada com testes de navegador e contratos, mas não foi executada no GitHub. Não houve push, merge ou publicação nesta entrega.

O orçamento compartilhado do proxy deve ser revisto com a topologia de produção. O atributo Secure foi verificado, mas o piloto hospedado com HTTPS, operação, backup/restauração e métricas pertence à E8. Não há métricas de adoção, desempenho ou impacto coletadas. E3 continua dependente de autorização.

## Complemento — Chrome instalado e sandbox no E2E

Data: 03/11/2026. A configuração Chromium passou a selecionar `channel: 'chrome'` e `launchOptions.chromiumSandbox: true`. Mantidos projeto, device, worker único, retries, traces e o orquestrador com servidores isolados em 3100/3101. Não foram encontradas outras inicializações de Chromium no código do projeto.

A fixture de navegador consulta `chrome://version` num contexto temporário, aguarda os campos de executável e linha de comando e fecha esse contexto antes das jornadas. Rejeita executável fora da instalação Chrome, override de executablePath e flags que desativam a sandbox, inclusive com valor ou entre aspas. Não usa o caminho do Chromium empacotado retornado por `browserType.executablePath()` como prova do processo real.

Evidência registrada no E2E final:

```json
{"executable":"C:/Program Files/Google/Chrome/Application/chrome.exe","version":"156.0.8078.80","channel":"chrome","chromiumSandbox":true,"sandboxDisablingFlags":[]}
```

- `pnpm test:e2e`: três jornadas passaram com Chrome instalado.
- Nova execução com `CI=true` no Windows, após a revisão final da fixture: três jornadas passaram, exit 0. A linha de comando efetiva não contém `--no-sandbox` nem as demais flags proibidas.
- `pnpm --filter @futeio/web run lint` e `pnpm --filter @futeio/web run typecheck`: exit 0.
- O scanner foi conferido com flags simples, com valor e entre aspas, e com argumentos semelhantes permitidos; não foi necessário iniciar um navegador sem sandbox para essa checagem.
- O CLI instalado aceitou `playwright install --with-deps --no-remove --dry-run chrome`. Nenhuma instalação local foi executada: o Chrome já estava presente. Playwright e caches compartilhados foram preservados.

A primeira tentativa de diagnóstico por `Browser.getBrowserCommandLine` falhou antes das jornadas: a API exige `--enable-automation`, ausente nos argumentos padrão desta versão. A consulta pela página interna solucionou a coleta da evidência sem alterar os demais argumentos de lançamento.

O workflow Ubuntu 24.04 agora usa o mecanismo oficial `pnpm --filter @futeio/web exec playwright install --with-deps --no-remove chrome`. Instalação e execução são etapas distintas: o browser roda como usuário do runner, com a sandbox solicitada. Não há fallback para Chromium empacotado nem desativação de sandbox. A revisão independente confirmou a configuração e a fixture finais.

Limitação: não houve execução do GitHub Actions/Linux nesta correção. O teste com CI=true no Windows não comprova AppArmor ou as demais camadas de isolamento do Linux. Configuração e ausência das flags demonstram o lançamento verificado; não constituem auditoria completa da sandbox do sistema operacional.

Fontes primárias: [canais e instalação Playwright](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge), [chromiumSandbox](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-chromium-sandbox), [implementação da página de versão do Chromium](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/webui/version/version_ui.cc) e [restrições de user namespaces/AppArmor](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md).
