import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_TIMEOUT_MS } from './auth-policy';
import type { EmailSender, LoginEmail } from './email-sender.port';

export const RESEND_HTTP = Symbol('RESEND_HTTP');
export const EMAIL_CONFIGURATION = Symbol('EMAIL_CONFIGURATION');
export interface EmailConfiguration { resendFrom: string; resendApiKey: string }

// Deferred adapter: intentionally not registered in AccessModule. No email is sent in E2.
@Injectable()
export class ResendEmailSender implements EmailSender {
  constructor(@Inject(EMAIL_CONFIGURATION) private readonly configuration: EmailConfiguration, @Inject(RESEND_HTTP) private readonly http: typeof fetch) {}

  async sendLoginLink(message: LoginEmail): Promise<void> {
    try {
      const response = await this.http('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.configuration.resendApiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `futeio-admin-login/${message.linkId}` },
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        body: JSON.stringify({
          from: this.configuration.resendFrom,
          to: [message.to],
          subject: 'Seu acesso de administrador ao Futeio',
          text: `Use o link abaixo no mesmo navegador em que solicitou o acesso. Ele vale por 15 minutos e só pode ser usado uma vez.\n\n${message.url}\n\nSe você não solicitou este acesso, ignore esta mensagem.`,
          headers: { 'X-Entity-Ref-ID': message.linkId },
        }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(); }
      const result = await response.json() as { id?: unknown };
      if (typeof result.id !== 'string' || !result.id) throw new Error();
    } catch {
      // Never retain the provider response, key, recipient or URL in errors/logs.
      throw new Error('Email delivery could not be confirmed.');
    }
  }
}
