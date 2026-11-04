import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiProduces, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessRequest } from '../access/access-context';
import { MemberGuard } from '../access/member.guard';
import { CsrfGuard } from '../access/csrf.guard';
import { AuthRateLimiter } from '../access/rate-limit.service';
import { PlayerProfileService } from './player-profile.service';
import { PlayerProfileDto, UpdatePlayerProfileDto, UploadPlayerPhotoDto } from './player-profile.dto';

@ApiTags('Players')
@ApiCookieAuth('session')
@ApiBearerAuth('nativeSession')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiNotFoundResponse()
@Controller('players')
@UseGuards(MemberGuard)
export class PlayerProfileController {
  constructor(private readonly profiles: PlayerProfileService, private readonly limiter: AuthRateLimiter) {}

  @Get(':id')
  @ApiOkResponse({ type: PlayerProfileDto })
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AccessRequest): Promise<PlayerProfileDto> {
    return this.profiles.get(id, request.accessContext!);
  }

  @Post(':id/profile')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
  @ApiOkResponse({ type: PlayerProfileDto })
  @ApiBadRequestResponse()
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdatePlayerProfileDto, @Req() request: AccessRequest): Promise<PlayerProfileDto> {
    return this.profiles.rename(id, input.name, request.accessContext!);
  }

  @Post(':id/photo')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
  @ApiOkResponse({ type: PlayerProfileDto })
  @ApiBadRequestResponse()
  @ApiTooManyRequestsResponse()
  async upload(@Param('id', ParseUUIDPipe) id: string, @Body() input: UploadPlayerPhotoDto, @Req() request: AccessRequest, @Res({ passthrough: true }) response: Response): Promise<PlayerProfileDto> {
    if (!await this.limiter.within('photo', request.accessContext!.identityId, 15)) {
      response.setHeader('Retry-After', '900');
      throw new HttpException('Too many requests.', 429);
    }
    return this.profiles.upload(id, input.data, request.accessContext!);
  }

  @Delete(':id/photo')
  @UseGuards(CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
  @ApiOkResponse({ type: PlayerProfileDto })
  removePhoto(@Param('id', ParseUUIDPipe) id: string, @Req() request: AccessRequest): Promise<PlayerProfileDto> {
    return this.profiles.removePhoto(id, request.accessContext!);
  }

  @Get(':id/photo')
  @ApiProduces('image/jpeg')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async photo(@Param('id', ParseUUIDPipe) id: string, @Req() request: AccessRequest, @Res() response: Response): Promise<void> {
    const bytes = await this.profiles.photo(id, request.accessContext!);
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(Buffer.from(bytes));
  }
}
