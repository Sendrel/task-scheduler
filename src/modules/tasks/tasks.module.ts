import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { RecurringTaskService } from './recurring-task.service';
import { TaskHierarchyService } from './task-hierarchy.service';
import { TaskBlockingService } from './task-blocking.service';
import { Task } from './entities/task.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    NotificationsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    RecurringTaskService,
    TaskHierarchyService,
    TaskBlockingService,
  ],
  exports: [
    TasksService,
    RecurringTaskService,
    TaskHierarchyService,
    TaskBlockingService,
  ],
})
export class TasksModule {}
