# ADR 0004 — Sorteio explicável e reproduzível

Data: 02/11/2026.

Estado: objetivo funcional aceito; estratégia técnica inicial proposta para a entrega E7, ainda não implementada ou medida.

## Contexto

Formar quatro times de cinco a partir de 20 jogadores de linha selecionados. Goleiros, posições e outras restrições não entram no MVP. A distribuição usa apenas notas consolidadas determinadas pelo backend.

## Decisão

Manter o algoritmo como função pura no módulo de sorteios da API. Entradas: lista de IDs distintos com suas notas efetivas, semente e versão da estratégia. Saída: quatro conjuntos de cinco jogadores e totais/médias, sem consulta a banco ou HTTP dentro da função.

Começar com construção de distribuições e melhorias por trocas. Ordenar candidatos pela diferença entre a maior e a menor soma de time; usar dispersão das somas como desempate. Escolhas de desempate devem ser determinísticas para a mesma entrada, versão e semente.

O orçamento de busca será fixado e medido durante E7 como quantidade determinística de tentativas/trocas, vinculada à versão ou registrada com o resultado. A função usará ordenação canônica dos participantes por ID, de modo que a ordem de leitura do banco não altere o sorteio. Um corte por tempo de relógio não determina a solução reproduzível. A proposta é uma heurística: não há garantia de ótimo global. Mesmo com notas extremas ou iguais, o algoritmo precisa produzir uma composição válida e explicar os indicadores do resultado.

O backend lê as notas em uma visão consistente e registra o resultado com IDs, notas usadas sem arredondamento visual, semente, versões do algoritmo e do cálculo, todos os parâmetros de busca que não estejam fixados pela versão e instante. Uma alteração posterior de avaliação não muda um sorteio existente.

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
