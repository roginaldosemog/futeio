import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class CreatePlayerDto {
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Jogador de exemplo' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10, example: 7 })
  @IsInt()
  @Min(0)
  @Max(10)
  initialRating!: number;

  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Link this profile to the authenticated administrator identity.' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  linkToCurrentAdministrator: boolean = false;
}

export class PlayerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ minimum: 0, maximum: 10, description: 'Initial contribution in E3; consolidated rating is introduced in E6.' })
  rating!: number;
  @ApiProperty()
  isOwnProfile!: boolean;
}

export class CreatePlayerResponseDto {
  @ApiProperty({ type: PlayerSummaryDto })
  player!: PlayerSummaryDto;
  @ApiProperty({ description: 'Personal access credential, returned only at creation. Never returned in listings.' })
  accessUrl!: string;
}
