# Domínio e publicação econômica — 04/11/2026

Pesquisa para o piloto pessoal, estimado em até vinte usuários. O nome solicitado foi **fute.io**; esta preferência não comprova propriedade ou disponibilidade do domínio. O repositório técnico continua `futeio`. Não houve alteração visual, compra, contato com vendedor ou contratação de hospedagem nesta pesquisa.

## Situação de fute.io

A consulta direta a `whois.nic.io:43`, servidor indicado pela [IANA para .io](https://www.iana.org/domains/root/db/io.html), retornou:

```text
Domain Name: fute.io
Creation Date: 2023-10-06T18:48:00Z
Registry Expiry Date: 2027-10-06T18:48:00Z
Registrar: Dynadot Inc
Domain Status: clientTransferProhibited
Name Server: ns1.afternic.com
Name Server: ns2.afternic.com
```

A [listagem pública da Afternic](https://www.afternic.com/domain/fute.io), renderizada em Chrome instalado com sandbox solicitada, anunciou **US$ 9.935 para compra imediata**, além de opção de fazer oferta. Não foi confirmada oferta mínima ou condição final de checkout. A captura e o texto foram inspecionados; não se trata do preço anual de registrar um domínio livre.

Consequência: `fute.io` não está disponível para registro comum. Promoções de novos `.io` não se aplicam à aquisição desse endereço já registrado. Para um piloto de vinte usuários, a recomendação é adiar essa aquisição e escolher outro endereço ou começar com o subdomínio gratuito da hospedagem.

## Referências de novos domínios .io

Preços anunciados em dólares, para nomes livres e não premium. Não são cotações para comprar `fute.io`; câmbio, tributos e condições finais precisam ser conferidos antes de pagar.

| Registrador | Primeiro ano anunciado | Renovação anual anunciada | Condição |
| --- | ---: | ---: | --- |
| [Spaceship](https://www.spaceship.com/promos/) | US$ 14,98 | US$ 51,75 | Cupom IO85, primeiro ano, um cupom por domínio/cliente, por tempo limitado e sem nomes premium |
| [Porkbun](https://porkbun.com/products/domains) | US$ 28,12 | US$ 51,80 | Promoção de primeiro ano |
| [Cloudflare Registrar](https://pricing.registrar.cloudflare.com/) | US$ 32,00 | US$ 50,00 | Valor publicado na consulta |

Entre as ofertas consultadas, a menor de entrada foi Spaceship com cupom. A renovação é separada da promoção e pode mudar no futuro. [Tabela de renovação da Spaceship](https://www.spaceship.com/domains/).

`futeio.com.br` não apresentou registro no RDAP oficial consultado (`https://rdap.registro.br/domain/futeio.com.br`, HTTP 404). Isso é um indício, não garantia de disponibilidade comercial: confirmar a busca e eventuais reservas/processos de liberação no Registro.br antes de escolher. O [Registro.br informa manutenção normal de R$ 40 por um ano](https://registro.br/dominio/processo-de-liberacao/resultado/). Nenhum domínio alternativo foi reservado.

## Primeira candidata de hospedagem

| Parte | Serviço a validar | Custo de execução dentro da franquia |
| --- | --- | ---: |
| Web Next.js | Vercel Hobby | US$ 0/mês |
| API NestJS | Outro projeto Vercel Hobby no mesmo repositório | US$ 0/mês |
| PostgreSQL | Neon Free | US$ 0/mês |
| Endereço inicial | Subdomínio `*.vercel.app` gerado pelo provedor | Sem compra de domínio próprio |

O [plano Hobby](https://vercel.com/docs/plans/hobby) é restrito a projetos pessoais e não comerciais. A candidatura depende de manter esse enquadramento e respeitar as franquias; vinte usuários não garantem, isoladamente, custo zero ou disponibilidade contínua.

Existe [suporte oficial do NestJS na Vercel](https://vercel.com/docs/frameworks/backend/nestjs): o backend inteiro é empacotado como uma Function, mantendo o monolito modular. A hospedagem não exige dividir os módulos em microsserviços. O [suporte a monorepos](https://vercel.com/docs/monorepos) permite web/API em projetos distintos do mesmo GitHub, com diretórios raiz próprios. Isso é compatibilidade documental, ainda sem deploy validado deste repositório.

O [Neon Free](https://neon.com/pricing) anuncia 1 GB de banco, 100 CU-h e 5 GB de transferência por projeto/mês, com suspensão por inatividade. As franquias e a janela curta de recuperação precisam ser acompanhadas. Ele [suporta PostgreSQL 18](https://neon.com/docs/reference/compatibility). Fotos já estão no PostgreSQL; não há necessidade demonstrada de contratar outro armazenamento de imagens nesta etapa.

## Ajustes necessários antes de publicar

1. Criar os projetos de preview e configurar geração Prisma, arquivos gerados e bibliotecas nativas Linux do sharp. Validar o entrypoint e o mecanismo de inicialização da API na plataforma.
2. Usar conexão PostgreSQL protegida e pooling compatível com Functions. Verificar o primeiro acesso após inatividade e os limites atuais de conexão/consulta; não mantê-lo acordado com sondagens constantes de readiness se a intenção for reduzir computação ociosa. Liveness não consulta o banco.
3. Preservar `/api/v1` na mesma origem da web por encaminhamento, com `APP_ORIGIN` HTTPS exata, cookies seguros e CSRF. O navegador continua consumindo contratos REST, sem Prisma.
4. Conferir os [limites das Functions](https://vercel.com/docs/functions/limitations): payload de 4,5 MB e bundle padrão de 250 MB. O corpo máximo atual de 3 MiB cabe no primeiro; o bundle e as fotos ainda precisam do teste real de deploy.
5. Validar login, link e revogação, foto, avaliações e sorteio no endereço publicado. Preparar backup independente e ensaio de restauração antes de cadastrar dados reais. Custo e destino de backups externos não estão incluídos na estimativa de execução acima.
6. Medir uso real e definir alertas/limites, sem afirmar que o número de contas equivale a uma medição de CPU, memória ou tráfego. Serviços gerenciados suportam as linhas de runtime/banco, mas controlam seus próprios patches.

## Alternativas se a primeira candidata apresentar uma limitação concreta

- **API na Railway Hobby, mantendo web e banco gratuitos:** [mínimo US$ 5/mês incluindo US$ 5 de consumo](https://docs.railway.com/pricing/plans). Pode superar esse valor; não são US$ 5 fixos para hospedar todos os serviços. Validar consumo antes de contratar.
- **API gratuita na Render:** também permite execução sem cobrança dentro das condições, mas [dorme após quinze minutos e pode levar cerca de um minuto para voltar](https://render.com/docs/free). O PostgreSQL gratuito da Render expira em trinta dias; não é a opção de persistência recomendada para o piloto. A opção Vercel/Neon evita introduzir esse despertar longo como primeira escolha.

Recomendação de pesquisa: validar primeiro Vercel Hobby para web/API e Neon Free, usando endereço gratuito. Escolher um domínio próprio barato depois da confirmação de disponibilidade, sem investir US$ 9.935 na revenda de `fute.io` para este piloto. Infraestrutura paga só entra se o teste de publicação ou o consumo observado mostrar necessidade. Esta é uma proposta econômica, não uma contratação nem prova de funcionamento em produção.
