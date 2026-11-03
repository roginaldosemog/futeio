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

@Module({
  imports: [PrismaModule],
  controllers: [AccessController],
  providers: [
    { provide: AUTH_CONFIGURATION, useFactory: () => loadAuthConfiguration(process.env) },
    { provide: AUTH_CLOCK, useClass: SystemClock },
    // Email delivery is deferred. Do not register Resend or expose link endpoints
    // until the administrator explicitly resumes and validates that delivery.
    SessionService, AdminLoginService, CsrfGuard, AdminGuard, AuthRateLimiter,
  ],
  exports: [SessionService, AdminGuard, CsrfGuard],
})
export class AccessModule {}
