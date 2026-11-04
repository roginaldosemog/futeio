# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Administrador e participantes de uma pelada fechada organizada pelo WhatsApp. O usuário confirmou uso de Android e iPhone. O piloto terá cerca de vinte usuários; isso não é uma medição de uso.

## Product Purpose

Reunir avaliações de habilidade para ajudar a organizar quatro times de cinco jogadores de linha. Os goleiros ficam fora da seleção. O backend mantém as regras e permissões do MVP web.

## Capabilities and Constraints

O marco M1 compreende acesso administrativo por e-mail/senha, acesso do jogador pelo link pessoal já existente, sessão revogável, lista e leitura de perfis/avaliações. Escrita de avaliações, edição/fotos, administração e sorteios no app pertencem aos próximos marcos. A web já implementa esses fluxos.

Perfis e avaliações são privados aos membros. O administrador vê os autores; os jogadores identificam somente a própria contribuição. O aplicativo não recalcula notas nem sorteia times. A credencial pessoal não entra em parâmetros da navegação, logs ou cache de consultas.

## Brand Commitments

Nome solicitado: Fute.io. Isso não implica propriedade do domínio, disponível para revenda por terceiros na pesquisa registrada. Slugs e repositório continuam `futeio`. Terminologia em português, direta e acessível.

## Evidence on Hand

Contratos e regras implementados na API, jornadas web e testes automatizados. Simuladores iOS e aparelhos físicos precisam ser validados no ambiente do Mac; não substituir essa evidência por screenshots de navegador. Adoção e impacto real ainda não medidos.

## Product Principles

- Reutilizar a API e seus limites de acesso.
- Preservar controles e navegação nativos, áreas seguras e fontes do sistema.
- Tratar estados de conexão, falhas, revogação e troca de sessão explicitamente.
- Compartilhar contratos, sem forçar compartilhamento de componentes com a web.
