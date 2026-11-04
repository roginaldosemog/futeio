import { Body, Controller, ForbiddenException, Get, HttpCode, HttpException, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AUTH_CONFIGURATION, type AuthConfiguration } from './auth-configuration';
import { csrfFor } from './auth-secrets';
import { SessionService } from './session.service';
import { AdminLoginService } from './admin-login.service';
import { AuthRateLimiter } from './rate-limit.service';
import { CsrfGuard } from './csrf.guard';
import { AdminPasswordLoginDto, CsrfResponseDto, MessageResponseDto, SessionResponseDto } from './access.dto';
import type { AccessRequest, BrowserContext } from './access-context';

@ApiTags('Access')
@Controller('auth')
export class AccessController {
  constructor(private readonly sessions: SessionService, private readonly adminLogin: AdminLoginService, private readonly limiter: AuthRateLimiter, @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration) {}

  @Get('csrf')
  @ApiOkResponse({ type: CsrfResponseDto })
  @ApiTooManyRequestsResponse()
  async csrf(@Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<CsrfResponseDto> {
    if (request.headers.authorization !== undefined) throw new ForbiddenException();
    if (request.get('sec-fetch-site') === 'cross-site') throw new ForbiddenException();
    let browser: BrowserContext | undefined;
    try { browser = await this.sessions.requireBrowser(request); }
    catch (error) { if (!(error instanceof UnauthorizedException)) throw error; }
    if (browser && browser.session.role !== 'ANONYMOUS') {
      // Authenticated members behind Next share a network peer. A session
      // budget prevents one member's normal voting from blocking the group.
      if (!await this.limiter.within('csrf-session', browser.session.id, 60)) {
        response.setHeader('Retry-After', '900');
        throw new HttpException('Too many requests.', 429);
      }
    } else {
      // Keep the peer bound before creating any anonymous context.
      await this.limiter.peer(request, response, 'csrf', 60);
      browser = await this.sessions.getBrowser(request, response);
    }
    return { csrfToken: csrfFor(browser.token, this.configuration.secret) };
  }

  @Post('admin/login')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse()
  @ApiBadRequestResponse()
  @ApiForbiddenResponse()
  @ApiTooManyRequestsResponse()
  async login(@Body() input: AdminPasswordLoginDto, @Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<SessionResponseDto> {
    await this.limiter.peer(request, response, 'login', 10);
    if (!await this.limiter.within('email:login', input.email.toLowerCase(), 5)) {
      response.setHeader('Retry-After', '900');
      throw new HttpException('Too many requests.', 429);
    }
    return this.adminLogin.login(input.email, input.password, request.browser!, response);
  }

  @Get('me')
  @ApiCookieAuth('session')
  @ApiBearerAuth('nativeSession')
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse()
  async me(@Req() request: AccessRequest): Promise<SessionResponseDto> {
    return this.sessions.view(await this.sessions.requireBrowser(request));
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiCookieAuth('session')
  @ApiBearerAuth('nativeSession')
  @ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async logout(@Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<MessageResponseDto> {
    await this.sessions.logout(request.browser!, response);
    return { message: 'Sessão encerrada.' };
  }
}
