import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationPriority,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
    userId: number,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      userId,
    });

    return await this.notificationRepository.save(notification);
  }

  async findAll(
    userId: number,
    filterDto: NotificationFilterDto,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { page = 1, limit = 10, isRead, type, priority } = filterDto;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.task', 'task')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (priority) {
      queryBuilder.andWhere('notification.priority = :priority', { priority });
    }

    const [notifications, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { notifications, total };
  }

  async findOne(id: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
      relations: ['task'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(
    id: number,
    userId: number,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<Notification> {
    const notification = await this.findOne(id, userId);

    Object.assign(notification, updateNotificationDto);

    return await this.notificationRepository.save(notification);
  }

  async remove(id: number, userId: number): Promise<void> {
    const notification = await this.findOne(id, userId);
    await this.notificationRepository.remove(notification);
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    return await this.update(id, userId, { isRead: true });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: number): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  // Methods for creating specific notification types
  async createTaskReminderNotification(
    taskId: number,
    userId: number,
    scheduledFor: Date,
  ): Promise<Notification> {
    return await this.create(
      {
        type: NotificationType.TASK_REMINDER,
        title: 'Task Reminder',
        message: 'You have a task scheduled for this time',
        priority: NotificationPriority.MEDIUM,
        taskId,
        scheduledFor,
      },
      userId,
    );
  }

  async createTaskCreatedNotification(
    taskId: number,
    userId: number,
    taskTitle: string,
  ): Promise<Notification> {
    return await this.create(
      {
        type: NotificationType.TASK_CREATED,
        title: 'Task Created',
        message: `New task "${taskTitle}" has been created`,
        priority: NotificationPriority.LOW,
        taskId,
      },
      userId,
    );
  }

  async createTaskCompletedNotification(
    taskId: number,
    userId: number,
    taskTitle: string,
  ): Promise<Notification> {
    return await this.create(
      {
        type: NotificationType.TASK_COMPLETED,
        title: 'Task Completed',
        message: `Task "${taskTitle}" has been completed`,
        priority: NotificationPriority.MEDIUM,
        taskId,
      },
      userId,
    );
  }

  async createTaskOverdueNotification(
    taskId: number,
    userId: number,
    taskTitle: string,
  ): Promise<Notification> {
    return await this.create(
      {
        type: NotificationType.TASK_OVERDUE,
        title: 'Task Overdue',
        message: `Task "${taskTitle}" is overdue`,
        priority: NotificationPriority.HIGH,
        taskId,
      },
      userId,
    );
  }

  async getPendingScheduledNotifications(): Promise<Notification[]> {
    return await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.task', 'task')
      .leftJoinAndSelect('notification.user', 'user')
      .where('notification.isSent = :isSent', { isSent: false })
      .andWhere('notification.scheduledFor <= :now', { now: new Date() })
      .andWhere('notification.scheduledFor IS NOT NULL')
      .getMany();
  }

  async markAsSent(id: number): Promise<void> {
    await this.notificationRepository.update(id, { isSent: true });
  }

  async removeUnsentTaskReminders(taskId: number): Promise<void> {
    await this.notificationRepository.delete({
      taskId,
      type: NotificationType.TASK_REMINDER,
      isSent: false,
    });
  }
}
