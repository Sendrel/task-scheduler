import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.TASK_REMINDER,
    enumName: 'NotificationType',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Task Reminder',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification message content',
    example: 'You have a task scheduled for this time',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Priority level of the notification',
    enum: NotificationPriority,
    example: NotificationPriority.MEDIUM,
    default: NotificationPriority.MEDIUM,
    enumName: 'NotificationPriority',
  })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'When the notification should be sent',
    example: '2024-01-15T10:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  scheduledFor?: Date;

  @ApiPropertyOptional({
    description: 'Related task ID',
    example: 1,
  })
  @IsNumber()
  @IsOptional()
  taskId?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
    example: { urgencyLevel: 'high', category: 'work' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
