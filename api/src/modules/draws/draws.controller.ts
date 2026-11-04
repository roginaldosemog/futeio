import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AccessRequest } from '../access/access-context';
import { AdminGuard } from '../access/admin.guard';
import { CsrfGuard } from '../access/csrf.guard';
import { MemberGuard } from '../access/member.guard';
import { CreateDrawDto, DrawDto } from './draws.dto';
import { DrawsService } from './draws.service';

@ApiTags('Draws')
@ApiCookieAuth('session')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@UseGuards(MemberGuard)
@Controller('draws')
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Post()
  @UseGuards(AdminGuard, CsrfGuard)
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiCreatedResponse({ type: DrawDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  create(@Body() input: CreateDrawDto, @Req() request: AccessRequest): Promise<DrawDto> {
    return this.draws.create(input, request.accessContext!);
  }

  @Get()
  @ApiOkResponse({ type: DrawDto, isArray: true })
  list(@Req() request: AccessRequest): Promise<DrawDto[]> {
    return this.draws.list(request.accessContext!);
  }

  @Get(':id')
  @ApiOkResponse({ type: DrawDto })
  @ApiNotFoundResponse()
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AccessRequest): Promise<DrawDto> {
    return this.draws.get(id, request.accessContext!);
  }
}
