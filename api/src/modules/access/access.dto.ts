import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminPasswordLoginDto {
  @ApiProperty({ example: 'admin@example.test', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ format: 'password', writeOnly: true, minLength: 1, maxLength: 256 })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
export class CsrfResponseDto {
  @ApiProperty({ description: 'CSRF header value bound to the current HttpOnly browser cookie.' })
  csrfToken!: string;
}
export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}
export class SessionResponseDto {
  @ApiProperty({ enum: ['ADMIN', 'PLAYER'] })
  role!: 'ADMIN' | 'PLAYER';
  @ApiProperty({ format: 'uuid' })
  identityId!: string;
  @ApiProperty({ format: 'uuid' })
  groupId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  playerId?: string;
  @ApiPropertyOptional({ description: 'Only the authenticated administrator’s own email.' })
  email?: string;
}

export class NativeSessionResponseDto {
  @ApiProperty({ type: SessionResponseDto })
  session!: SessionResponseDto;
  @ApiProperty({ minLength: 43, maxLength: 43, description: 'Opaque native session credential returned only at authentication. Store in native secure storage; never log or cache.', readOnly: true })
  token!: string;
}
