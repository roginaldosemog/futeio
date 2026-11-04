import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class EvaluatePlayerDto {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10 })
  @IsInt()
  @Min(0)
  @Max(10)
  rating!: number;
}

export class EvaluationRowDto {
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10 })
  rating!: number;
  @ApiProperty()
  isOwn!: boolean;
  @ApiPropertyOptional({ description: 'Only the administrator or the author receives the author name.' })
  authorName?: string;
}

export class PlayerEvaluationsDto {
  @ApiProperty({ type: EvaluationRowDto, isArray: true })
  evaluations!: EvaluationRowDto[];
  @ApiProperty({ minimum: 0, maximum: 10 })
  rating!: number;
  @ApiProperty({ type: 'integer', minimum: 1 })
  evaluationCount!: number;
  @ApiProperty({ type: 'integer', enum: [0, 1, 2] })
  discardedPerSide!: number;
  @ApiProperty()
  calculationVersion!: string;
}
