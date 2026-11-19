# Contribuir com o fute.io

O repositório permanece privado durante o piloto. A branch principal é `main`; tags `archive/2026-11-19/*` preservam as experiências anteriores. A adaptação mobile é desenvolvida em `codex/mobile-firebase-api`, sem merge automático na principal.

1. Crie uma branch a partir de `main` e abra um pull request pequeno, descrevendo problema, mudança e validação.
2. Execute o ambiente com os emuladores e contas sintéticas do README. Não compartilhe o `.env.firebase`, credenciais de produção, fotos, dados ou links de jogadores.
3. Execute `pnpm verify`. A CI também verifica segredos em todo o histórico Git obtido pelo checkout.
4. Aguarde a revisão do mantenedor e os checks `History secret scan` e `Website, Firebase emulators and Chrome`. Não faça push direto ou force push na `main`.
5. Mudanças na autorização, nos workflows, nas credenciais, nas dependências de autenticação ou no armazenamento exigem atenção especial na revisão.

O mantenedor publica pela CLI Vercel após validar a CI. Push no GitHub não faz deploy automático. Credenciais de produção pertencem somente ao ambiente Production; um colaborador não precisa delas para contribuir.

O GitHub confirmou que a proteção obrigatória de branches está indisponível para este repositório privado no plano atual. Portanto, o fluxo de PR/revisão acima é uma convenção enquanto a proteção preparada em `.github/main-protection.json` não puder ser ativada. `CODEOWNERS` solicita revisão, mas não bloqueia sozinho um push.

A política de Actions permite ações oficiais GitHub e a versão aprovada de `pnpm/action-setup`, todas fixadas por SHA. Ao atualizar uma ação de terceiro, o mantenedor também precisa atualizar a allowlist do repositório e `.github/actions-allowlist.json` antes de executar a nova versão.
