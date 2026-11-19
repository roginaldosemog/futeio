# Segurança do piloto

O código do fute.io é público e a pelada continua restrita aos membros. `main` reúne web e mobile; a versão efetivamente publicada está registrada nas entregas. Código revisado e CI aprovada reduzem riscos; não constituem garantia de ausência de vulnerabilidades.

## Reportar um problema

Use [Report a vulnerability](https://github.com/roginaldosemog/futeio/security/advisories/new) para relatar uma vulnerabilidade de forma privada ao mantenedor. Participantes também podem usar o canal privado do grupo. Não coloque em issues, pull requests, logs ou screenshots públicos senhas, tokens, cookies, chaves ou links pessoais de jogadores. Se o formulário privado estiver indisponível, não publique o segredo em uma issue.

Se uma credencial vazar, revogue/substitua no serviço responsável, verifique acessos e só então trate o arquivo/histórico. Remover o texto do último commit não invalida a credencial.

## Acesso e operação

- Administrador autorizado por UID/e-mail no servidor. Jogadores entram por links pessoais, que funcionam como credenciais e podem ser revogados.
- Firestore nega acesso direto de clientes; o Admin SDK exige credencial de servidor. Fotos de produção ficam no Blob privado e passam por autorização na leitura.
- Cookies opacos HttpOnly/Secure, proteção CSRF e verificação de expiração no servidor. A limpeza diária não define a validade de uma sessão.
- Mobile usa Bearer opaco no SecureStore, vinculado à API, sem cookies ou acesso direto ao Firebase. O servidor rejeita substituição/mistura dos dois transportes. Google retorna apenas código único com PKCE/state e confirmação administrativa; não compartilhe URLs de autorização. O scheme não verifica a identidade do app; veja a ADR 0012 e homologue builds assinadas antes de distribuir.
- Login: 20 tentativas por origem em 15 minutos, compartilhadas entre Google e senha; até 5 por origem/e-mail. CSRF anônimo: 120 por origem; resgate de link: 60 por origem, na mesma janela.
- Em produção, origem é o IP único informado pelo ingress Vercel em `x-vercel-forwarded-for`, somente quando o ambiente da plataforma está presente. Cabeçalhos genéricos e cookies não definem a origem. IP bruto não é armazenado: a chave usa HMAC com segredo do servidor. Ambiente local usa uma origem única para os emuladores.
- Produção sem uma origem confiável falha com 503. Ao mudar de hospedagem/proxy, revise explicitamente essa fronteira antes de publicar. Pessoas na mesma rede/IP compartilham os limites. Isso não protege contra todo ataque distribuído nem garante disponibilidade nas cotas gratuitas.
- CI utiliza apenas emuladores/contas sintéticas. Tokens de Actions têm leitura, não aprovam PRs e não persistem credenciais do checkout. Workflows de forks externos exigem aprovação; não recebem credenciais de produção. As regras do repositório devem ser verificadas no GitHub, não inferidas apenas dos arquivos.

## Histórico e abertura

Gitleaks está fixado em 8.30.1 e o binário da CI tem SHA-256 verificado. O scanner examina todo o histórico e refs obtidos pelo checkout, com saída redigida. Relatórios locais ficam em `.firebase/security`, fora do Git. Uma varredura sem achados cobre os padrões detectados, não prova que qualquer tipo de segredo esteja ausente.

A revisão para abertura está registrada em `docs/entregas/F4-repositorio-publico.md`. Previews continuam separados de produção; credenciais e links reais permanecem em arquivos locais ignorados ou no ambiente Production da Vercel. A política inclui proteção da `main`, relatos privados, alertas e proteção de segredos disponíveis para repositórios públicos, sem contratar plano pago. A licença de reutilização permanece a definir; a mudança de visibilidade não acrescenta um arquivo de licença.
