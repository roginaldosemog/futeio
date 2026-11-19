# Segurança do piloto

O fute.io está em piloto privado com um grupo. Apenas `main` representa a versão mantida do website. Código revisado e CI aprovada reduzem riscos; não constituem garantia de ausência de vulnerabilidades.

## Reportar um problema

Avise o administrador diretamente pelo canal privado do grupo. Não coloque em issues, pull requests, logs ou screenshots públicos senhas, tokens, cookies, chaves ou links pessoais de jogadores. Antes de tornar o repositório público, habilite um canal de relato privado para pessoas externas ao grupo.

Se uma credencial vazar, revogue/substitua no serviço responsável, verifique acessos e só então trate o arquivo/histórico. Remover o texto do último commit não invalida a credencial.

## Acesso e operação

- Administrador autorizado por UID/e-mail no servidor. Jogadores entram por links pessoais, que funcionam como credenciais e podem ser revogados.
- Firestore nega acesso direto de clientes; o Admin SDK exige credencial de servidor. Fotos de produção ficam no Blob privado e passam por autorização na leitura.
- Cookies opacos HttpOnly/Secure, proteção CSRF e verificação de expiração no servidor. A limpeza diária não define a validade de uma sessão.
- Login: 20 tentativas por origem em 15 minutos, compartilhadas entre Google e senha; até 5 por origem/e-mail. CSRF anônimo: 120 por origem; resgate de link: 60 por origem, na mesma janela.
- Em produção, origem é o IP único informado pelo ingress Vercel em `x-vercel-forwarded-for`, somente quando o ambiente da plataforma está presente. Cabeçalhos genéricos e cookies não definem a origem. IP bruto não é armazenado: a chave usa HMAC com segredo do servidor. Ambiente local usa uma origem única para os emuladores.
- Produção sem uma origem confiável falha com 503. Ao mudar de hospedagem/proxy, revise explicitamente essa fronteira antes de publicar. Pessoas na mesma rede/IP compartilham os limites. Isso não protege contra todo ataque distribuído nem garante disponibilidade nas cotas gratuitas.
- CI utiliza apenas emuladores/contas sintéticas. Tokens de Actions têm leitura; forks privados não recebem credenciais ou tokens de escrita. As regras do repositório devem ser verificadas no GitHub, não inferidas apenas dos arquivos.

## Histórico e abertura futura

Gitleaks está fixado em 8.30.1 e o binário da CI tem SHA-256 verificado. O scanner examina todo o histórico e refs obtidos pelo checkout, com saída redigida. Relatórios locais ficam em `.firebase/security`, fora do Git. Uma varredura sem achados cobre os padrões detectados, não prova que qualquer tipo de segredo esteja ausente.

Antes de abrir: repetir a varredura e revisar logs/artefatos recentes, confirmar ausência de dados reais e links, manter previews separados de produção, definir licença/canal privado de relatos, habilitar as proteções GitHub disponíveis e conferir sua aplicação após mudar a visibilidade. Nenhum comando desta preparação muda a visibilidade ou contrata um plano.
