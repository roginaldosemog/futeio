import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessRequest } from './access-context';
import { AdminGuard } from './admin.guard';
import { CsrfGuard } from './csrf.guard';
import { AuthRateLimiter } from './rate-limit.service';
import { PlayerAccessService } from './player-access.service';
import { PlayerAccessLinkDto, RedeemPlayerLinkDto } from './player-access.dto';
import { MessageResponseDto, SessionResponseDto } from './access.dto';

@ApiTags('Access')
@ApiCookieAuth('session')
@ApiBearerAuth('nativeSession')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
@ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
@Controller()
export class PlayerAccessController {
  constructor(private readonly access: PlayerAccessService, private readonly limiter: AuthRateLimiter) {}

  @Post('auth/player/redeem')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiTooManyRequestsResponse()
  async redeem(@Body() input: RedeemPlayerLinkDto, @Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<SessionResponseDto> {
    await this.limiter.peer(request, response, 'player-redeem', 60);
    return this.access.redeem(input.token, request.browser!, response);
  }

  @Post('players/:id/access-link/rotate')
  @HttpCode(200)
  @UseGuards(AdminGuard, CsrfGuard)
  @ApiOkResponse({ type: PlayerAccessLinkDto })
  @ApiNotFoundResponse()
  async rotate(@Param('id', ParseUUIDPipe) playerId: string, @Req() request: AccessRequest): Promise<PlayerAccessLinkDto> {
    return { accessUrl: (await this.access.changeLink(playerId, request.accessContext!, true))! };
  }

  @Delete('players/:id/access-link')
  @HttpCode(200)
  @UseGuards(AdminGuard, CsrfGuard)
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiNotFoundResponse()
  async revoke(@Param('id', ParseUUIDPipe) playerId: string, @Req() request: AccessRequest): Promise<MessageResponseDto> {
    await this.access.changeLink(playerId, request.accessContext!, false);
    return { message: 'Acesso por link revogado.' };
  }
}
