# E4–E7 — MVP web funcional

O pedido para concluir o site autorizou as funcionalidades web restantes. Esta entrega conclui E4–E7 e prepara a operação de E8. Hospedagem externa, uso pela pelada, mobile e envio de e-mail não são apresentados como concluídos.

## Funcionalidades implementadas

- Jogador sem e-mail entra pelo link pessoal, com sessão PLAYER de sete dias. Pode sair e reabrir o link enquanto ativo. Usar o link do próprio administrador não concede papel ADMIN.
- Administrador revoga ou substitui links com confirmação; as sessões derivadas do anterior deixam de autenticar. Resgate e rotação concorrentes bloqueiam o mesmo perfil no PostgreSQL.
- Membros consultam lista, perfil e avaliações do grupo. O próprio jogador e o administrador podem editar nome e foto; terceiros recebem 403 e IDs de outro grupo recebem 404.
- Fotos JPEG/PNG de até 2 MiB são decodificadas, limitadas a 16 megapixels, reduzidas para até 512 px e recodificadas sem metadados. Bytes no PostgreSQL e endpoint privado; detalhes no ADR 0006.
- Uma contribuição vigente por avaliador/alvo, inclusive autoavaliação. A nota inicial do administrador é substituída quando ele reavalia. Lista indica pendência ou nota própria.
- Cálculo `trimmed-mean-v1`: 1 contribuição inicial; 2–4 média; 5–10 corte de uma ocorrência por extremo; 11+ corte de duas. Sem arredondamento de negócio; apresentação com duas casas.
- Tabela somente dentro do perfil. Administrador recebe nomes; jogadores recebem nomes somente na própria autoria. Não há IDs, datas ou pseudônimos estáveis de outros avaliadores.
- Administrador escolhe exatamente vinte jogadores de linha e gera quatro times de cinco. Membros consultam resultado e histórico dos cinquenta mais recentes, sem excluir registros anteriores.
- Snapshot imutável com IDs, nomes, notas usadas, semente, versões, times e indicadores; leitura consistente em RepeatableRead. Trocar nome ou nota depois não altera o registro.
- Páginas de entrada, erro e não encontrado, navegação e saída; controle de estados vazios, carregamento, falha e mutações incertas. Nenhum botão depende de e-mail adiado.

## Verificação local executada

Windows, Node 24.22.1, pnpm 11.25.0, PostgreSQL 18.6 portátil. Bancos distintos de aplicação/teste, seis migrations aplicadas nos dois, sem reset/drop/truncate. Docker local permanece indisponível; a CI usa serviço PostgreSQL em contêiner.

| Verificação | Resultado observado |
| --- | --- |
| Instalação congelada com peers estritos | Exit 0; lockfile preservado |
| Geração Prisma e migrations nos dois bancos | Exit 0 |
| Lint da raiz/API/web | Exit 0; web repetida após correções finais |
| Tipos | Exit 0; builds também verificaram os tipos das rotas e testes web |
| Unidades por camada | 76 API + 63 web + 9 scripts = **148 aprovados** |
| `pnpm test:integration` | **70/70**, cinco suítes em um processo serial, exit 0 |
| `pnpm test:e2e` | **8/8**, exit 0, execução final de 41,3 s no navegador |
| `pnpm build` normal após E2E | Exit 0; encaminhamento local restaurado para 3001 |
| `pnpm test:smoke` após esse build | Exit 0; web/API/PostgreSQL e encaminhamento sob a mesma origem |
| `pnpm contracts:check` | Exit 0; OpenAPI e cliente gerado correspondem |
| `pnpm peers check` | Nenhum problema encontrado |
| `pnpm audit --prod` | Nenhuma vulnerabilidade conhecida retornada naquela consulta |

As contagens agregam as verificações de cada camada; não são métricas de produção nem porcentagem de cobertura. Comandos e caminhos de execução estão no README e no documento de operação.

### Integração e navegador

As integrações usam PostgreSQL real: autorização, DTOs, transações/rollback, concorrência, corte em cinco/onze votos persistidos, substituição sem duplicação, anonimização por papel, foto privada e snapshot preservado após mudanças.

A jornada completa de navegador usa a API e o banco de teste reais. Cadastra vinte participantes sintéticos, entra como jogador em contexto separado, altera nome/foto, se autoavalia, atualiza uma avaliação de colega, verifica resposta anônima e negação de ações administrativas, seleciona os vinte, registra os times, altera nota e confere snapshot inalterado. Revoga acesso, rejeita o segredo anterior, gera outro, recupera na mesma aba, remove foto, sai e reabre o novo link.

O orquestrador mantém API/web em 3101/3100, não reutiliza servidores da aplicação nem a conta administrativa local. A limpeza acompanha somente os IDs de jogadores/sorteios criados pelo próprio servidor de teste; ao terminar, remove essas fixtures e a identidade reservada. A origem e CSRF são exercitados pelos clientes.

Navegador efetivamente observado:

```json
{"executable":"C:/Program Files/Google/Chrome/Application/chrome.exe","version":"156.0.8078.80","channel":"chrome","chromiumSandbox":true,"sandboxDisablingFlags":[]}
```

A fixture lê executável e linha de comando em `chrome://version` antes das jornadas. Não houve `--no-sandbox` nem flags equivalentes detectadas. O Chromium empacotado e os caches compartilhados foram preservados. Isso comprova a política de inicialização verificada, sem alegar auditoria completa dos mecanismos internos do sistema operacional.

### Inspeção visual e regressões corrigidas

Capturas reais da jornada foram inspecionadas em desktop de 1440 px e celular de 390/320 px, incluindo nome com 95 caracteres. As capturas permanecem em `web/test-results/` ignorado pelo Git, com nomes `desktop-draw-result.png`, `mobile-private-evaluations.png`, `small-mobile-private-evaluations.png`, `mobile-draw-result.png` e `small-mobile-draw-result.png`.

Os testes revelaram e permitiram corrigir:

1. Associação do rótulo da avaliação: separar label/select permitiu a consulta exata no Playwright. O nome acessível por papel já era correto; não se atribui uma falha de leitor de tela que não foi medida.
2. Grade implícita dos times: nome longo ampliava o documento para 888 px. Coluna mobile explícita e `min-width: 0` nos times eliminaram o excedente, verificado novamente nas jornadas reais de 390/320 px. O diagnóstico isolado com API simulada serviu apenas para localizar o CSS; não substituiu os testes integrados.
3. Novo link na mesma página: navegação só por fragmento não remonta o componente. Agora cada hashchange captura e remove o segredo; respostas antigas não redirecionam, e os resgates permanecem serializados até a requisição em curso terminar. Dois novos casos RTL falharam antes da correção e passaram depois; o comportamento inicial também foi testado com Strict Mode.
4. Abertura fria de conexão: uma execução serial encontrou esgotamento do limite anterior de 1 s na primeira transação e na segunda conexão de login simultâneo. Diagnóstico isolado observou conexões de 94–435 ms, consultas de 1–4 ms e primeira escrita aninhada em 508 ms. Isso sustenta margem adicional, sem provar isoladamente toda a causa do atraso: abertura passou a 5 s, consulta continuou 1 s e pool máximo cinco, sem retries. A suíte serial seguinte passou 70/70, inclusive login concorrente e banco indisponível.

Suítes com relógios controlados não devem rodar simultaneamente no mesmo banco: a limpeza de sessões expiradas de uma pode interferir na outra. O comando oficial usa runInBand. Falhas intermediárias não foram contadas como resultados aprovados.

O link de pular conteúdo foi verificado fora da tela sem foco e visível após Tab. A captura de página inteira do Chrome com rolagem prévia pode registrar esse elemento fora da área visível; as capturas finais voltam ao topo sem remover foco nem mudar estilos.

## Algoritmo e medições sintéticas

`seeded-greedy-swaps-v1` usa ordem canônica de IDs, PRNG com semente, 64 tentativas e até 32 melhorias por tentativa. Critério: diferença entre somas; desempate: variância. Não há corte por relógio nem promessa de ótimo global.

`node api/scripts/benchmark-draw.cjs` executou três aquecimentos e vinte repetições por cenário. Resultados deste Windows, com outras verificações concorrentes; não são capacidade de produção ou impacto esportivo:

| Cenário sintético | Mediana (ms) | p95 (ms) | Maior tempo (ms) | Diferença de somas observada |
| --- | ---: | ---: | ---: | --- |
| Todas as notas 7 | 12,843 | 155,035 | 172,510 | 0 |
| Quatro notas 10 e dezesseis 0 | 8,929 | 146,016 | 203,143 | 0 |
| Inteiras, índice módulo 11 | 7,907 | 101,093 | 120,639 | 1 |
| Fracionárias, regra explícita no script | 110,437 | 232,406 | 294,870 | Aproximadamente zero, de 3,55e-15 a 7,11e-15 |

Os valores mínimos fracionários refletem precisão numérica; não foram arredondados no algoritmo. Reprodução, seleção inválida, integridade dos times, casos iguais/extremos e solução conhecida estão nos testes puros.

## Revisão, CI e limites

Revisão independente de escopo/qualidade: SPEC PASS e QUALITY APPROVED, com rechecagem dos ajustes de conexão, privacidade, layout e ciclo de vida do resgate. O resultado do navegador foi executado separadamente pelo responsável pela integração.

Implementação: commits `237ff5b` (API) e `070b6a5` (web), com autoria e committer exclusivos de Igor Gomes, sem coautoria. O plano registra as decisões sobre fotos no PostgreSQL, orçamento CSRF por sessão autenticada, abertura de conexão e limite da entrega web.

O workflow versionado executa instalação congelada, migrations, lint, tipos, unidades, integração, builds, contratos, smoke e as oito jornadas em Ubuntu 24.04. Instala Chrome pelo mecanismo oficial, sem fallback para Chromium antigo ou desativação da sandbox. A execução remota e seu resultado por commit são evidência externa: [execuções da branch do MVP no GitHub](https://github.com/roginaldosemog/futeio/actions?query=branch%3Acodex%2Fcomplete-web-mvp). A presença do workflow, por si, não é declarada como aprovação da CI.

Não houve merge, deploy, contratação de serviços, envio de e-mail real ou alteração de dados reais de jogadores pelos testes. O site local e a preparação operacional não equivalem ao piloto publicado. E8 ainda exige hospedagem/domínio/orçamento, HTTPS, backup/restauração e uso do grupo. E9 mobile e Resend continuam adiados. Não há métricas de adoção, tempo economizado ou equilíbrio em campo.
