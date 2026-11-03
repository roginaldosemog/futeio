export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
export interface LoginEmail { to: string; url: string; linkId: string; expiresAt: Date }
export interface EmailSender { sendLoginLink(message: LoginEmail): Promise<void> }
