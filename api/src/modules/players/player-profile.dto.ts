import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PlayerProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ minimum: 0, maximum: 10 })
  rating!: number;
  @ApiProperty()
  isOwnProfile!: boolean;
  @ApiProperty()
  canEdit!: boolean;
  @ApiPropertyOptional({ description: 'Private photo endpoint; requires an active group session.' })
  photoUrl?: string;
}
export class UpdatePlayerProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
export class UploadPlayerPhotoDto {
  @ApiProperty({ description: 'Base64 JPEG or PNG bytes, at most 2 MiB decoded. No data URL prefix.', maxLength: 2796204, writeOnly: true })
  @IsString()
  @MinLength(4)
  @MaxLength(2796204)
  data!: string;
}
