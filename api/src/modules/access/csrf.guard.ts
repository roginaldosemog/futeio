import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AUTH_CONFIGURATION, type AuthConfiguration } from './auth-configuration';
import { readSessionCookie, validCsrf } from './auth-secrets';
import { SessionService } from './session.service';
import type { AccessRequest } from './access-context';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly sessions: SessionService, @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    if (request.get('origin') !== this.configuration.origin) throw new ForbiddenException();
    const token = readSessionCookie(request.headers.cookie);
    if (!token || !validCsrf(request.get('x-csrf-token'), token, this.configuration.secret)) throw new ForbiddenException();
    request.browser = await this.sessions.fromToken(token);
    return true;
  }
}
