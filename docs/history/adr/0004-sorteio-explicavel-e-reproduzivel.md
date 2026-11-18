# ADR 0004 — Sorteio explicável e reproduzível

Data: 02/11/2026.

Estado: estratégia E7 implementada como `seeded-greedy-swaps-v1` e medida com cenários sintéticos. Uso e equilíbrio em campo ainda não medidos.

## Contexto

Formar quatro times de cinco a partir de 20 jogadores de linha selecionados. Goleiros, posições e outras restrições não entram no MVP. A distribuição usa apenas notas consolidadas determinadas pelo backend.

## Decisão

Manter o algoritmo como função pura no módulo de sorteios da API. Entradas: lista de IDs distintos com suas notas efetivas, semente e versão da estratégia. Saída: quatro conjuntos de cinco jogadores e totais/médias, sem consulta a banco ou HTTP dentro da função.

Começar com construção de distribuições e melhorias por trocas. Ordenar candidatos pela diferença entre a maior e a menor soma de time; usar dispersão das somas como desempate. Escolhas de desempate devem ser determinísticas para a mesma entrada, versão e semente.

O orçamento fixado pela versão é de 64 tentativas e até 32 melhorias por troca em cada tentativa. A função ordena canonicamente os participantes por ID e usa um gerador pseudoaleatório determinístico derivado da semente. Distribui notas maiores primeiro no time com menor soma e vaga livre, variando empates; depois testa trocas e mantém melhorias de diferença de somas, com variância como desempate. A ordem de leitura do banco não altera o resultado. Um corte por tempo de relógio não determina a solução. É uma heurística: não há garantia de ótimo global. Notas extremas e iguais preservam uma composição válida.

O backend lê as notas em transação `RepeatableRead` e registra IDs, nomes capturados, notas usadas sem arredondamento visual, semente, versões do algoritmo/cálculo e instante. Os limites da busca são constantes da versão. Uma alteração posterior de nome ou avaliação não muda o snapshot. Somente administradores geram; membros consultam os resultados do próprio grupo. A listagem apresenta os cinquenta mais recentes, sem excluir os anteriores.

## Alternativas consideradas

- Sorteio aleatório simples: reproduzível, mas não atende ao objetivo de aproximar a força dos times.
- Distribuição manual: preserva o trabalho que o produto pretende reduzir.
- Otimização exata desde o início: poderá servir como comparação em cenários reduzidos, mas não será adotada sem avaliar seu custo e benefício para 20 participantes.

## Evidências requeridas

- Exatamente quatro times de cinco; cada jogador aparece uma única vez.
- Rejeição de quantidades diferentes de 20, IDs repetidos e participantes fora do grupo.
- Reprodução com os dados capturados, mesmo depois de mudar notas atuais.
- Cenários de notas iguais, extremos e soluções conhecidas em testes.
- Tempo de execução e qualidade do equilíbrio registrados com dados de teste identificados como sintéticos.

Uma nova semente pode levar ao mesmo resultado. Os indicadores matemáticos da distribuição não demonstram, por si, equilíbrio em campo ou satisfação dos participantes. Essas evidências vêm do piloto.
