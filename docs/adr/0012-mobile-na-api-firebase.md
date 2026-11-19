# ADR 0012 — Mobile na API Firebase do website

Data: 2026-11-19. Decisão aceita para a branch `codex/mobile-firebase-api`.

## Contexto

O aplicativo arquivado usava a antiga API NestJS. O piloto atual usa Next.js na Vercel, Firebase Auth/Firestore Spark e Blob privado. Manter dois backends produziria cadastros e regras divergentes. O objetivo é reutilizar os serviços do website sem permitir acesso direto ao banco nem enfraquecer as sessões web.

## Decisão

Restaurar Expo/React Native e consumir `/api/v1` do mesmo website. O contrato OpenAPI do servidor gera `@futeio/contracts`, um pacote apenas de tipos compartilhado pelos clientes. Não compartilha componentes, credenciais ou modelos Firestore. Médias, anonimização, permissões, fotos e sorteios continuam nos mesmos serviços do servidor.

Sessões são opacas, com segredo aleatório de 32 bytes; o servidor conserva somente o hash. O transporte é registrado como `BROWSER` ou `NATIVE`. Documentos anteriores sem esse campo continuam sendo sessões de navegador. Cookie e Bearer não são intercambiáveis; misturas são rejeitadas. O aplicativo envia `X-Futeio-Client: native`, omite cookies e recusa redirecionamentos. Esse marcador identifica o protocolo, não autentica o aplicativo.

O navegador mantém Cookie HttpOnly/Secure/SameSite, origem exata e CSRF nas escritas. Requisições nativas recusam Cookie e Origin, validam a sessão Bearer nas mesmas rotas e aplicam as mesmas permissões. Uma página web não recebe CORS para simular esse transporte. Limites de tentativas por origem confiável são compartilhados entre login web e nativo.

### Administrador

- E-mail/senha: `POST auth/native/admin/login`, autenticando no mesmo Firebase Auth e restringindo o UID/e-mail já configurados. Não existe cadastro público de administradores.
- Google: o aplicativo gera verifier e state aleatórios em memória, abre `/acesso/aplicativo` no navegador do sistema com desafio S256 e state e usa o login web existente.
- A página exige sessão administrativa de navegador, CSRF e consentimento explícito. A tela alerta para autorizar somente uma entrada iniciada no próprio celular.
- O servidor emite código único válido por dois minutos, armazenando apenas seu hash, desafio, state e vínculo administrativo. O retorno é fixo: `futeio://auth/callback`. Não aceita destinos fornecidos pelo cliente nem envia sessão no endereço.
- O aplicativo confere destino e state e troca código + verifier em `auth/native/admin/exchange`. A transação consome o código junto da criação da sessão. Tentativa com prova incorreta não consome o código; replay e concorrência não geram outra sessão.
- A autorização Firebase é revalidada antes da troca e em cada requisição administrativa. Desativação, revogação e alteração do administrador impedem o acesso.

O scheme não comprova a identidade do aplicativo instalado. PKCE protege contra interceptação do código, mas não contra um usuário autorizar uma solicitação iniciada por terceiros. Não divulgar links de autorização; manter o aviso e a ação explícita. Universal/App Links verificados e distribuição assinada ficam para uma próxima entrega.

### Jogador e armazenamento

O mesmo link pessoal é colado no app e resgatado em `auth/native/player/redeem`. Não exige e-mail. Rotação/revogação do link invalida sessões web e nativas. Apenas membros acessam perfis; avaliações usam a mesma projeção privada do servidor.

O Bearer fica no Expo SecureStore, acessível com o aparelho desbloqueado e sem migração para outro aparelho. O registro inclui a URL canônica da API. Trocar de ambiente descarta a credencial; credenciais antigas do NestJS são removidas e nunca encaminhadas. Código, verifier, senha e consultas privadas não são persistidos. Logout limpa a credencial e o cache em memória; retorno tardio após logout/troca de sessão é descartado. Sem conexão, o encerramento local não comprova a revogação remota; a expiração absoluta continua valendo.

### Operação e consequências

Sessão administrativa: oito horas; jogador: sete dias, como no website. Grants expirados participam da limpeza diária com limite de 500 documentos por coleção, além da verificação de expiração em cada uso. Índice `nativeLoginGrants.expiresAt` versionado; não usa TTL pago, novas contas Google OAuth móveis, filas ou Blaze.

Expo Go pode testar senha e links, se compatível com o SDK instalado. O retorno `futeio://` requer aplicativo instalado por compilação de desenvolvimento ou distribuição própria. As exportações JS e testes em emuladores Firebase não substituem homologação em Android/iOS. O website continua publicável separadamente, excluindo `mobile/` do upload Vercel e incluindo os contratos compartilhados.

Referências oficiais: [autenticação Expo](https://docs.expo.dev/guides/authentication/), [WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) e [PKCE RFC 7636](https://www.rfc-editor.org/rfc/rfc7636).
