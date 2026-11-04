import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AccessRequest } from '../access/access-context';
import { AdminGuard } from '../access/admin.guard';
import { CsrfGuard } from '../access/csrf.guard';
import { MemberGuard } from '../access/member.guard';
import { CreatePlayerService } from './create-player.service';
import { CreatePlayerDto, CreatePlayerResponseDto, PlayerSummaryDto } from './players.dto';

@ApiTags('Players')
@ApiCookieAuth('session')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@Controller('players')
@UseGuards(MemberGuard)
export class PlayersController {
  constructor(private readonly players: CreatePlayerService) {}

  @Post()
  @UseGuards(AdminGuard, CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiCreatedResponse({ type: CreatePlayerResponseDto })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  create(@Body() input: CreatePlayerDto, @Req() request: AccessRequest): Promise<CreatePlayerResponseDto> {
    return this.players.create(input, request.accessContext!);
  }

  @Get()
  @ApiOkResponse({ type: PlayerSummaryDto, isArray: true })
  list(@Req() request: AccessRequest): Promise<PlayerSummaryDto[]> {
    return this.players.list(request.accessContext!);
  }
}
