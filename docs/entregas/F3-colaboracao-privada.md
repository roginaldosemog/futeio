# F3 — Preparação para colaboração privada

Data: 2026-11-18. O repositório deve permanecer privado. Não há autorização nesta entrega para mudar visibilidade, contratar plano ou reescrever histórico.

## Histórico revisado

- Após buscar as branches do remoto: 30 commits acessíveis, incluindo histórico das versões API/mobile e website. Gitleaks 8.30.1, baixado da release oficial com SHA-256 conferido, executado com `--all --full-history --redact`: nenhum achado.
- Logs de todas as 13 execuções Actions existentes no início da revisão foram baixados para pasta local ignorada e examinados com Gitleaks: nenhum achado. Nenhum artefato Actions disponível no momento da consulta.
- A checagem anterior de valores exatos das credenciais atuais/links pessoais também não os encontrou nos blobs Git locais. As varreduras não provam ausência de qualquer segredo possível e devem ser repetidas antes de mudar visibilidade.
- Relatórios e logs de auditoria ficam em `.firebase/security`, ignorados e excluídos do upload. Nenhum dado/credencial foi colocado no Git para registrar a auditoria. Não houve motivo identificado para apagar ou reescrever commits.

## Código e política versionados

- Limites deixam de usar orçamento global: Google/senha compartilham 20 por origem/15 minutos e 5 por origem/e-mail. CSRF anônimo usa 120 por origem; resgate de links usa 60 por origem. A origem vem do ingress Vercel validado e é protegida por HMAC. Testes cobrem isolamento, troca de cookie/e-mail/método, headers falsificados, IPv6 e rejeição fora da plataforma. Veja [ADR 0011](../adr/0011-origem-confiavel-e-limites-de-acesso.md).
- Novo check `History secret scan`, com Gitleaks fixado por versão e hash, checkout completo e logs redigidos. O check existente mantém os emuladores isolados e Chrome instalado com sandbox ativa.
- `CONTRIBUTING.md`, `SECURITY.md` e `CODEOWNERS` orientam a revisão e a operação. A licença continua sem definição; nenhuma permissão de licenciamento foi escolhida em nome do responsável.
- `.github/actions-allowlist.json` registra as ações externas aprovadas. `.github/main-protection.json` prepara exigência de PR, CI aprovada, resolução de conversas, histórico linear e proibição de force push/exclusão, inclusive para administradores. Não exige uma aprovação de terceiro para bloquear o único mantenedor; revisão de PRs de colaboradores continua responsabilidade dele.

## Configurado e confirmado no GitHub

| Configuração | Estado verificado |
| --- | --- |
| Visibilidade | Privado |
| Branch padrão | `main` |
| Actions permitidas | GitHub oficiais e SHA aprovado de pnpm/action-setup |
| SHA completo obrigatório em ações | Ativado |
| Permissão padrão do token Actions | Somente leitura |
| Actions aprovarem PRs | Desativado |
| Workflows de forks privados | Desativados |
| Envio de tokens de escrita/segredos/variáveis a forks privados | Desativado |
| Alertas de vulnerabilidades de dependências | Ativados |
| Proteção obrigatória da main | **Indisponível no plano atual com repositório privado** |

A API de proteção da branch retornou HTTP 403: exige GitHub Pro ou repositório público. A política de aprovação de contribuidores de forks públicos também foi recusada (HTTP 422) por este ser privado. A visibilidade foi preservada; nenhum plano foi contratado. `CODEOWNERS` e convenções de PR **não equivalem** a proteção obrigatória do servidor.

Quando o plano permitir, aplicar a política preparada, sem mudar a visibilidade pelo comando:

```sh
gh api --method PUT repos/roginaldosemog/futeio/branches/main/protection --input .github/main-protection.json
gh api repos/roginaldosemog/futeio/branches/main/protection
```

## Promoção e validação

A versão website é descendente da `origin/main` anterior (`6213eb0`). A promoção para `main` deve ocorrer por fast-forward depois da CI da preparação aprovada, preservando autoria/histórico e as branches anteriores. A branch padrão já era `main`.

Validação local: 79 testes unitários, 25 de integração e 10 E2E passaram, além de lint, TypeScript, contratos, auditoria de produção e build de produção isolado. Os cenários novos cobrem a fronteira de confiança, quotas de login e isolamento de CSRF/resgate entre origens. O build isolado e E2E são executados pelo orquestrador, sem reutilizar servidores/credenciais do piloto. Chrome instalado `157.0.8103.79`, sandbox ativa e nenhum argumento que a desative. Os resultados remotos devem ser conferidos para o commit promovido; resultados locais não substituem a CI.

Publicação continua manual pela CLI Vercel, agora a partir de `main`. Alterar os limites não exige migrar dados ou recriar sessões/jogadores. Registros antigos de quotas são removidos pela limpeza existente. Ao validar em produção, conferir os endpoints e o comportamento de headers do ingress sem esgotar quotas ou alterar avaliações reais.

Fontes oficiais: [proteção de branches e planos](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [permissões Actions](https://docs.github.com/en/rest/actions/permissions), [Gitleaks](https://github.com/gitleaks/gitleaks), [headers Vercel](https://vercel.com/docs/headers/request-headers).
