# Estados do aplicativo

Atualizado em 2026-11-19. Regras de autenticação: [ADR 0012](adr/0012-mobile-na-api-firebase.md).

`SessionController` controla `loading`, `anonymous`, `authorizing`, `authenticated` e `error`. Apenas `authenticated` carrega uma sessão. `revision` descarta resultados de uma tentativa anterior; a fila serializa mudanças no SecureStore. `authorizing` reserva a tentativa enquanto o navegador está aberto; retomar o app não deve iniciar outra validação nessa fase. Cancelar volta a `anonymous` sem erro; logout impede instalar uma resposta tardia.

`AppProviders` cobre a interface enquanto o app está fora de primeiro plano e preserva rascunhos durante seletores/compartilhamento. Ao voltar, valida silenciosamente a sessão antes de liberar os dados. Mudança de identidade, 401 ou logout limpam dados privados. Falha temporária de verificação apresenta tentativa de recuperação.

| Fluxo | Código | Estados |
| --- | --- | --- |
| Link pessoal administrativo | `mobile/src/features/administration/link-access-machine.ts` | idle, confirming, submitting, rotated, revoked, failed |
| Cadastro de jogador | `mobile/src/features/administration/player-creation-machine.ts` | editing, submitting, created, rejected, uncertain, reviewed |
| Resultado de escrita | `mobile/src/lib/write-outcome.ts` | rejected ou uncertain |

As transições puras devolvem o mesmo objeto para eventos ignorados. `useMachine` aplica o evento sincronicamente; retorno `null` impede repetir efeitos antes de React renderizar. Guarde o segredo somente no estado em que ele pode ser exibido. Eventos de saída de tela/primeiro plano ocultam links, inclusive após resposta tardia.

Cadastros e sorteios não têm idempotência entre reinicializações. Erro de rede, 5xx ou 429 pode representar uma gravação concluída sem confirmação; mantenha a ação bloqueada e oriente a conferir lista/histórico. Recusas definitivas permitem corrigir a entrada. Consultas/mutações não são persistidas nem repetidas automaticamente.

Antes de alterar esses fluxos, execute `pnpm test:mobile`. Os testes de controle de sessão, máquinas, administração, sorteios e ciclo de vida dos modais cobrem repetições e respostas fora de ordem. Testes de renderização não substituem retorno nativo de browser/Share/seletor em aparelhos.
