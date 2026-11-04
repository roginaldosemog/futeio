import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateDrawDto {
  @ApiProperty({ type: 'string', format: 'uuid', isArray: true, minItems: 20, maxItems: 20, uniqueItems: true })
  @IsArray()
  @ArrayMinSize(20)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  playerIds!: string[];

  @ApiPropertyOptional({ minLength: 1, maxLength: 64 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  seed?: string;
}

export class DrawPlayerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ minimum: 0, maximum: 10 })
  rating!: number;
}

export class DrawTeamDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 4 })
  number!: number;
  @ApiProperty({ type: DrawPlayerDto, isArray: true })
  players!: DrawPlayerDto[];
  @ApiProperty()
  total!: number;
  @ApiProperty()
  average!: number;
}

export class DrawDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty()
  seed!: string;
  @ApiProperty()
  algorithmVersion!: string;
  @ApiProperty()
  calculationVersion!: string;
  @ApiProperty({ type: DrawTeamDto, isArray: true })
  teams!: DrawTeamDto[];
  @ApiProperty()
  spread!: number;
  @ApiProperty()
  variance!: number;
}
