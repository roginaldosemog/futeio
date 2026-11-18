# F2 — Google, Spark e publicação Vercel

Data: 2026-11-18. Branch: `codex/website-firebase`.

## Implementado

- Login Google e e-mail/senha do único administrador, restritos ao UID/e-mail configurados. Token Google recente e verificado é trocado pela mesma sessão opaca HttpOnly. Persistência Firebase em memória, descarte após troca e proteção contra conclusão do popup após desmontagem da tela.
- Jogadores mantêm links pessoais; perfis, notas anônimas e sorteios permanecem privados ao grupo.
- Fotos de produção no Vercel Blob privado: upload normalizado pelo servidor, caminho interno em Firestore e leitura autenticada sem cache. Compensação preserva objeto referenciado após confirmação de commit perdida.
- Credencial Firebase de servidor explícita, validando o projeto; Firebase Storage restrito aos emuladores locais.
- TTL pago removido; cron diário autenticado, limitado a 500 vencidos por coleção, com precondição de versão. Expiração permanece obrigatória no servidor.
- Configuração Vercel, exclusões de upload e documentação de variáveis/operação. App Hosting removido desta branch.
- Correções transitivas restritas de gRPC/Zod, mantendo auditoria de produção e lockfile congelado na CI.

## Evidências locais

Windows, Node 24.22.1, pnpm 11.25.0, Java 21:

| Verificação | Resultado |
| --- | --- |
| Instalação com lockfile congelado | Passou |
| Auditoria de dependências de produção | Nenhuma vulnerabilidade conhecida reportada |
| Lint, TypeScript e contratos gerados | Passaram |
| Testes unitários | 78 passaram (7 infraestrutura, 2 regras puras, 69 interface) |
| Integração isolada | 20 passaram |
| Build de produção isolado | Passou, incluindo rota de manutenção |
| E2E | 10 passaram |

E2E executou o Chrome instalado `157.0.8103.79` em `C:/Program Files/Google/Chrome/Application/chrome.exe`, com `channel: chrome`, `chromiumSandbox: true` e lista vazia de argumentos que desativam a sandbox.

Integração cobre Google aprovado/rejeitado, token inválido/provider incorreto/antigo, concorrência de sessão/votos, privacidade, expiração, links, normalização de fotos e commit ambíguo. O teste do SDK Blob usa transporte interceptado sem rede e confirma autenticação, acesso privado, cache desativado, rejeição de URLs arbitrárias e falha quando falta token. E2E do Google usa popup do Auth emulator e conta sintética; não equivale ao login Google real em produção.

## Configurado no Firebase real

Projeto `fute-io`, sem migração de dados antigos:

- Rules Firestore publicadas e índices de expiração confirmados pela API.
- Faturamento confirmado desativado em 2026-11-18; TTL não habilitado nas duas coleções.
- Conta de serviço dedicada com apenas `roles/datastore.user` e `roles/firebaseauth.viewer`. Consulta ao UID do administrador e leitura Firestore verificadas usando essa identidade.
- Credencial privada armazenada localmente em pasta ignorada, sem entrar no Git. Nenhum bucket de produção, App Hosting ou serviço pago provisionado nesta entrega.

## Pendências da publicação

A CLI da Vercel estava desconectada. Foi solicitado login na conta Hobby. Não há publicação concluída ou URL de produção validada enquanto esse acesso estiver pendente.

Após conectar: criar/vincular projeto e Blob privado somente Production, enviar variáveis de servidor, configurar `APP_ORIGIN` e domínio autorizado no Firebase, publicar e confirmar login real e bloqueio de leitura direta do Blob sem credencial. O cron real e o Blob real ainda precisam dessa verificação. A CI Ubuntu deve ser consultada no GitHub para o commit correspondente; resultados locais não são evidência da execução remota.

Nenhuma métrica de uso real ou impacto foi medida nesta entrega. Recursos gratuitos têm cotas; número de jogadores não garante disponibilidade ilimitada. Veja [configuração](../firebase.md) e [ADR 0010](../adr/0010-vercel-spark-blob-privado.md).
