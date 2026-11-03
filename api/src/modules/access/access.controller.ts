import { Body, Controller, ForbiddenException, Get, HttpCode, HttpException, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBadRequestResponse, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AUTH_CONFIGURATION, type AuthConfiguration } from './auth-configuration';
import { csrfFor } from './auth-secrets';
import { SessionService } from './session.service';
import { AdminLoginService } from './admin-login.service';
import { AuthRateLimiter } from './rate-limit.service';
import { CsrfGuard } from './csrf.guard';
import { AdminPasswordLoginDto, CsrfResponseDto, MessageResponseDto, SessionResponseDto } from './access.dto';
import type { AccessRequest } from './access-context';

@ApiTags('Access')
@Controller('auth')
export class AccessController {
  constructor(private readonly sessions: SessionService, private readonly adminLogin: AdminLoginService, private readonly limiter: AuthRateLimiter, @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration) {}

  @Get('csrf')
  @ApiOkResponse({ type: CsrfResponseDto })
  @ApiTooManyRequestsResponse()
  async csrf(@Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<CsrfResponseDto> {
    if (request.get('sec-fetch-site') === 'cross-site') throw new ForbiddenException();
    await this.limiter.peer(request, response, 'csrf', 60);
    const browser = await this.sessions.getBrowser(request, response);
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
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiUnauthorizedResponse()
  async me(@Req() request: AccessRequest): Promise<SessionResponseDto> {
    return this.sessions.view(await this.sessions.requireBrowser(request));
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiCookieAuth('session')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  async logout(@Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<MessageResponseDto> {
    await this.sessions.logout(request.browser!, response);
    return { message: 'Sessão encerrada.' };
  }
}
