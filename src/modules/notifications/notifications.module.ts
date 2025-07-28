import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ScheduledNotificationService } from './scheduled-notification.service';
import { Notification } from './entities/notification.entity';
import { Task } from '../tasks/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Task]),
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ScheduledNotificationService],
  exports: [NotificationsService, ScheduledNotificationService],
})
export class NotificationsModule {}
