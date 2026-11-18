# ADR 0010 — Vercel Hobby, Firebase Spark e Blob privado

Status: aceita pelo responsável em 2026-11-18.

O piloto pessoal do fute.io precisa de autenticação, dados e fotos privadas sem ativar faturamento Firebase. Esta decisão substitui a hospedagem App Hosting e o uso de Storage/TTL em produção previstos na ADR 0008.

O Next.js completo roda na Vercel Hobby. Firebase Auth mantém Google e e-mail/senha do administrador, restritos ao UID/e-mail configurados; jogadores mantêm links pessoais. Firestore Spark guarda dados, sessões e limites de requisição, acessíveis somente pelo servidor.

Fotos são normalizadas e enviadas pelo servidor ao Vercel Blob com `access: private`. O banco guarda somente o caminho gerado pelo servidor. O endpoint de leitura exige associação ao grupo e responde sem cache. Nenhuma URL assinada ou token de armazenamento é exposto ao cliente. O Firebase Storage emulator permanece como armazenamento descartável dos testes locais; não há fallback para ele em produção.

TTL gerenciado do Firestore exige faturamento. Um cron diário autenticado remove até 500 documentos de cada coleção (`sessions`, `rateLimits`) por execução. Expiração continua obrigatória em cada acesso, independentemente da limpeza. Acúmulo superior ao limite diário exige intervenção e revisão do limite, sem habilitar serviço pago automaticamente.

A Vercel recebe uma credencial de serviço Firebase somente no servidor, com acesso a Firestore e consulta de usuários Auth. Ela não deve receber Owner/Editor nem ser usada no browser, Git ou logs. O token Blob fica igualmente restrito ao servidor. Previews não recebem credenciais de produção nem autorização para acessar dados reais.

Hobby atende ao uso pessoal e não comercial deste piloto. Cotas gratuitas limitam a disponibilidade; não se promete custo/disponibilidade por número de usuários. Uma evolução comercial exige reavaliar os termos e os planos. O domínio próprio permanece separado da publicação no domínio gratuito da Vercel.

Fontes: [Hobby](https://vercel.com/docs/plans/hobby), [Blob privado](https://vercel.com/docs/vercel-blob/private-storage), [cotas Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing), [cron Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cotas Firestore](https://firebase.google.com/docs/firestore/quotas), [Admin SDK](https://firebase.google.com/docs/admin/setup).
