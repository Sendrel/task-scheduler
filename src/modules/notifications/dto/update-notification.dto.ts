import { IsOptional, IsBoolean } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @IsBoolean()
  @IsOptional()
  isSent?: boolean;
}
