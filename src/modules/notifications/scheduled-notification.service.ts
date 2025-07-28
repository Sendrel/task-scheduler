import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

@Injectable()
export class ScheduledNotificationService {
  private readonly logger = new Logger(ScheduledNotificationService.name);

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private notificationsService: NotificationsService,
  ) {}

  // Run every minute to check for pending notifications
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingNotifications() {
    try {
      const pendingNotifications =
        await this.notificationsService.getPendingScheduledNotifications();

      for (const notification of pendingNotifications) {
        this.logger.log(
          `Sending notification: ${notification.title} to user ${notification.userId}`,
        );
        await this.notificationsService.markAsSent(notification.id);
        // TODO: Send notification to user
      }
    } catch (error) {
      this.logger.error('Error processing pending notifications:', error);
    }
  }

  // Run every 5 minutes to check for overdue tasks
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkOverdueTasks() {
    try {
      const now = new Date();
      const overdueTasks = await this.taskRepository.find({
        where: {
          scheduledTime: LessThanOrEqual(now),
          completed: false,
        },
        relations: ['user'],
      });

      for (const task of overdueTasks) {
        // Check if we already sent an overdue notification for this task
        const existingNotification = await this.notificationsService.findAll(
          task.userId,
          { type: NotificationType.TASK_OVERDUE },
        );

        const hasOverdueNotification = existingNotification.notifications.some(
          (notification) => notification.taskId === task.id,
        );

        if (!hasOverdueNotification) {
          await this.notificationsService.createTaskOverdueNotification(
            task.id,
            task.userId,
            task.title,
          );
          this.logger.log(
            `Created overdue notification for task: ${task.title}`,
          );
          // TODO: Send notification to user
        }
      }
    } catch (error) {
      this.logger.error('Error checking overdue tasks:', error);
    }
  }

  // Method to schedule task reminders
  async scheduleTaskReminder(
    taskId: number,
    userId: number,
    reminderTime: Date,
  ) {
    try {
      await this.notificationsService.createTaskReminderNotification(
        taskId,
        userId,
        reminderTime,
      );
      this.logger.log(
        `Scheduled reminder for task ${taskId} at ${reminderTime.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Error scheduling task reminder:', error);
    }
  }

  // Method to schedule reminders for tasks (can be called when tasks are created/updated)
  async scheduleRemindersForTask(
    task: Task,
    reminderMinutesBefore: number[] = [30, 10, 5],
  ) {
    // Remove any existing unsent reminder notifications for this task
    await this.notificationsService.removeUnsentTaskReminders(task.id);

    const taskTime = new Date(task.scheduledTime);

    for (const minutes of reminderMinutesBefore) {
      const reminderTime = new Date(taskTime.getTime() - minutes * 60 * 1000);

      // Only schedule if the reminder time is in the future
      if (reminderTime > new Date()) {
        await this.scheduleTaskReminder(task.id, task.userId, reminderTime);
      }
    }
  }
}
