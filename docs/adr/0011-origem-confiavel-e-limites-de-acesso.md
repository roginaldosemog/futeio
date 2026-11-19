# ADR 0011 — Origem confiável e limites de acesso

Status: aceita na preparação para colaboração privada, 2026-11-18.

Uma quota global para tentativas de administrador permitia bloquear todas as conexões ao esgotar o orçamento de uma única origem. A quota global por e-mail também permitia bloquear o administrador em outra rede.

Login Google e senha passam a compartilhar 20 tentativas por origem em cada janela fixa de 15 minutos. Há um segundo limite de 5 por origem/e-mail. Trocar e-mail, método, cookie ou User-Agent não reinicia o orçamento da origem. As transações Firestore preservam a aplicação dos limites entre instâncias. Não foi acrescentado cache ou outro serviço.

Em Vercel, usa-se apenas `x-vercel-forwarded-for`, validado como IP único, e apenas quando `VERCEL=1` é definido pelo ambiente de execução. A plataforma sobrescreve os headers de origem no ingress conforme a [documentação oficial](https://vercel.com/docs/headers/request-headers). Não há confiança em XFF genérico, IP informado no corpo ou identificação por cookie. IPv6 é canonicalizado; HMAC com domínio próprio e segredo de servidor transforma a origem antes de usá-la na quota. IPs crus não são gravados em Firestore.

Fora da Vercel, somente o modo emulator utiliza uma origem local única. Produção sem fronteira de confiança conhecida retorna 503; mudar de hospedagem requer rever essa decisão. O modo de testes pode simular o ambiente Vercel com IPs sintéticos, mas o orquestrador elimina variáveis/credenciais reais herdadas.

CSRF anônimo (120) e resgate de links (60) também deixam de ter orçamento global e passam a usar a origem, na mesma janela de 15 minutos. CSRF autenticado continua por identidade. As regras de sessão, CSRF, autorização por UID/e-mail e credenciais dos jogadores permanecem no servidor.

Pessoas atrás do mesmo NAT/IP ainda dividem orçamento. A solução reduz bloqueio coletivo entre origens e tentativas por origem, mas não elimina ataques distribuídos, limitações do provedor de autenticação nem esgotamento de cotas do plano gratuito. Não se declara proteção completa contra indisponibilidade.
