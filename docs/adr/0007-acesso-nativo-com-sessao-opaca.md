# ADR 0007 — Acesso nativo com sessão opaca

Data: 04/11/2026.

Estado: implementação na branch mobile; publicação e validação em dispositivos são etapas separadas.

## Contexto

O aplicativo React Native com Expo precisa usar as mesmas identidades, permissões e revogações do cliente web. A API existente utiliza cookies HttpOnly e CSRF vinculado à sessão. Depender da persistência implícita de cookies no cliente nativo torna a restauração e a limpeza de sessão menos explícitas. As regras de negócio continuam no NestJS.

## Decisão

Adicionar `POST /api/v1/auth/native/admin/login` e `POST /api/v1/auth/native/player/redeem`. Os corpos de entrada mantêm os contratos de credenciais existentes. As respostas contêm `{ session, token }`, sem `Set-Cookie`, e usam `Cache-Control: no-store`.

O token é um segredo aleatório de 32 bytes. Somente seu hash SHA-256 é persistido na tabela de sessões existente. Não introduzir JWT, refresh token ou outra infraestrutura. O aplicativo conserva a sessão no `expo-secure-store`; senha e link pessoal não são persistidos pelo aplicativo. Links continuam sendo credenciais reutilizáveis até revogação, nunca identificadores públicos.

As requisições nativas utilizam `Authorization: Bearer <token>` sobre HTTPS. A API valida o mesmo estado persistido em cada requisição: expiração absoluta, grupo, associação, papel, versão da credencial administrativa e credencial de origem do jogador. Administradores mantêm oito horas de sessão e jogadores sete dias. Logout revoga a sessão atual; rotação e revogação do link invalidam sessões web e nativas derivadas.

Rejeitar cabeçalhos Authorization malformados ou duplicados e a combinação de Authorization com Cookie, sem fallback para o cookie. Os dois pontos de entrada nativos rejeitam Origin, Cookie e Authorization; não convertem sessões ambientes do navegador em tokens legíveis. O cliente envia credenciais explicitamente e não depende de cookies automáticos.

Nas rotas protegidas, a dispensa do CSRF acontece somente depois de autenticar o bearer e confirmar uma sessão de membro. A presença de um cabeçalho ou marcador de plataforma não é suficiente. O transporte web mantém o cookie HttpOnly, SameSite, Origin exata e HMAC CSRF. Não ampliar CORS nem afrouxar as proteções do navegador.

Compartilhar os limites existentes entre os pontos de entrada web e nativos, incluindo limite por e-mail, por peer e por resgate de jogador. Os dois transportes reutilizam os mesmos serviços, sem duplicar avaliações, permissões ou sorteio. Logs não incluem corpos, credenciais ou cabeçalhos de autenticação.

## Consequências

Os clientes compartilham tipos gerados do OpenAPI e não acessam Prisma. O mesmo endpoint `auth/me` restaura a sessão e `auth/logout` a revoga. O aplicativo limpa dados privados e armazenamento ao receber 401 ou sair. URLs de fotos privadas devem ser resolvidas somente no servidor configurado e carregadas com autenticação, sem encaminhar o bearer a hosts arbitrários.

HTTPS é obrigatório fora de desenvolvimento local. O aplicativo em um celular não acessa o computador por `localhost`; usar endereço HTTPS alcançável e configurado explicitamente. A URL pública e o esquema de deep link não são segredos nem provas de autenticação.

Testes de integração devem demonstrar isolamento entre transportes, expiração, revogação, limites compartilhados, privacidade e permissões. Testes em Node e exportação do bundle não comprovam funcionamento em Android ou iOS; registrar essa validação separadamente.

Fontes: [autenticação no Expo Router](https://docs.expo.dev/router/advanced/authentication/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) e [rede no React Native](https://reactnative.dev/docs/network).
