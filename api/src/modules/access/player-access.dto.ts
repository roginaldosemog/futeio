import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RedeemPlayerLinkDto {
  @ApiProperty({ minLength: 43, maxLength: 43, writeOnly: true })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class PlayerAccessLinkDto {
  @ApiProperty({ description: 'Personal access credential returned once; previous links and sessions are revoked.' })
  accessUrl!: string;
}
