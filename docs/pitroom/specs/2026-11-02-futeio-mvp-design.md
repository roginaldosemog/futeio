# Futeio — escopo e arquitetura inicial do MVP

Data: 02/11/2026, America/Sao_Paulo.

Estado: escopo aprovado pelo responsável do produto. E1–E3 foram implementadas e verificadas localmente e no GitHub/Ubuntu. Em 03/11/2026, o usuário autorizou E3 e a validação da CI. O administrador continua com e-mail e senha provisionados manualmente; envio Resend permanece adiado. E4–E9 continuam planejadas e fora desta autorização. Publicação e uso real exigem evidência própria.

## 1. Problema e público

O piloto será uma pelada real organizada pelo WhatsApp. Sua principal dificuldade é decidir a nota de habilidade dos jogadores para formar times equilibrados. Existem mais de 20 jogadores cadastrados, porque alguns participam de forma rotativa.

O administrador seleciona 20 jogadores de linha para cada sorteio, distribuídos em quatro times de cinco. Os goleiros são organizados fora dessa distribuição. O MVP atende um único grupo fechado. O aplicativo mobile virá depois da validação da web responsiva.

## 2. Escopo funcional aprovado

| ID | Comportamento |
| --- | --- |
| RF-01 | Somente membros do grupo acessam perfis e avaliações. Não há cadastro público de grupos. |
| RF-02 | Exceção E2 aprovada em 03/11/2026: o único administrador acessa com e-mail e senha provisionados manualmente. O link administrativo e o envio Resend originalmente previstos ficam adiados; somente digitar o e-mail não concede acesso. |
| RF-03 | O administrador cadastra jogadores com nome e nota inicial obrigatória, inteira de 0 a 10. E-mail do jogador não é solicitado no MVP. |
| RF-04 | Cada cadastro gera um link pessoal de acesso, para o administrador compartilhar manualmente. O jogador já pode participar dos sorteios antes de acessar. |
| RF-05 | O jogador acessa pelo link, pode editar seu nome e foto e não recebe permissões administrativas. Não cria usuário ou senha. |
| RF-06 | O administrador pode revogar o link e gerar outro. A revogação também invalida as sessões derivadas do link anterior. |
| RF-07 | Membros avaliam os colegas e podem se autoavaliar a qualquer momento. A autoavaliação tem o mesmo peso de uma avaliação de outro membro. |
| RF-08 | Existe uma única nota vigente por avaliador e jogador avaliado dentro do grupo. Reavaliar substitui a contribuição anterior. |
| RF-09 | A lista indica avaliação pendente quando o membro ainda não avaliou alguém e mostra a nota que ele deu quando já avaliou. |
| RF-10 | O perfil de cada jogador contém sua tabela de avaliações e pode ser acessado ao clicar nele. A tabela respeita a visibilidade da seção 5. |
| RF-11 | A nota consolidada é calculada segundo a seção 4 e usada pelo backend no sorteio. |
| RF-12 | O administrador seleciona exatamente 20 jogadores distintos e solicita quatro times de cinco, considerando apenas as notas. |
| RF-13 | O resultado apresenta jogadores, somas e médias por time e fica registrado com os dados necessários para reprodução. |

O cadastro exige nome e nota, além dos identificadores internos gerados pelo sistema. Foto é opcional. A criação do perfil, da identidade de acesso, da avaliação inicial e da credencial deve ser consistente: uma falha não pode deixar um jogador utilizável sem nota inicial.

## 3. Jornadas

### Administrador

1. Recebe provisionamento manual de e-mail e senha e autentica pela web com sessão e proteção CSRF. O link de login administrativo fica adiado em E2.
2. Cadastra um jogador com nome e nota inicial.
3. Copia o link pessoal gerado e envia ao jogador pelo canal que já utiliza, como WhatsApp.
4. Consulta perfis e avaliações com identificação dos autores.
5. Seleciona os 20 participantes entre todos os cadastrados e gera os times.
6. Consulta o resultado e, quando necessário, revoga e substitui o acesso de um jogador.

### Jogador

1. Abre seu link pessoal, que estabelece uma sessão de jogador.
2. Completa foto e nome do próprio perfil.
3. Consulta a lista de membros e reconhece avaliações pendentes e suas notas vigentes.
4. Avalia colegas ou a si mesmo; pode alterar qualquer uma dessas avaliações a qualquer momento.
5. Acessa os perfis dos colegas e consulta os valores das notas, identificando somente as avaliações de sua autoria.

O produto não precisa registrar presença ou encerramento de partidas para autorizar avaliações. Selecionar participantes de um sorteio não cria uma agenda de jogos.

## 4. Regra da nota consolidada

Uma nota recebida significa uma contribuição vigente de uma identidade avaliadora distinta. A nota inicial do administrador é sua primeira contribuição e não um voto adicional separado. Se o administrador reavaliar aquele jogador, substitui a própria contribuição.

| Número de contribuições vigentes | Nota efetiva |
| --- | --- |
| 1 | Nota vigente do administrador que realizou o cadastro |
| 2 a 4 | Média aritmética de todas as contribuições |
| 5 a 10 | Ordenar as notas; retirar uma ocorrência do menor e uma do maior valor; calcular a média das restantes |
| 11 ou mais | Ordenar as notas; retirar duas ocorrências menores e duas maiores; calcular a média das restantes |

A partir da segunda contribuição, cada inclusão ou alteração recalcula a nota. Não há processamento em blocos de cinco. A quantidade não aumenta quando a mesma pessoa reavalia. O descarte é feito por quantidade de ocorrências: valores empatados não devem causar remoção de todas as notas iguais. Os limites permanecem em dois descartes de cada lado acima de dez, inclusive com 15, 20 ou mais avaliações.

O cálculo e o sorteio usam o valor sem arredondamento de apresentação. Proposta de apresentação técnica: duas casas decimais na nota consolidada. O registro do sorteio preserva o valor usado no cálculo, não apenas o texto formatado.

### Exemplos para testes futuros

| Notas vigentes | Resultado esperado |
| --- | --- |
| `[7]` | 7, nota inicial |
| `[7, 9]` | 8 |
| `[2, 4, 6, 8]` | 5 |
| `[0, 4, 6, 8, 10]` | 6, após retirar 0 e 10 |
| `[0, 2, 4, 6, 8, 10]` | 5 |
| `[0, 1, 2, 3, 4, 5, 6, 7, 8, 10]` | 4,5 |
| `[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` | 5, após retirar 0, 1, 9 e 10 |
| `[0, 0, 5, 10, 10]` | 5; sobra uma ocorrência de cada extremo |

Esses exemplos são expectativas de teste, não resultados de testes executados.

## 5. Privacidade e autorização

| Ação/dado | Administrador autenticado como administrador | Jogador autenticado pelo link |
| --- | --- | --- |
| Ver lista e perfis do grupo | Sim | Sim |
| Ver valores e nota consolidada | Sim | Sim |
| Identificar autores de avaliações | Todos | Apenas a própria autoria |
| Cadastrar jogador e atribuir nota inicial | Sim | Não |
| Alterar nome e foto | Cadastro e manutenção administrativa | Apenas o próprio perfil |
| Avaliar, inclusive a si mesmo se possuir perfil | Sim | Sim |
| Alterar uma avaliação | Somente a própria contribuição | Somente a própria contribuição |
| Gerar/revogar links e sortear times | Sim | Não |

A permissão de consultar avaliações não permite ao administrador alterar notas de terceiros. A tabela mostra o nome de cada jogador avaliado; o ocultamento se aplica à identidade do avaliador.

A resposta da API para jogadores omite nomes, identificadores, links e metadados identificadores dos demais avaliadores. A própria autoria é indicada explicitamente. A ordem e os identificadores retornados não devem funcionar como pseudônimos estáveis que permitam relacionar outros autores entre perfis. Essa política reduz a exposição de autoria; não promete impossibilidade de inferência dentro de um grupo pequeno.

O grupo é parte do escopo de autorização e das restrições de integridade, apesar de existir apenas um piloto. Um usuário sem sessão ou sem vínculo com o grupo não recebe os dados. Futuras telas não são uma barreira de segurança: o backend autoriza cada operação.

## 6. Arquitetura

### Aplicações e persistência

- `web/`: Next.js App Router, TypeScript e Tailwind. TanStack Query para consultas e mutações interativas. Server Components podem consumir a API para leituras apropriadas, sem criar uma segunda implementação das regras de negócio.
- `api/`: NestJS com uma aplicação e um banco PostgreSQL, organizado em módulos de acesso, jogadores, avaliações e sorteios. Prisma e migrations ficam restritos ao backend.
- `mobile/`: React Native com Expo/Expo Router em uma etapa posterior. Reutiliza contratos e API, sem compartilhar compulsoriamente componentes visuais.
- Raiz: pnpm workspaces, Turborepo, lockfile único, instruções, CI e decisões. `packages/` só nasce quando existir um compartilhamento concreto.

Conceitualmente: navegador → API REST NestJS → PostgreSQL. A proposta para o navegador é expor a API sob a mesma origem da web, em `/api/v1`, reduzindo a complexidade operacional dos cookies. O mecanismo de encaminhamento depende da hospedagem escolhida.

### Módulos e dados conceituais

| Módulo | Responsabilidade | Dados principais |
| --- | --- | --- |
| Acesso | Autenticar, estabelecer sessão, limitar privilégios e revogar credenciais | Identidade, vínculo com grupo, credencial de link, sessão |
| Jogadores | Cadastrar e manter perfil, localizar membros | Jogador, vínculo opcional com identidade administrativa |
| Avaliações | Manter contribuição vigente e calcular nota; projetar dados por permissão | Avaliação por grupo/avaliador/jogador |
| Sorteios | Validar seleção, executar algoritmo e registrar resultado | Sorteio, times e notas capturadas |

A identidade existe independentemente do perfil: o administrador não precisa jogar, e o jogador não precisa ter e-mail. Quando um administrador também for jogador, o vínculo deve usar a mesma identidade avaliadora; autenticar com link de jogador não amplia o escopo da sessão para administrador.

As restrições de unicidade e transações do PostgreSQL sustentam a integridade. Requisições simultâneas do mesmo avaliador não podem criar dois votos vigentes. A nota consolidada pode ser derivada das avaliações no MVP; não requer cache ou fila.

### Contratos

O Nest publica OpenAPI como contrato REST. Tipos de clientes são derivados desse contrato quando houver o primeiro consumidor, com verificação de divergência na CI. Clientes não importam Prisma nem módulos internos do Nest. Validações no cliente ajudam a interação; o backend sempre revalida entradas e permissões. As regras puras de cálculo e sorteio permanecem no backend.

## 7. Acesso, operação e interface

O [ADR 0002](../../adr/0002-identidade-e-acesso-por-links.md) registra a revisão de 03/11/2026: e-mail/senha provisionados para o único administrador em E2, com link administrativo e envio Resend adiados. O futuro link reutilizável e revogável dos jogadores permanece em E3/E4. Sessões e revogação ficam no PostgreSQL; E2 usa cookie administrativo de oito horas, CSRF vinculado à sessão, origem exata e limites de tentativas. Acesso a fotos e caches de dados privados também respeitam o grupo.

Nome, e-mail administrativo e credenciais não entram em logs de requisição. Fotos terão limites de tamanho e tipo, validação do conteúdo, nomes internos gerados pelo servidor e entrega somente a membros. Armazenamento de objetos será escolhido antes do upload; serviço transacional de e-mail só passa a ser dependência de execução quando o envio adiado for retomado. E2 não depende de Resend configurado.

Os formulários precisam de rótulos, validação compreensível e estados de carregamento, erro, vazio e sucesso. Avaliar e selecionar os 20 participantes deve funcionar por teclado e em telas pequenas. Tailwind permanece como ferramenta de estilos; primitivas de interação e Storybook entram somente quando houver necessidade e componentes suficientes.

Desde as primeiras entregas: erros consistentes na API, logs estruturados com identificador de requisição e verificação de saúde. Antes do piloto: HTTPS, limites de requisição, segredos fora do código, deploy com migrations, backup e ensaio de restauração. Não há demanda inicial por Redis, filas, microsserviços ou rastreamento distribuído.

## 8. Sorteio

O backend carrega uma visão consistente das notas e valida exatamente 20 jogadores distintos do grupo. A função pura recebe somente os identificadores, as notas efetivas e uma semente; não acessa banco ou HTTP.

Proposta técnica inicial: gerar distribuições com aleatoriedade reproduzível, alocar jogadores respeitando cinco vagas por time e melhorar distribuições por trocas entre equipes. Critério primário: reduzir a diferença entre a maior e a menor soma de notas; desempate: reduzir a dispersão das somas. Regras de desempate e aleatoriedade fazem parte da versão do algoritmo.

Trata-se de uma heurística; não há promessa de ótimo global. O limite de busca será definido e medido na entrega do algoritmo como quantidade determinística de tentativas/trocas, não como tempo de relógio para escolher a solução. A função ordena as entradas de forma canônica por ID. Mesmo com notas muito diferentes, o resultado deve preservar tamanho, ausência de duplicatas e rastreabilidade. O cliente não envia notas para decidir o sorteio.

O registro imutável guarda IDs dos participantes, notas usadas, times, semente, versão do algoritmo, versão da regra de avaliação, parâmetros de busca não fixados pela versão e instante de geração. Alterações posteriores nas notas não reescrevem o resultado. Isso é histórico de sorteios, não calendário de partidas.

## 9. Entregas e qualidade

| Entrega | Resultado | Evidência requerida antes de concluir |
| --- | --- | --- |
| E1 — Fundação | Web/API/banco conectados e execução documentada | Instalação limpa, migrations, verificação de saúde, CI e builds |
| E2 — Acesso administrativo | Único administrador provisionado com e-mail/senha, sessão e contrato OpenAPI | Login válido/inválido, bootstrap após validação, rotação, logout, expiração, CSRF/origem, rate limit e invalidação após reprovisionamento/reinício; validação final pendente |
| E3 — Cadastro | Administrador cria perfil, nota inicial e link | Transação íntegra, controle de acesso, validação e ausência de segredos em logs |
| E4 — Acesso do jogador | Link abre sessão restrita e pode ser substituído | Revogação de link e sessões, negação de ações administrativas |
| E5 — Perfil | Edição de nome e foto | Autorização, upload validado e armazenamento privado |
| E6 — Avaliações | Lista, reavaliação, autoavaliação e tabelas | Limites 1/2/4/5/10/11, concorrência, empates e projeções de privacidade |
| E7 — Sorteio | Seleção de 20 e quatro times registrados | Invariantes, reprodução, exemplos conhecidos e comportamento com notas extremas/iguais |
| E8 — Piloto | Produto publicado e usado pelo grupo | Jornada completa, operação, restauração e feedback registrado |
| E9 — Mobile | Jornadas validadas no aplicativo | Plano próprio após feedback web e testes específicos do mobile |

E1–E4 estão detalhadas no [plano das primeiras entregas](../plans/2026-11-02-primeiras-entregas.md). E5–E9 são sequência de produto, com critérios definidos, mas ainda não são tarefas prontas para execução.

Testes previstos: Jest para regras puras; Supertest com PostgreSQL real de teste para API, transações e permissões; React Testing Library para interações; Playwright para jornadas entre papéis e acessos negados. Na etapa mobile: React Native Testing Library. Cada entrega amplia os testes relevantes, sem meta arbitrária de cobertura ou testes de configuração que apenas espelhem arquivos.

## 10. Evidências e resultados

Estado atual: E1 implementada e verificada localmente. E2 foi autorizada em 03/11/2026 e está em implementação/validação; o fechamento de comandos e resultados pertence ao relatório E2, ainda pendente. Cadastro de jogadores, avaliações e sorteio não foram entregues. Não há métricas de impacto; verificações locais não comprovam publicação ou execução remota da CI.

| Pergunta | Coleta proposta | Limite de interpretação |
| --- | --- | --- |
| Quanto esforço leva para formar times? | Registrar tempo do processo atual e do processo com o produto, com início/fim definidos | Uma sessão isolada não demonstra melhoria geral |
| Há avaliações suficientes? | Contar jogadores com 2 ou mais e com 5 ou mais avaliadores distintos; separar autoavaliação | Quantidade de votos não demonstra precisão de habilidade |
| O grupo aceita as distribuições? | Registrar feedback após uso e se o resultado foi usado ou refeito | Aceitação percebida não prova equilíbrio esportivo |
| A entrega está estável? | Registrar falhas reais, resultados de CI, teste de restauração e latência medida | Não apresentar metas ou cenários sintéticos como resultados de produção |

A coleta inicial pode ser manual e por consultas controladas. Não exige uma plataforma de analytics. Resultados públicos para o portfólio devem ser agregados ou usar dados fictícios, sem divulgar links de acesso ou avaliações identificáveis.

## 11. Limites e decisões futuras

Ficam fora desta primeira execução: criação pública de grupos, calendário, presença, pagamentos, notificações push, posições, goleiros, múltiplos atributos de habilidade, histórico completo de cada edição de voto, rankings e IA generativa. E-mail/usuário e senha para jogadores e mobile são evoluções, não funcionalidades já entregues.

Antes da configuração: verificar versões estáveis e compatíveis de runtime, pnpm, framework, ORM e ferramentas de teste; registrar a matriz e fontes oficiais. Antes do e-mail, upload e publicação: escolher provedores, domínio e orçamento com o responsável. Isso não impede o planejamento e não autoriza contratar serviços.

As durações exatas das sessões e o limite de busca do algoritmo são parâmetros técnicos a fixar e testar nas respectivas entregas. Não há prazos de entrega estimados sem conhecer a disponibilidade de trabalho. Esses pontos não mudam o escopo funcional aprovado.

## 12. Fontes e decisões

- [ADR 0001](../../adr/0001-monorepo-e-monolito-modular.md).
- [ADR 0002](../../adr/0002-identidade-e-acesso-por-links.md).
- [ADR 0003](../../adr/0003-avaliacoes-e-nota-consolidada.md).
- [ADR 0004](../../adr/0004-sorteio-explicavel-e-reproduzivel.md).
- [ADR 0005](../../adr/0005-contratos-e-fronteiras-dos-clientes.md).

Documentação oficial consultada em 02/11/2026 para orientar o desenho, sem homologar versões: [pnpm workspaces](https://pnpm.io/workspaces), [estrutura Turborepo](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository), [OpenAPI no Nest](https://docs.nestjs.com/openapi/introduction) e [monorepos no Expo](https://docs.expo.dev/guides/monorepos/).
