# M2/M3 — Fluxos do MVP no aplicativo

Data: 04/11/2026. Branch: `codex/mobile-app`. O usuário retomou o desenvolvimento neste computador após o marco M1. Este relatório registra implementação e verificações automatizadas; não declara homologação em aparelho ou publicação.

## Implementado

- Enviar e substituir a própria avaliação, incluindo autoavaliação e nota zero, sem calcular médias no cliente.
- Editar nome, selecionar/reduzir/enviar foto e confirmar sua remoção, conforme a permissão recebida da API.
- Cadastrar jogadores com nota inicial obrigatória e vínculo único ao perfil do administrador.
- Apresentar links somente nos recibos confirmados, compartilhar por ação explícita, ocultar segredos e confirmar rotação/revogação.
- Selecionar exatamente vinte jogadores de linha, solicitar quatro times ao backend e consultar histórico/snapshots.
- Integrar esses destinos à navegação Stack e à lista de jogadores, mantendo os controles administrativos condicionados ao papel autenticado.

Não houve mudança de regras ou schema do backend, migration, infraestrutura de filas/cache ou acesso dos clientes ao Prisma.

## Sessões, modais e consistência

Um 401 agora retira o conteúdo autenticado antes de aguardar a remoção do token no SecureStore. Restaurar a mesma credencial durante revalidação não descarta um 401 válido; respostas da credencial substituída continuam sem afetar a nova sessão.

O aplicativo oculta a interface ao perder atividade e preserva formulários/consultas em memória atrás dessa cobertura durante seletor/Share. A mesma sessão é revalidada sem desmontar o formulário. Leituras são atualizadas depois da validação; falha de acesso ou identidade diferente remove os dados. Erros transitórios de atualização preservam os últimos dados confirmados do perfil, sem reutilizá-los em 401/403/404. Não há persistência das consultas no disco.

Resultados de picker após desmontagem são descartados. Escritas confirmadas invalidam somente consultas do grupo/identidade capturados, inclusive quando o usuário já voltou à lista. Recibos não usam cache de consultas/mutações; mudanças de atividade/tela invalidam a apresentação de segredos, inclusive respostas atrasadas.

Sorteios não navegam automaticamente após a tela perder foco. Erro incerto permanece bloqueado após blur/refoco; sucesso confirmado impede repetir a submissão e oferece abrir o resultado. Consultas falham explicitamente sem conexão; escritas não ficam em fila offline e não recebem retry automático. A incerteza ainda é local à tela montada: depois de reiniciar o app ou abrir outra criação, o usuário deve conferir o histórico. Idempotência entre reinicializações não foi implementada.

## Fotos e permissões

Foram adicionados os módulos oficiais compatíveis com SDK58: ImagePicker 58.0.10, ImageManipulator 58.0.16 e FileSystem 58.0.13. `base64-js` 1.5.1 converte bytes privados em uma imagem em memória. A API nativa conserva omissão de cookies, bloqueio de redirects, validação de origem/caminho e limite de resposta JPEG. O componente Image não recebe token ou URL remota.

O seletor trabalha somente com imagens. A decodificação recebe limites de dimensão, a imagem processada vira JPEG e somente o novo arquivo produzido pelo manipulador é apagado. O original do usuário nunca é removido. O seletor do sistema pode conservar uma cópia no cache privado, com metadados originais; não se afirma ausência de cache local. O backend continua validando e normalizando a imagem recebida.

A introspecção oficial dos config plugins confirmou instruções `tools:node=remove` para câmera, microfone e armazenamento externo legado no Android; no iOS, descreve o uso de fotos e não inclui descrições de câmera/microfone. Isso verifica a configuração CNG, não o manifesto de um APK compilado nem os diálogos reais do sistema.

O override global de TypeScript foi removido: ele reescrevia peers amplos do Expo para 5.9.3 e entrava em conflito com o mobile 6.0.3. As versões diretas continuam fixadas: raiz/web/API 5.9.3 e mobile 6.0.3, sem relaxar peers estritos ou habilitar instalação automática de peers.

## Verificações

- Suíte mobile: **119 testes em nove suítes aprovados**.
- Monorepo: **267 unitários aprovados** — 119 mobile, 76 API, 63 web e nove scripts.
- Tipos, lint, compatibilidade Expo e instalação pelo lockfile com peers estritos aprovados.
- Exportação de bundles Hermes para Android/iOS aprovada.
- Revisão independente de código e testes: SPEC PASS / QUALITY APPROVED, sem achados materiais pendentes no escopo revisado.

Os testes incluem picker cancelado/tardio, retorno do modal com rascunho preservado, falha transitória de atualização, remoção lenta de credencial revogada, foto removida no servidor, origem binária não confiável, anonimato, nota zero/inválida, recibos privados, Back com escrita pendente, seleção de vinte, blur/refoco e resposta incerta do sorteio.

O teste integrado de AppProviders/ProfileScreen simula eventos de atividade e o picker assíncrono; não é um teste do seletor nativo. O orçamento do Jest mobile passou a quinze segundos porque a primeira renderização pode carregar/transformar módulos nativos sob demanda num cache vazio. Uma execução fria com a configuração do projeto passou; asserções, timeouts HTTP e política de retries não foram afrouxados.

A [CI do M1](https://github.com/roginaldosemog/futeio/actions/runs/41835477791) aprovou os 87 testes de integração PostgreSQL e oito jornadas Chrome, além das verificações do monorepo. O [resultado remoto por commit](https://github.com/roginaldosemog/futeio/actions?query=branch%3Acodex%2Fmobile-app) mantém essas etapas para M2/M3; não pressupor aprovação antes da execução.

## Auditoria de dependências

`pnpm audit --prod` retornou exit code 1: dois avisos moderados e um baixo, sem altos/críticos nessa consulta. O caminho reportado atravessa Expo CLI/Router, seu peer opcional de testes, RNTL e Jest. Não foi aplicada supressão ao scanner nem um override de major incompatível.

| Pacote / aviso | Correção informada | Exposição examinada |
| --- | --- | --- |
| [minimatch — amplificação de padrões](https://github.com/advisories/GHSA-g3hv-75wg-m249) | 11.0.1+ | Padrões de glob e ferramentas, não campos de notas/perfis |
| [glob — cancelamento de travessia](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | 14.0.2+ | Travessia do filesystem das ferramentas |
| [deepmerge — prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Nenhuma publicada no aviso consultado | Merge de configuração do Jest |

Uma exportação adicional com `--source-maps` foi inspecionada: 1.231 fontes no Android e 1.239 no iOS, sem módulos de minimatch, glob, deepmerge, Jest, test-exclude ou babel-plugin-istanbul nos mapas. Essa evidência limita a exposição nos bundles JavaScript exportados; os pacotes continuam no ambiente de desenvolvimento/build e a auditoria continua não aprovada. Não é uma análise de binários nativos nem uma garantia de ausência de vulnerabilidades.

Para reproduzir os artefatos: `pnpm --filter @futeio/mobile exec expo export --platform android --platform ios --source-maps --output-dir dist/audit --max-workers 2`, depois examine `sources` dos dois arquivos `.hbc.map`. Os mapas de inspeção não são publicados. Acompanhar releases compatíveis de Expo/Jest e reauditar antes da distribuição; manter builds com código/configuração confiáveis e ferramentas de desenvolvimento fora de exposição pública irrestrita.

## Pendente

Não foram gerados binários, instalados apps ou produzidas capturas de Android/iOS neste Windows. Permissões reais, renderização, acessibilidade, teclado, Share, retomada e destruição da Activity precisam da homologação descrita no [README mobile](../../mobile/README.md). Universal/app links, assinatura, distribuição e uso pela pelada real permanecem etapas posteriores. Nenhuma métrica de adoção ou impacto foi inventada.

Fontes dos módulos: [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/), [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/) e [conjunto SDK58](https://raw.githubusercontent.com/expo/expo/sdk-58/packages/expo/bundledNativeModules.json).
