# ADR 0006 — Fotos privadas no piloto

Estado: decisão aplicada ao MVP web.

## Contexto

O grupo precisa de fotos opcionais nos perfis, sem acesso público e sem um provedor de armazenamento definido. O piloto é pequeno e já depende de PostgreSQL. E-mail e serviços adicionais permanecem adiados.

## Decisão

Guardar somente a foto vigente em `players.photo_bytes` (`bytea`). A API aceita JPEG ou PNG em base64, com até 2 MiB de bytes de entrada e limite de 16.777.216 pixels. O limite HTTP é 3 MiB para acomodar a expansão do base64, sem aceitar corpos ilimitados.

O sharp decodifica os pixels, aplica orientação, reduz para até 512 × 512 mantendo proporção e recodifica para JPEG sem metadados de origem. Não se confia em extensão, MIME informado pelo cliente ou simples assinatura do arquivo. SVG, formatos diferentes, imagens inválidas e conteúdo acima dos limites são rejeitados.

Somente o próprio jogador ou uma sessão administrativa pode alterar/remover a foto. `GET /api/v1/players/:id/photo` valida sessão e grupo, responde `image/jpeg`, `private, no-store` e `nosniff`. O cliente usa o endpoint autenticado diretamente; não passa a imagem por um otimizador público. Nenhum caminho de arquivo enviado pelo usuário é usado no servidor.

O armazenamento é parte do mesmo banco e backup dos perfis. Não há bucket público, URL remota fornecida pelo usuário nem busca de imagens externas.

## Consequências

Há uma dependência nativa adicional, sharp 0.35.5. Sua compatibilidade em Linux deve ser confirmada pelo resultado da CI do commit publicado. Fotos não exigem contratar serviço e são apagadas/substituídas sem reter histórico.

O volume de fotos amplia banco e backups. Esta decisão atende ao grupo piloto; crescimento exige migrar para armazenamento privado de objetos mantendo os mesmos controles de acesso. Dimensionamento, retenção e restauração da hospedagem devem ser ensaiados antes de abrir o piloto externo.

Referências primárias: [saída e remoção de metadados no sharp](https://sharp.pixelplumbing.com/api-output/), [opções do decodificador](https://sharp.pixelplumbing.com/api-constructor/) e [instalação](https://sharp.pixelplumbing.com/install/).
