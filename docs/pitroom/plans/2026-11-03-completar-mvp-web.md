# MVP web completo — Implementation Plan

> **For agentic workers:** Use pitroom-driven-development task-by-task. Pitroom não está instalado neste ambiente; execução com agentes nativos, revisão independente e verificação na árvore integrada. Somente o responsável principal faz commits.

**Goal:** Concluir as funcionalidades web E4–E7 e verificar o produto integrado, conforme autorização do usuário para terminar o site.

**Architecture:** Preservar Next.js, NestJS modular e PostgreSQL. Contratos OpenAPI gerados; autorização e regras exclusivamente na API. Sem e-mail, mobile, filas ou infraestrutura adicional.

**Tech Stack:** Stack e versões existentes; sharp estável verificado para decodificar, limitar e normalizar fotos.

**Spec:** [Escopo aprovado](../specs/2026-11-02-futeio-mvp-design.md), ADRs 0002–0005 e E4 no plano original.

## Global Constraints

- Grupo fechado, jogadores sem e-mail, administrador provisionado manualmente.
- Uma contribuição vigente inteira de 0 a 10 por identidade e alvo; autoavaliação permitida.
- Um voto usa a nota inicial; 2–4 usam média; 5–10 descartam uma ocorrência por extremo; 11+ descartam duas por extremo.
- Jogador identifica apenas a própria avaliação; administrador identifica todos e só altera sua própria contribuição.
- Exatamente vinte jogadores de linha, quatro times de cinco, somente notas. Goleiros organizados fora do sistema.
- Sessões e fotos privadas; segredos fora do Git e dos logs.
- Commits exclusivamente Igor Gomes <roginaldosemog@gmail.com>, sem coautoria.
- Não contratar hospedagem nem afirmar publicação/uso real. Preparar operação e registrar pendências concretas de E8.

## Dependências e decisões de execução

| Tarefas | Fronteira compartilhada | Decisão |
| --- | --- | --- |
| E4/E5 e E6/E7 | Schema Prisma | E4/E5 acrescenta campos e libera o arquivo; E7 acrescenta Draw; principal gera o cliente e aplica migrations sequencialmente. |
| E4/E5 e E6 | Guard e perfil | MemberGuard exportado por AccessModule; perfil em GET players/:id, avaliações em GET players/:id/evaluations. |
| API e web | Contrato REST | DTOs comunicados entre responsáveis; principal gera OpenAPI e tipos após compilar API. |
| Todos e testes | Banco/builds | Bancos distintos de aplicação/teste; uma instalação e um build por vez; sem drop/truncate ou exclusão de dados reais. |

Ruling: fotos pequenas serão armazenadas em bytea no PostgreSQL do piloto, entregues por endpoint autenticado. Entrada JPEG/PNG até 2 MiB, decodificada e normalizada para JPEG até 512 px, sem metadados. Evita contratar armazenamento para um único grupo e mantém backup e privacidade no mesmo limite transacional. Custo se o grupo crescer: migrar os bytes para armazenamento privado de objetos; esse limite é documentado.

Ruling: o pedido atual autoriza E4–E7 e a preparação operacional de E8. Hospedagem paga, domínio e uso real continuam dependentes de informações externas; não são simulados. Envio de e-mail e mobile seguem adiados por decisões explícitas anteriores.

Ruling: manter 60 solicitações CSRF por 15 minutos por sessão autenticada, preservando o limite por peer para contextos anônimos e os limites de login/resgate. O proxy Next faz membros legítimos compartilharem um peer; limitar todos juntos impediria as avaliações do grupo. Custo se houver abuso: rever limites com dados reais sem remover a proteção de origem/CSRF ou enfraquecer o login.

Ruling após a integração: ampliar somente a abertura de conexão PostgreSQL de 1 para 5 segundos. A suíte serial encontrou timeout na primeira transação e numa segunda conexão do login concorrente; diagnóstico isolado encontrou handshakes de 94–435 ms e consultas de 1–4 ms, distinguindo conexão fria de consulta lenta. Manter `query_timeout: 1000`, máximo de cinco conexões, nenhuma repetição automática e os testes de indisponibilidade. Custo: um destino silencioso pode demorar até cinco segundos para falhar ao abrir conexão; documentar e verificar readiness.

### Task 1: E4/E5 — Acesso revogável e manutenção de perfil

**Worker:** capable

**Files:** módulos access e players/profile na API, migration de sessão/credencial/foto, testes reais de acesso/perfil; páginas de resgate e perfil na web.

**Interfaces:** resgate POST auth/player/redeem; rotação POST players/:id/access-link/rotate e revogação DELETE players/:id/access-link; leitura GET players/:id, alteração POST players/:id/profile, foto POST/DELETE players/:id/photo e GET privado.

- [x] Escrever e executar testes de token válido/inválido, sessão de sete dias, papel restrito, logout, rotação/revogação e concorrência.
- [x] Implementar sessão vinculada à credencial e verificar validade a cada requisição; remover segredo do endereço antes do resgate.
- [x] Implementar manutenção pelo próprio jogador ou administrador; negar alteração de terceiros; validar bytes e entrega privada da foto.
- [x] Verificar contratos e jornada integrada; revisar e fazer commit.

### Task 2: E6/E7 — Avaliação privada e sorteio reproduzível

**Worker:** capable

**Files:** módulos evaluations e draws, projeções de lista, migration Draw, testes de cálculo, sorteio e integração.

**Interfaces:** GET/POST players/:id/evaluations; GET/POST draws e GET draws/:id; lista mostra a própria nota ou pendência e nota consolidada.

- [x] Testar exemplos numéricos, limites, empates, reavaliação, unicidade concorrente e projeções por papel.
- [x] Implementar cálculo puro sem arredondamento de negócio, upsert da própria contribuição e anonimização sem pseudônimos estáveis.
- [x] Testar seleção inválida, quatro times de cinco, reprodução independente da ordem, notas iguais/extremas e snapshot imutável.
- [x] Implementar busca determinística limitada por tentativas/trocas e snapshot de leitura consistente; medir cenários sintéticos.
- [x] Revisar e fazer commit com evidências.

### Task 3: Jornadas web completas

**Worker:** capable

**Files:** features access, players, avaliações e sorteios na web, rotas, navegação, testes RTL e navegador.

**Interfaces:** somente contratos REST gerados, estado privado por sessão; sem importação do backend.

- [x] Construir lista pesquisável, perfil, nome/foto, nota própria/pendente, tabela privada e manutenção do link pelo administrador.
- [x] Construir seleção de vinte, resultado com times/totais/médias, explicação da heurística e histórico.
- [x] Manter rótulos, teclado, foco e estados de carregamento/vazio/erro; sem repetição automática de mutações incertas.
- [x] Inspecionar desktop e celular; testar fluxos reais entre papéis e revisar.

### Task 4: Verificação integrada e operação

**Worker:** capable

**Files:** suporte E2E isolado, documentação, CI se necessário e relatório de evidências.

- [x] Executar migrations nos bancos distintos, instalação congelada, lint, tipos, unidades, integração real, builds e contratos.
- [x] Executar jornadas Chrome instalado com sandbox solicitada e ausência das flags de desativação; preservar isolamento 3100/3101.
- [x] Executar smoke, peers e auditoria; revisão independente da branch e correção de achados.
- [x] Registrar somente resultados executados; manter site local acessível com build normal e instruções de operação.
- [x] Fazer commits com autoria exclusiva do usuário, registrar limites de publicação/uso real e manter o workflow Ubuntu para a validação remota do commit publicado.

## Evidências e validação remota

Conclusão funcional e verificações locais registradas em [E4–E7](../../entregas/E4-E7-mvp-web.md): 148 unitários, 70 integrações PostgreSQL e oito jornadas Chrome. Os commits de implementação são 237ff5b (API) e 070b6a5 (web), com autoria exclusiva do usuário.

A aprovação remota obrigatória é confirmada pelo estado do workflow Ubuntu no commit publicado, disponível nas [execuções da branch](https://github.com/roginaldosemog/futeio/actions?query=branch%3Acodex%2Fcomplete-web-mvp). Não se infere aprovação apenas pela configuração do workflow. Publicação e adoção real continuam separadas desta conclusão funcional.
