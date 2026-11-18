# Operação do piloto web

Este documento prepara a operação. Não comprova publicação nem adoção pelo grupo.

## Rodar localmente

1. Usar as versões fixadas em `.node-version` e `packageManager`.
2. Instalar com `pnpm install --frozen-lockfile`.
3. Configurar `.env` a partir de `.env.example`, sem sobrescrever um ambiente existente.
4. Iniciar os dois bancos (`pnpm services:up`, ou PostgreSQL próprio em bancos distintos).
5. Executar `pnpm db:generate`, `pnpm db:migrate` e `pnpm db:test:migrate`.
6. Provisionar o administrador com `pnpm admin:configure`, se ainda não estiver configurado.
7. Executar `pnpm dev` e abrir [o site local](http://localhost:3000).

O administrador entra em `/entrar`, cadastra jogadores em `/administracao/jogadores` e compartilha individualmente o link exibido. Um link perdido não pode ser recuperado da lista: abra o perfil e gere outro; o anterior e suas sessões serão invalidados. Jogadores usam o link, sem e-mail ou senha, e podem sair e reabrir o mesmo link enquanto ele estiver ativo.

`/jogadores` mostra membros, nota consolidada e a avaliação do usuário ou sua pendência. Abra um perfil para avaliar ou reavaliar, consultar a tabela e editar nome/foto quando autorizado. A autoavaliação funciona da mesma forma. O administrador seleciona vinte jogadores de linha em `/administracao/sorteios`. O resultado fica em `/sorteios/:id`, acessível aos membros, e o histórico em `/sorteios`.

## Verificar antes de disponibilizar

```sh
pnpm verify
pnpm contracts:check
pnpm test:e2e
pnpm build
pnpm test:smoke
```

O orquestrador E2E usa exclusivamente o banco de teste e as portas 3100/3101. Não execute builds simultâneos da web. Depois do E2E, o build normal restaura o encaminhamento da web para a API local de produção em 3001. O smoke precisa de 3000/3001 livres.

## Publicação externa — configuração ainda necessária

Escolher hospedagem web/API, PostgreSQL persistente, domínio e orçamento antes de contratar ou publicar. A API precisa suportar o processamento de imagens e as conexões PostgreSQL da versão instalada. A topologia do piloto deve preservar o encaminhamento `/api/v1` sob a mesma origem da web.

- Definir `APP_ORIGIN` como a origem HTTPS exata do site, e `API_ORIGIN` como a origem interna da API no build web. Links gerados anteriormente apontam para a origem antiga: gerar novos links para compartilhar no endereço publicado.
- Provisionar `AUTH_SECRET`, hash e e-mail do único administrador no gerenciador de segredos da hospedagem. Manter credenciais de produção distintas das de teste; não publicar `.env`, dumps, links ou avaliações em logs.
- Usar um usuário de banco com acesso apenas ao banco da aplicação e conexão protegida segundo o provedor. Nunca direcionar `TEST_DATABASE_URL` ao banco real.
- Aplicar migrations com `prisma migrate deploy` durante a entrega, antes de iniciar a versão que utiliza as novas colunas/tabelas. Não usar reset ou migração de desenvolvimento em produção.
- Verificar cookies `HttpOnly`, `Secure` e `SameSite=Lax`, origem/CSRF e revogação em HTTPS; inspecionar foto privada e respostas para cada papel.
- Configurar backup periódico do PostgreSQL, incluindo os bytes das fotos, com retenção, criptografia e acesso restrito. Restaurar um backup em banco separado e conferir perfis, notas e snapshots antes de declarar recuperação validada. Não restaurar sobre o banco ativo para fazer um ensaio.
- Monitorar readiness e logs estruturados sem corpo da requisição. Os logs de HTTP registram ID da requisição, método, status e duração; não nome, senha, foto ou token.
- Executar a jornada administrativa e a de um jogador em HTTPS com dados sintéticos antes de cadastrar a pelada real.

Um túnel temporário não substitui hospedagem persistente, backup ou ensaio de recuperação. Se for usado para uma demonstração autorizada, a origem HTTPS exata e os links devem corresponder ao túnel vigente.

## Evidência do uso real

Registrar separadamente o tempo para formar times no processo atual e com o produto, número de jogadores com 2+ e 5+ contribuições, falhas observadas e feedback de quem usou a distribuição. Anotar data, quantidade de participantes e como cada dado foi coletado. Publicar somente agregados ou dados fictícios, sem notas identificáveis ou links de acesso. Resultados sintéticos do algoritmo e testes automatizados não equivalem a impacto em campo.
