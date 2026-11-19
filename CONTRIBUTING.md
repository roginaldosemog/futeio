# Contribuir com o fute.io

O código do piloto é público; os dados e acessos da pelada são privados. A branch principal é `main` e reúne web/mobile. Tags `archive/2026-11-19/*` preservam as experiências anteriores.

1. Crie uma branch a partir de `main` e abra um pull request pequeno, descrevendo problema, mudança e validação.
2. Execute o ambiente com os emuladores e contas sintéticas do README. Não compartilhe o `.env.firebase`, credenciais de produção, fotos, dados ou links de jogadores.
3. Execute `pnpm verify`. A CI também verifica segredos em todo o histórico Git obtido pelo checkout.
4. Aguarde a revisão do mantenedor e os checks `History secret scan` e `Website, Firebase emulators and Chrome`. Não faça push direto ou force push na `main`.
5. Mudanças na autorização, nos workflows, nas credenciais, nas dependências de autenticação ou no armazenamento exigem atenção especial na revisão.

O mantenedor publica pela CLI Vercel após validar a CI. Push no GitHub não faz deploy automático. Credenciais de produção pertencem somente ao ambiente Production; um colaborador não precisa delas para contribuir.

A política em `.github/main-protection.json` exige pull request, os dois checks aprovados pelo aplicativo GitHub Actions, branch atualizada, histórico linear e conversas resolvidas. Ela também bloqueia force push e exclusão da `main` e se aplica aos administradores. A aplicação efetiva deve ser conferida pela API/interface do GitHub; `CODEOWNERS` sozinho não bloqueia pushes.

Não é exigido um segundo revisor enquanto houver apenas um mantenedor, pois o autor não pode aprovar seu próprio PR. O mantenedor continua responsável pela revisão antes do merge. Ao adicionar colaboradores com escrita, revise essa política. Relatos de segurança devem usar o canal privado indicado em `SECURITY.md`.

Workflows de PRs enviados por forks de colaboradores externos exigem aprovação do mantenedor antes de executar. Antes de aprovar, confira o código e as mudanças de workflow. A CI usa apenas serviços locais e contas sintéticas; nunca acrescente credenciais de produção a workflows de contribuição.

A política de Actions permite ações oficiais GitHub e a versão aprovada de `pnpm/action-setup`, todas fixadas por SHA. Ao atualizar uma ação de terceiro, o mantenedor também precisa atualizar a allowlist do repositório e `.github/actions-allowlist.json` antes de executar a nova versão.
