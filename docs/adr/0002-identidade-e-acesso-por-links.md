# ADR 0002 — Identidade e acesso por links

Data: 02/11/2026.

Estado: modelo de acesso aceito; controles abaixo são desenho técnico planejado e ainda não implementado.

## Contexto

Somente o administrador informa e-mail. Jogadores não cadastram e-mail, usuário ou senha no MVP. Cada jogador recebe um link gerado no cadastro e compartilhado manualmente pelo administrador. Perfis e avaliações pertencem a um grupo fechado.

## Decisão de produto

Separar identidade, perfil e credencial. O administrador tem identidade autorizada por e-mail mesmo se não jogar. Cada jogador possui identidade e perfil sem e-mail; pode participar do sorteio antes de autenticar. A nota inicial é atribuída à identidade do administrador.

O administrador autentica por link temporário enviado ao endereço autorizado. O link pessoal do jogador é reutilizável até revogação e só abre sessões com escopo de jogador. O administrador pode substituir esse link e invalidar suas sessões anteriores.

Se o administrador também jogar, seu perfil deve ser vinculado explicitamente à mesma identidade avaliadora. Credenciais distintas não devem duplicar o seu voto nem fazer um link de jogador conceder privilégios administrativos.

## Desenho técnico para a entrega

- Credenciais opacas geradas com aleatoriedade criptográfica; persistir somente o resumo criptográfico da credencial secreta. Nunca usar o ID do perfil como segredo.
- Login administrativo: endereço previamente autorizado, resposta genérica à solicitação e token de uso único com expiração. Valor inicial proposto para expiração: 15 minutos, sujeito a teste e registro na entrega E2. Consumo concorrente só pode ter um vencedor.
- Link de jogador: um segredo ativo por perfil, reutilizável até revogação; novo cadastro não exige envio automático de e-mail. O valor bruto é mostrado na criação ou rotação, não em listagens. Para compartilhar novamente após perdê-lo, gerar outro.
- Estabelecer sessão de navegador com cookie `HttpOnly`, `Secure` em HTTPS e `SameSite`, com estado de revogação no PostgreSQL. Não usar o segredo do link como cookie de sessão nem mantê-lo no armazenamento local do navegador.
- Tratar a URL de entrada como credencial: remover o segredo do endereço após o resgate e impedir sua inclusão em logs, eventos, cache público e referências para terceiros. A página de resgate não carrega recursos de terceiros. A forma exata de transporte será validada em E2/E4.
- Validar origem e proteção CSRF nas operações de sessão e mutação. Aplicar limites de tentativas aos pontos de autenticação.
- Revogar link e sessões relacionadas de forma consistente, inclusive diante de resgates concorrentes. Sessões possuem expiração própria; sua duração será fixada em E2/E4.

As medidas de sessão se apoiam nas orientações da [OWASP sobre gerenciamento de sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). Respostas genéricas e limites de tentativas seguem a [orientação de autenticação](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). A defesa das mutações baseadas em cookies segue a [orientação CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). O link reutilizável do jogador é uma escolha específica do MVP, não uma recomendação geral atribuída a essas fontes.

## Alternativas e consequências

E-mail e senha para todos aumentariam a barreira inicial e contrariam a decisão de produto. Link de uso único para jogadores exigiria nova entrega de credencial para cada novo acesso; não corresponde ao acesso reutilizável escolhido.

A posse do link permite atuar como o jogador. A interface deve orientar seu envio individual e fornecer recuperação pelo administrador. O desenho não comprova identidade civil nem autoria humana: membros usam uma credencial compartilhável. Isso será revisto quando houver autenticação individual por e-mail/usuário e senha.

Não haverá cadastro aberto, compra de serviços ou envio de mensagens nesta etapa de documentação. O provedor de e-mail do administrador será escolhido antes da entrega E2.
