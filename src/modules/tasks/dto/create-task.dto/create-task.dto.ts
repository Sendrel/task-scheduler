/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrencePattern } from '../../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Task title',
    example: 'Complete project documentation',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed task description',
    example: 'Write comprehensive documentation for the task scheduler API',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'When the task is scheduled to be completed',
    example: '2024-01-15T14:30:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledTime: string;

  @ApiPropertyOptional({
    description:
      'Parent task ID for creating subtasks (cannot be used with recurring tasks)',
    example: 5,
  })
  @IsNumber()
  @IsOptional()
  parentTaskId?: number;

  @ApiPropertyOptional({
    description:
      'Recurrence pattern for repeating tasks (cannot be used with parent task)',
    enum: RecurrencePattern,
    example: RecurrencePattern.WEEKLY,
    enumName: 'RecurrencePattern',
  })
  @IsEnum(RecurrencePattern)
  @IsOptional()
  recurrencePattern?: RecurrencePattern;

  @ApiPropertyOptional({
    description:
      'Interval for recurrence (required when recurrencePattern is specified)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @ValidateIf((o: CreateTaskDto) => !!o.recurrencePattern)
  recurrenceInterval?: number = 1;

  @ApiPropertyOptional({
    description:
      'When the recurrence should end (optional for recurring tasks)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  recurrenceEndDate?: string;
}
