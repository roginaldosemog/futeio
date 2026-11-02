# Matriz de compatibilidade — E1

Consulta: 02/11/2026. Esta matriz registra a seleção, os ajustes de compatibilidade e a homologação local da E1. As dependências diretas são fixadas e o lockfile registra a árvore resolvida. Verificações de produção remota e uso pelo grupo não estão incluídas.

| Componente | Versão selecionada | Critério |
| --- | --- | --- |
| Node.js | 24.22.1 | Linha LTS suportada; disponível no ambiente e compatível com Next, Nest e Prisma 7 |
| pnpm | 11.25.0 | Linha JavaScript estável já disponível; versão fixada em packageManager |
| Turborepo | 2.11.10 | Release estável consultada no registro oficial |
| Next.js / @next/eslint-plugin-next | 16.4.4 | Mesma versão; Node mínimo declarado 20.9 |
| React / React DOM | 19.3.1 | Par de mesma versão, aceito pelos peers do Next |
| Nest common/core/platform-express/testing | 12.3.2 | Mesma versão; Node mínimo declarado 20 |
| Prisma CLI/client/adapter-pg | 7.10.1 | Conjunto estável correspondente; CLI 8 RC rejeitado |
| PostgreSQL | 18.6 | Minor estável atual da linha 18, suportada pelo Prisma 7 |
| pg | 8.23.1 | Driver PostgreSQL, compatível com o adapter |
| TypeScript | 5.9.3 | Estável e aceito por Next/Nest/Prisma, typescript-eslint e ts-jest |
| Tailwind / PostCSS plugin | 4.3.3 | Mesma versão; estilos da web |
| ESLint / @eslint/js | 10.14.0 / 10.0.1 | Linha mantida; plugin oficial do Next, regras de Hooks e TypeScript compatíveis |
| eslint-plugin-react-hooks | 7.1.1 | Peer declara suporte ao ESLint 10 |
| typescript-eslint | 8.72.1 | Peer TypeScript >=4.8.4 e <6.1; aceita ESLint 10 |
| Jest / ts-jest | 30.5.2 / 29.4.15 | ts-jest declara suporte a Jest 30 e TypeScript <7 |
| Supertest | 7.3.1 | Integração HTTP da API |
| Tipos Node / React / React DOM | 24.19.2 / 19.3.0 / 19.3.0 | Linhas correspondentes aos runtimes escolhidos |

## Decisões de compatibilidade

1. Não instalar `prisma@latest`: a tag consultada aponta para `8.0.0-rc.29`, com fluxo diferente. A documentação do Nest orienta explicitamente Prisma 7 para migrations e geração deste desenho.
2. Não instalar `typescript@latest`: a tag consultada aponta para 7.0.2, fora dos peers do lint e do transformador de testes escolhidos. 5.9.3 atende à interseção documentada.
3. Nest é compilado em CommonJS, com resolução NodeNext e `moduleFormat = "cjs"` explícito na geração do Prisma. Isso evita `import.meta` de um cliente ESM num processo CommonJS.
4. PostgreSQL 19 está em RC na consulta; a E1 usa 18.6 estável. No contêiner 18, persistir `/var/lib/postgresql`, conforme a imagem oficial.
5. A configuração completa `eslint-config-next` traz plugins de importação, React e acessibilidade limitados ao ESLint 9. A linha 9 foi testada na resolução, mas descartada por estar fora de suporte desde 06/08/2026. A seleção final mantém ESLint 10 e usa diretamente o plugin oficial do Next, regras de Hooks e TypeScript; não força os peers dos plugins antigos. Acessibilidade continua exigindo verificação da interface, não apenas lint.
6. Node 26 e pnpm 12 existem, mas não são necessários para esta entrega. Usar a linha LTS 24 e pnpm 11 já disponíveis reduz variação entre o ambiente validado e a CI. Atualizações posteriores exigem executar novamente as verificações.
7. Mobile e suas dependências não serão instalados em E1. A compatibilidade Expo/React Native será verificada na entrega mobile.
8. Scripts de instalação são permitidos por pacote na lista `allowBuilds`, incluindo o watcher nativo de desenvolvimento. As exceções de idade mínima são limitadas às versões exatas do Next escolhido e seus artefatos correspondentes; não há liberação global de versões recentes ou scripts desconhecidos.
9. Nest 12 publica ESM. O código da API e o cliente Prisma são CommonJS e usam o suporte nativo `require(esm)` do Node 24.22.1. No Jest, os scripts habilitam `--experimental-vm-modules` conforme sua documentação; a limitação experimental fica restrita ao runner de testes, não à inicialização da API. Build e execução real são verificações separadas dos testes.
10. O cliente Prisma gerado referencia imports relativos `.js`; no Jest, o mapper resolve esses imports para as fontes TypeScript. Produção usa os arquivos JavaScript compilados normalmente.
11. O build Next observado propaga opções do processo pai para workers, que rejeitam `--env-file-if-exists` em `NODE_OPTIONS`. A web usa comandos Next diretos e `process.loadEnvFile` na configuração, com pacote ESM explícito. A API continua carregando seu ambiente pelo Node; seu modo watch e o binário compilado foram verificados.

## Fontes oficiais

- [Node: linhas LTS](https://nodejs.org/en/about/previous-releases).
- [Next: instalação e requisitos](https://nextjs.org/docs/app/getting-started/installation).
- [Next: configuração direta do plugin ESLint](https://nextjs.org/docs/app/api-reference/config/eslint), [suporte do ESLint](https://eslint.org/version-support/) e [ESM no Jest](https://jestjs.io/docs/ecmascript-modules).
- [Nest: receita Prisma, versão 7 e CommonJS](https://docs.nestjs.com/recipes/prisma).
- [Prisma: requisitos](https://www.prisma.io/docs/orm/v7/reference/system-requirements) e [PostgreSQL 18 suportado](https://www.prisma.io/docs/orm/v7/reference/supported-databases).
- [PostgreSQL: versões suportadas](https://www.postgresql.org/support/versioning/) e [imagem oficial](https://github.com/docker-library/docs/blob/master/postgres/README.md).
- [pnpm: instalação](https://pnpm.io/installation) e [configuração](https://pnpm.io/settings).
- Metadados primários dos pacotes publicados: `https://registry.npmjs.org/<pacote>/<versão>`, incluindo `engines` e `peerDependencies`; versões RC foram excluídas da seleção.

## Ambiente de verificação

Windows x64 com Node 24.22.1 e pnpm 11.25.0. Docker e WSL não estão instalados. Para executar testes reais de PostgreSQL localmente, será usado um cluster portátil em cache externo ao repositório, obtido do distribuidor indicado pelo site oficial, sem instalar serviço Windows. A imagem Compose e o serviço da CI permanecem PostgreSQL 18.6.

A configuração Compose foi validada com a CLI oficial Docker Compose 5.7.0. A ausência do Docker Engine impede afirmar que os contêineres foram executados neste computador. A CI está configurada, mas não executada no GitHub enquanto os commits não forem enviados.

Homologação local: instalação com `--frozen-lockfile`, `pnpm peers check`, geração Prisma, migrations nos dois bancos, `pnpm verify` e `pnpm test:smoke` terminaram com exit code 0. O audit de dependências de produção não encontrou vulnerabilidades conhecidas na consulta. Esses resultados não representam desempenho, adoção ou impacto do produto.
