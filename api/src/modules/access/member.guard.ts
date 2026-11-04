import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { SessionService } from './session.service';
import type { AccessRequest } from './access-context';

@Injectable()
export class MemberGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessRequest>();
    request.browser = await this.sessions.requireBrowser(request);
    request.accessContext = this.sessions.authenticated(request.browser);
    return true;
  }
}
