# ADR 0003 — Avaliações e nota consolidada

Data: 02/11/2026.

Estado: decisão aceita no planejamento; não implementada.

## Contexto e decisão

O grupo precisa de uma referência inicial obrigatória e de avaliações que possam mudar com a percepção dos membros. Cada nota será um inteiro de 0 a 10. Autoavaliação é permitida e tem o mesmo peso. Avaliações ficam abertas a qualquer momento.

Manter uma única contribuição vigente por grupo, identidade avaliadora e jogador avaliado, com unicidade garantida no banco. A nota inicial do administrador já ocupa essa contribuição. Atualizações usam a mesma identidade e substituem a nota existente, inclusive em acesso administrativo e de jogador vinculados à mesma pessoa.

| Contribuições | Cálculo |
| --- | --- |
| 1 | Nota inicial vigente |
| 2 a 4 | Média de todas |
| 5 a 10 | Retirar uma menor e uma maior ocorrência e calcular a média |
| 11 ou mais | Retirar duas menores e duas maiores ocorrências e calcular a média |

Recalcular a partir da segunda contribuição a cada alteração. Não há atualização em lotes nem aumento automático dos descartes em 15 ou 20 votos. O resultado usado no sorteio não recebe o arredondamento destinado à apresentação.

O administrador consulta autores e valores. Membros consultam valores sem identificação dos outros autores e reconhecem as próprias notas. A API produz projeções de saída conforme o papel; ocultar nomes apenas na tela é insuficiente.

## Alternativas consideradas

- Acumular cada avaliação de cada pelada: daria peso maior a quem avalia mais vezes.
- Rodadas vinculadas a partidas: exigiriam presença e janela de avaliação que o usuário decidiu dispensar.
- Média simples para qualquer quantidade: não aplica o descarte de extremos solicitado.
- Impedir autoavaliação ou dar peso especial ao administrador: contrariaria o escopo aprovado.

## Consequências e verificação

Os cortes em cinco e onze contribuições podem alterar a média sem mudança das notas anteriores. Isso é comportamento da regra, não erro de arredondamento. Testar os dois lados de cada limite e a remoção por ocorrência quando houver empates.

A média aparada não garante ausência de combinação entre membros nem precisão esportiva. Sua adequação será avaliada com o grupo. A autorização para ver autoria não permite editar a nota de outro avaliador.

Não é necessário guardar cada edição histórica de voto no MVP. Os sorteios preservam as notas efetivamente usadas no momento de geração. A fórmula recebe uma versão para permitir reproduzir resultados antigos após futuras mudanças.
