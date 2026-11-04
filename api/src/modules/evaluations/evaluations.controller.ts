import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AccessRequest } from '../access/access-context';
import { MemberGuard } from '../access/member.guard';
import { CsrfGuard } from '../access/csrf.guard';
import { EvaluatePlayerDto, PlayerEvaluationsDto } from './evaluations.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('Evaluations')
@ApiCookieAuth('session')
@ApiBearerAuth('nativeSession')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiNotFoundResponse()
@Controller('players/:playerId/evaluations')
@UseGuards(MemberGuard)
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  @ApiOkResponse({ type: PlayerEvaluationsDto })
  table(@Param('playerId', ParseUUIDPipe) playerId: string, @Req() request: AccessRequest): Promise<PlayerEvaluationsDto> {
    return this.evaluations.table(playerId, request.accessContext!);
  }

  @Post()
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: false, description: 'Required with browser cookies; native bearer authentication does not use ambient cookies.' })
  @ApiOkResponse({ type: PlayerEvaluationsDto })
  @ApiBadRequestResponse()
  evaluate(@Param('playerId', ParseUUIDPipe) playerId: string, @Body() input: EvaluatePlayerDto, @Req() request: AccessRequest): Promise<PlayerEvaluationsDto> {
    return this.evaluations.evaluate(playerId, input.rating, request.accessContext!);
  }
}
