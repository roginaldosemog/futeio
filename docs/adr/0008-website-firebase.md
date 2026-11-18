# ADR 0008 — Website do piloto com Firebase

Data: 2026-11-17. Status: aceita nesta branch, por solicitação do responsável pelo produto.

O piloto imediato será usado por um único grupo. Esta alternativa preserva as telas Next.js e substitui NestJS/PostgreSQL por Route Handlers Node do Next.js, Firebase Auth para o administrador, Firestore para dados/sessões e Storage para fotos. Não inclui mobile, APIs nativas, filas ou envio de e-mail. A arquitetura anterior permanece no histórico.

Firebase Admin SDK é exclusivo do servidor. Respostas REST são projeções explícitas, sem detalhes de persistência. Firestore e Storage Rules negam todo acesso direto de clientes; IAM concede acesso ao servidor. Como Admin SDK ignora Rules, autorização e validação são verificadas no servidor e nos testes.

O administrador entra por e-mail/senha no Auth; seu ID token é verificado e o UID e e-mail precisam corresponder à configuração. Jogadores usam links pessoais sem contas Firebase. Sessões opacas são persistidas somente como hash e entregues por cookie HttpOnly. O login administrativo consome a sessão anterior atomicamente. Contas desativadas/revogadas e trocas de UID são verificadas a cada solicitação administrativa. Rotação/revogação de links usa versão/hash conferidos a cada solicitação do jogador.

Preservamos uma contribuição vigente por avaliador/jogador, incluindo autoavaliação. A nota inicial é a contribuição do administrador. Com uma nota prevalece a inicial; com duas ou mais calcula-se a média. A partir de cinco descartamos uma ocorrência de cada extremo; a partir de onze, duas. Não arredondamos na regra. Uma transação recalcula o resumo de cada jogador. A tabela fica apenas nos perfis: administrador vê autores, jogadores veem somente o próprio nome.

Sorteios exigem vinte jogadores distintos, sem goleiros nessa seleção. Preservam heurística versionada, semente reproduzível e snapshot transacional imutável de nomes/notas; não prometem ótimo matemático. Fotos viram JPEG até 512 px, sem EXIF, em objetos privados versionados e servidos com autorização e sem cache.

Storage e Firestore não têm transação conjunta: upload precede a troca transacional da referência; removemos o novo objeto em falha e o antigo após sucesso. Falha de limpeza pode deixar objeto privado órfão, sem quebrar uma atualização já confirmada. A operação documenta essa limitação.

Local exige projeto demo e todos os emuladores em loopback. Produção recusa emuladores, projeto demo e HTTP. O build não exige credencial real. pnpm conserva somente web; Turborepo permanece apenas no build para a integração de monorepos oficialmente documentada do App Hosting, alvo `web`.

Limites do piloto: listagem de até 500 jogadores e 50 sorteios recentes, sem paginação. Lista lê jogadores e a contribuição do usuário para indicar pendências. Rate limits compartilhados no Firestore não confiam em cabeçalhos de IP do cliente. Reavaliar custos e paginação antes de ampliar o uso.

Não há migração automática de dados reais. Não há custo ou impacto de uso medido nesta entrega. Blaze é necessário para App Hosting/Storage; uma instância e alertas não são teto financeiro. Deploy, IAM e faturamento ficam para a configuração posterior.
