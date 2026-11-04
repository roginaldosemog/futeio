import { Body, Controller, ForbiddenException, HttpCode, HttpException, Post, Req, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessRequest } from './access-context';
import { AdminPasswordLoginDto, NativeSessionResponseDto } from './access.dto';
import { AdminLoginService } from './admin-login.service';
import { PlayerAccessService } from './player-access.service';
import { RedeemPlayerLinkDto } from './player-access.dto';
import { AuthRateLimiter } from './rate-limit.service';

@ApiTags('Native access')
@ApiBadRequestResponse()
@ApiForbiddenResponse()
@ApiUnauthorizedResponse()
@ApiTooManyRequestsResponse()
@Controller('auth/native')
export class NativeAccessController {
  constructor(private readonly adminLogin: AdminLoginService, private readonly playerAccess: PlayerAccessService, private readonly limiter: AuthRateLimiter) {}

  private requireExplicitCredentials(request: AccessRequest): void {
    // A native login must not export an ambient browser session. Native clients
    // do not need CORS and must send no cookies, Origin or existing bearer here.
    if (request.headers.origin !== undefined || request.headers.cookie !== undefined || request.headers.authorization !== undefined) throw new ForbiddenException();
  }

  @Post('admin/login')
  @HttpCode(200)
  @ApiOkResponse({ type: NativeSessionResponseDto })
  async login(@Body() input: AdminPasswordLoginDto, @Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<NativeSessionResponseDto> {
    this.requireExplicitCredentials(request);
    await this.limiter.peer(request, response, 'login', 10);
    if (!await this.limiter.within('email:login', input.email.toLowerCase(), 5)) {
      response.setHeader('Retry-After', '900');
      throw new HttpException('Too many requests.', 429);
    }
    return this.adminLogin.loginNative(input.email, input.password);
  }

  @Post('player/redeem')
  @HttpCode(200)
  @ApiOkResponse({ type: NativeSessionResponseDto })
  async redeem(@Body() input: RedeemPlayerLinkDto, @Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<NativeSessionResponseDto> {
    this.requireExplicitCredentials(request);
    await this.limiter.peer(request, response, 'player-redeem', 60);
    return this.playerAccess.redeemNative(input.token);
  }
}
