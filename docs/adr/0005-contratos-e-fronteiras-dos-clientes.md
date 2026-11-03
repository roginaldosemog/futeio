# ADR 0005 — Contratos e fronteiras dos clientes

Data: 02/11/2026.

Estado: contratos web implementados em E2/E3; mobile permanece planejado.

## Contexto

Web e mobile precisam consumir as mesmas regras sem depender do banco. O backend já foi escolhido como autoridade de avaliações, permissões e sorteio. Compartilhar tudo entre as interfaces aumentaria acoplamento e prejudicaria a experiência própria de cada plataforma.

## Decisão

Publicar REST/OpenAPI a partir do NestJS e gerar tipos com openapi-typescript 7.13.0. E2 introduziu o consumidor de acesso e E3 acrescentou cadastro/lista de jogadores. `pnpm contracts:generate` produz o schema e os tipos; `pnpm contracts:check` verifica divergências na CI. O gerador usa fixtures isoladas e não depende das credenciais locais. `--default-non-nullable false` preserva propriedades opcionais de entrada com valor padrão no servidor.

Não importar tipos Prisma, repositórios ou serviços Nest na web/mobile. Compartilhar contratos e configurações quando houver benefício concreto; manter cálculo e sorteio dentro do backend. Não duplicar regras em Server Actions ou Route Handlers do Next.

Na web, manter Tailwind e componentes de responsabilidade clara. Usar TanStack Query nas consultas e mutações interativas. Empregar Server Components em leituras adequadas, com cuidado para que cookies, cache e dados de membros não atravessem sessões. Não compartilhar componentes visuais com React Native por obrigação.

Radix ou outra base de interação e Storybook não são dependências automáticas: entram quando controles complexos ou um conjunto de componentes justificar. Segurança, acessibilidade, estados de interface e testes fazem parte da entrega independentemente da biblioteca de estilos.

## Consequências e revisão

O contrato expõe projeções próprias para jogadores e administradores; não é uma serialização das tabelas. Geração de tipos não substitui validação em tempo de execução nem autorização.

Mudanças incompatíveis da API precisam considerar clientes mobile publicados. Essa política será detalhada antes da primeira versão mobile, sem implementar uma plataforma de versionamento antecipadamente.

Fontes consultadas em 02/11/2026: [OpenAPI no Nest](https://docs.nestjs.com/openapi/introduction) e [CSS no Next.js](https://nextjs.org/docs/app/getting-started/css). Consulta documental não equivale a verificar a compatibilidade de uma instalação futura.
