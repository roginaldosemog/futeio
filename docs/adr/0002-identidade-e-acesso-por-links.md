# ADR 0002 — Identidade, acesso administrativo e links dos jogadores

Data original: 02/11/2026. Revisão de escopo: 03/11/2026.

Estado: decisão aceita e acesso administrativo implementado/verificado localmente em E2. Os links dos jogadores pertencem às futuras E3/E4. Evidências e limites no [relatório E2](../entregas/E2-acesso-administrativo.md).

## Contexto e revisão aprovada

A decisão original previa login administrativo por link temporário enviado ao e-mail autorizado. Em 03/11/2026, o usuário adiou o envio por Resend e autorizou provisionar manualmente um único administrador com e-mail e senha. Esta revisão substitui o login por link apenas para o administrador nesta etapa. Jogadores continuam sem e-mail, usuário ou senha no MVP e receberão links pessoais nas entregas E3/E4.

## Identidade e autorização

Separar identidade, perfil e credencial. O administrador pode organizar o grupo sem jogar. O jogador poderá participar do sorteio antes de seu primeiro acesso. Se o administrador também jogar, seu perfil deverá usar a mesma identidade avaliadora para não duplicar seu voto; um futuro link de jogador nunca amplia o papel da sessão para administrador.

E2 não tem cadastro público, recuperação de senha ou envio de e-mail. A identidade e o vínculo ADMIN com o grupo piloto são criados ou reutilizados depois que e-mail e senha provisionados forem validados. Tentativas inválidas não criam identidades e recebem resposta genérica de autenticação.

## Provisionamento administrativo

- `ADMIN_EMAIL`: único endereço autorizado, normalizado para comparação.
- `ADMIN_PASSWORD_HASH`: formato `scrypt$32768$8$3$<salt-base64url>$<key-base64url>`, com salt aleatório de 16 bytes e chave derivada de 64 bytes. O perfil é fixo: N=32768, r=8, p=3 e maxmem de 64 MiB; parâmetros de requisição ou hash arbitrário não alteram o custo.
- `APP_ORIGIN`: uma origem exata HTTPS ou HTTP em localhost, 127.0.0.1 ou [::1], sem credenciais, caminho além de `/`, query ou fragmento.
- `AUTH_SECRET`: 32 bytes aleatórios em base64url, sem padding, usados para autenticar o token CSRF.

O helper `api/scripts/configure-admin.cjs` requer geração Prisma e build da API. Recebe senha em prompt oculto ou JSON por stdin, exige `.env` ignorado pelo Git e grava o hash entre aspas. Não recebe senha por argumentos nem imprime segredos. Nunca registrar e-mail real, senha, hash provisionado, segredo ou cookie em documentação, código, fixtures ou commits.

A implementação usa scrypt, randomBytes e timingSafeEqual do Node 24.22.1, sem uma nova dependência de hashing. O perfil corresponde a uma das combinações apresentadas pela OWASP; isso não é uma alegação de auditoria. Referências: [crypto na linha Node 24](https://nodejs.org/docs/latest-v24.x/api/crypto.html) e [armazenamento de senhas OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Sessão, CSRF e limitação de tentativas em E2

O cookie `futeio_session` é HttpOnly, SameSite=Lax, Secure quando APP_ORIGIN usa HTTPS e tem caminho `/`. A sessão administrativa dura oito horas e pode ser revogada no PostgreSQL; apenas o hash do token é persistido. Logout revoga a sessão e limpa o cookie.

`GET /api/v1/auth/csrf` estabelece ou reutiliza um contexto de navegador; sem autenticação, ele é uma pré-sessão de 30 minutos. O token CSRF é um HMAC ligado ao segredo da sessão e a AUTH_SECRET. Login e logout exigem `x-csrf-token` válido e Origin exatamente igual à configuração. Login revoga a pré-sessão e emite outra sessão, exigindo renovar o token CSRF. SameSite complementa essas verificações. Referência: [prevenção CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

A versão da credencial administrativa é uma impressão de e-mail normalizado e hash de senha. Reprovisionar e reiniciar a API muda essa versão e faz sessões antigas falharem na validação; editar `.env` sem reiniciar não troca a configuração já carregada.

O rate limit usa contadores atômicos no PostgreSQL em janelas fixas de 15 minutos: dez tentativas de login por peer, cinco por e-mail e 60 consultas CSRF por peer. Não usa Redis nem confia em X-Forwarded-For. No encaminhamento pelo Next, clientes compartilham o orçamento do peer do proxy; esse limite precisa ser revisto antes de uma topologia pública com proxy confiável. Exceder o limite resulta em 429 e Retry-After.

## Links de jogadores — decisão preservada para E3/E4

Cada cadastro gerará um segredo pessoal reutilizável até revogação, mostrado ao administrador na criação ou rotação para envio individual. O segredo não será o ID do perfil. O jogador não precisará de e-mail ou senha e receberá apenas o papel de jogador.

O administrador poderá revogar a credencial e as sessões derivadas e gerar outro link. O transporte deverá retirar o segredo da URL após o resgate e impedir sua inclusão em logs, caches públicos e referências de terceiros. Essas funcionalidades ainda não estão concluídas em E2.

## Resend adiado e consequências

O contrato de envio e o adaptador Resend existentes permanecem preparatórios e desconectados do módulo de acesso. E2 não registra o adaptador como provedor, não exige chave Resend, não realiza envio e não expõe rotas de solicitação ou resgate de link administrativo. Retomar o envio exigirá autorização e validação específica; a presença do adaptador não comprova integração em produção.

Senha local reduz a dependência de entrega de e-mail nesta etapa, mas exige provisionamento e recuperação manual. O link compartilhável continua sendo a credencial futura dos jogadores e comprova posse do segredo, não identidade civil. Nenhuma dessas decisões autoriza compra de serviços, cadastro aberto ou publicação.
