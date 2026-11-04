import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AUTH_CONFIGURATION, loadAuthConfiguration } from './auth-configuration';
import { AUTH_CLOCK, SystemClock } from './clock';
import { AccessController } from './access.controller';
import { SessionService } from './session.service';
import { AdminLoginService } from './admin-login.service';
import { CsrfGuard } from './csrf.guard';
import { AdminGuard } from './admin.guard';
import { AuthRateLimiter } from './rate-limit.service';
import { PlayerCredentialService } from './player-credential.service';
import { MemberGuard } from './member.guard';
import { PlayerAccessService } from './player-access.service';
import { PlayerAccessController } from './player-access.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AccessController, PlayerAccessController],
  providers: [
    { provide: AUTH_CONFIGURATION, useFactory: () => loadAuthConfiguration(process.env) },
    { provide: AUTH_CLOCK, useClass: SystemClock },
    // Email delivery is deferred. Do not register Resend or expose administrator link endpoints
    // until the administrator explicitly resumes and validates that delivery.
    SessionService, AdminLoginService, CsrfGuard, AdminGuard, MemberGuard, AuthRateLimiter, PlayerCredentialService, PlayerAccessService,
  ],
  exports: [SessionService, AdminGuard, MemberGuard, CsrfGuard, PlayerCredentialService, AuthRateLimiter, AUTH_CONFIGURATION],
})
export class AccessModule {}
