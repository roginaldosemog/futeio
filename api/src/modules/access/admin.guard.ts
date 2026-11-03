import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { SessionService } from './session.service';
import type { AccessRequest } from './access-context';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    const browser = await this.sessions.requireBrowser(request);
    const access = this.sessions.authenticated(browser);
    if (access.role !== 'ADMIN' || browser.session.membership?.role !== 'ADMIN') throw new ForbiddenException();
    request.browser = browser;
    request.accessContext = access;
    return true;
  }
}
