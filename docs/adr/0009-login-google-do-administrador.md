# ADR 0009 — Login Google do administrador

Data: 2026-11-18. Status: aceita por solicitação do responsável pelo produto.

O administrador pode entrar com Google ou com e-mail/senha. Ambos criam a mesma sessão opaca HttpOnly e passam pelas mesmas regras de autorização. Habilitar o provedor no Console não concede acesso ao grupo: o UID e o e-mail devem corresponder à configuração do servidor.

Carregamos somente os módulos Auth/App do Firebase Web SDK 13.4.0 para abrir a janela Google. O SDK usa persistência em memória; não grava o usuário ou seus tokens em localStorage/IndexedDB. Após a troca pelo cookie, ou em erro, encerra a sessão temporária do SDK. Ao sair da tela, descarta o cliente e ignora resultados tardios da janela ou da requisição. O navegador continua sem acesso direto a Firestore/Storage.

O ID token Firebase é enviado por POST same-origin com CSRF. O servidor usa `verifyIdToken(token, true)` para verificar assinatura, emissor, audiência e revogação, exige provedor Google, e-mail verificado e autenticação recente (até cinco minutos, tolerância de relógio futuro de um minuto). Só então confere UID/e-mail autorizados e consome atomicamente a sessão anterior. Não aceita um token Google bruto ou um papel escolhido pelo navegador. Tokens não são persistidos nem registrados em logs.

A página `/entrar` passa a ser dinâmica para receber apenas identificadores públicos Firebase em runtime: API key web, domínio Auth, ID do projeto e app ID opcional. O segredo de CSRF e a identidade administrativa não são enviados como configuração ao cliente. O build continua independente das credenciais reais. Nos testes, o host Auth recebido pelo cliente aponta exclusivamente para o emulador local.

O domínio efetivo de publicação precisa ser autorizado no Firebase Authentication. Uma conta Google diferente pode existir no Auth, mas não recebe sessão administrativa nem associação ao grupo. Os jogadores continuam com links pessoais. Associar métodos ao administrador deve preservar o UID escolhido; não flexibilizamos o acesso por domínio de e-mail nem liberamos cadastro administrativo.

Referências: [Google Sign-In no Firebase](https://firebase.google.com/docs/auth/web/google-signin), [dependências e persistência Auth](https://firebase.google.com/docs/auth/web/custom-dependencies), [verificação de tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
