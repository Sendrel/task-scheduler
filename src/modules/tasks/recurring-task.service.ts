import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task, RecurrencePattern } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto/create-task.dto';
import { ScheduledNotificationService } from '../notifications/scheduled-notification.service';

@Injectable()
export class RecurringTaskService {
  private readonly logger = new Logger(RecurringTaskService.name);

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private scheduledNotificationService: ScheduledNotificationService,
  ) {}

  /**
   * Get optimal buffer size (in days) based on recurrence pattern
   */
  private getOptimalBuffer(pattern: RecurrencePattern): number {
    switch (pattern) {
      case RecurrencePattern.DAILY:
        return 3; // 3 days ahead
      case RecurrencePattern.WEEKLY:
        return 14; // 2 weeks ahead
      case RecurrencePattern.MONTHLY:
        return 60; // 2 months ahead
      case RecurrencePattern.YEARLY:
        return 365; // 1 year ahead
      default:
        return 7; // default fallback
    }
  }

  /**
   * Get minimum buffer threshold (30% of optimal)
   */
  private getMinBuffer(pattern: RecurrencePattern): number {
    return Math.ceil(this.getOptimalBuffer(pattern) * 0.3);
  }

  private async countUpcomingInstances(
    parentRecurrencyId: number,
  ): Promise<number> {
    return await this.taskRepository.count({
      where: {
        parentRecurrencyId,
        completed: false,
        scheduledTime: MoreThan(new Date()),
      },
    });
  }

  private async needsMoreInstances(parentTask: Task): Promise<boolean> {
    const upcomingCount = await this.countUpcomingInstances(parentTask.id);
    const minBuffer = this.getMinBuffer(parentTask.recurrencePattern);

    this.logger.debug(
      `Task ${parentTask.id}: ${upcomingCount} upcoming instances, min buffer: ${minBuffer}`,
    );

    return upcomingCount < minBuffer;
  }

  /**
   * Generate instances for a recurring task up to optimal buffer
   */
  async generateInstancesForOptimalBuffer(parentTask: Task): Promise<void> {
    const bufferDays = this.getOptimalBuffer(parentTask.recurrencePattern);
    const bufferDate = new Date();
    bufferDate.setDate(bufferDate.getDate() + bufferDays);

    if (
      parentTask.recurrenceEndDate &&
      parentTask.recurrenceEndDate < new Date()
    ) {
      return;
    }

    const lastInstance = await this.taskRepository.findOne({
      where: { parentRecurrencyId: parentTask.id },
      order: { scheduledTime: 'DESC' },
    });

    let nextScheduledTime = this.getNextScheduledTime(
      lastInstance ? lastInstance.scheduledTime : parentTask.scheduledTime,
      parentTask.recurrencePattern,
      parentTask.recurrenceInterval || 1,
    );

    let generatedCount = 0;

    // Generate instances up to optimal buffer
    while (nextScheduledTime <= bufferDate) {
      if (
        parentTask.recurrenceEndDate &&
        nextScheduledTime > parentTask.recurrenceEndDate
      ) {
        break;
      }

      const existingInstance = await this.taskRepository.findOne({
        where: {
          parentRecurrencyId: parentTask.id,
          scheduledTime: nextScheduledTime,
        },
      });

      if (!existingInstance) {
        const newInstance = this.taskRepository.create({
          title: parentTask.title,
          description: parentTask.description,
          scheduledTime: nextScheduledTime,
          userId: parentTask.userId,
          parentRecurrencyId: parentTask.id,
        });

        const savedInstance = await this.taskRepository.save(newInstance);

        // Schedule reminders for this instance (30, 10, 5 minutes before)
        await this.scheduledNotificationService.scheduleRemindersForTask(
          savedInstance,
        );

        generatedCount++;
        this.logger.debug(
          `Created task instance: ${parentTask.title} for ${nextScheduledTime.toISOString()}`,
        );
      }

      // Calculate next occurrence
      nextScheduledTime = this.getNextScheduledTime(
        nextScheduledTime,
        parentTask.recurrencePattern,
        parentTask.recurrenceInterval || 1,
      );
    }

    if (generatedCount > 0) {
      this.logger.log(
        `Generated ${generatedCount} instances for task: ${parentTask.title}`,
      );
    }
  }

  /**
   * Daily maintenance - generate instances for all recurring tasks
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyMaintenance() {
    try {
      this.logger.log('Running daily recurring task maintenance...');

      // Find all recurring tasks that are parent tasks (not instances)
      const recurringTasks = await this.taskRepository.find({
        where: {
          recurrencePattern: Not(IsNull()),
          completed: false,
          parentRecurrencyId: IsNull(),
        },
      });

      let tasksUpdated = 0;

      for (const task of recurringTasks) {
        if (await this.needsMoreInstances(task)) {
          await this.generateInstancesForOptimalBuffer(task);
          tasksUpdated++;
        }
      }

      this.logger.log(
        `Daily maintenance completed. Updated ${tasksUpdated}/${recurringTasks.length} recurring tasks`,
      );
    } catch (error) {
      this.logger.error('Error in daily maintenance:', error);
    }
  }

  /**
   * Hourly check for tasks with low buffer
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyBufferCheck() {
    try {
      this.logger.debug('Running hourly buffer check...');

      // Find all recurring tasks that might need attention
      const recurringTasks = await this.taskRepository.find({
        where: {
          recurrencePattern: Not(IsNull()),
          completed: false,
          parentRecurrencyId: IsNull(),
        },
      });

      let lowBufferTasks = 0;

      for (const task of recurringTasks) {
        if (await this.needsMoreInstances(task)) {
          await this.generateInstancesForOptimalBuffer(task);
          lowBufferTasks++;
        }
      }

      if (lowBufferTasks > 0) {
        this.logger.log(
          `Hourly check: Generated instances for ${lowBufferTasks} tasks with low buffer`,
        );
      }
    } catch (error) {
      this.logger.error('Error in hourly buffer check:', error);
    }
  }

  /**
   * Generate instances when a task instance is completed
   */
  async onTaskInstanceCompleted(completedInstance: Task): Promise<void> {
    if (!completedInstance.parentRecurrencyId) {
      return;
    }

    try {
      const parentTask = await this.taskRepository.findOne({
        where: { id: completedInstance.parentRecurrencyId },
      });

      if (!parentTask || !parentTask.recurrencePattern) {
        return;
      }

      if (await this.needsMoreInstances(parentTask)) {
        await this.generateInstancesForOptimalBuffer(parentTask);
        this.logger.log(
          `Generated new instances after completion of: ${completedInstance.title}`,
        );
      }
    } catch (error) {
      this.logger.error('Error generating instances after completion:', error);
    }
  }

  /**
   * Calculate the next scheduled time based on recurrence pattern
   */
  private getNextScheduledTime(
    currentTime: Date,
    pattern: RecurrencePattern,
    interval: number,
  ): Date {
    const nextTime = new Date(currentTime);

    switch (pattern) {
      case RecurrencePattern.DAILY:
        nextTime.setDate(nextTime.getDate() + interval);
        break;

      case RecurrencePattern.WEEKLY:
        nextTime.setDate(nextTime.getDate() + 7 * interval);
        break;

      case RecurrencePattern.MONTHLY:
        nextTime.setMonth(nextTime.getMonth() + interval);
        break;

      case RecurrencePattern.YEARLY:
        nextTime.setFullYear(nextTime.getFullYear() + interval);
        break;

      default:
        throw new Error(`Unsupported recurrence pattern: ${pattern as string}`);
    }

    return nextTime;
  }

  /**
   * Create a recurring task and generate initial instances
   */
  async createRecurringTask(
    createTaskDto: CreateTaskDto,
    userId: number,
  ): Promise<Task> {
    const parentTask = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      scheduledTime: new Date(createTaskDto.scheduledTime),
      recurrencePattern: createTaskDto.recurrencePattern,
      recurrenceInterval: createTaskDto.recurrenceInterval || 1,
      recurrenceEndDate: createTaskDto.recurrenceEndDate
        ? new Date(createTaskDto.recurrenceEndDate)
        : undefined,
      userId,
    });

    const savedParentTask = await this.taskRepository.save(parentTask);

    // Generate initial instances using smart generation
    if (savedParentTask.recurrencePattern) {
      await this.generateInstancesForOptimalBuffer(savedParentTask);
    }

    return savedParentTask;
  }

  /**
   * Update a recurring task and regenerate instances if needed
   */
  async updateRecurringTask(
    taskId: number,
    updateData: Partial<Task>,
    userId: number,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // If this is a recurring parent task and schedule-related fields are being updated
    const scheduleFieldsUpdated =
      updateData.scheduledTime ||
      updateData.recurrencePattern ||
      updateData.recurrenceInterval ||
      updateData.recurrenceEndDate;

    if (
      task.recurrencePattern &&
      task.parentRecurrencyId === null &&
      scheduleFieldsUpdated
    ) {
      // Delete future uncompleted instances
      await this.taskRepository.delete({
        parentRecurrencyId: taskId,
        completed: false,
        scheduledTime: MoreThan(new Date()),
      });
    }

    // Update the task
    Object.assign(task, updateData);
    const updatedTask = await this.taskRepository.save(task);

    // Regenerate instances if this is a recurring parent task and schedule was updated
    if (
      task.recurrencePattern &&
      task.parentRecurrencyId === null &&
      scheduleFieldsUpdated
    ) {
      await this.generateInstancesForOptimalBuffer(updatedTask);
    }

    return updatedTask;
  }

  /**
   * Delete a recurring task and all its instances
   */
  async deleteRecurringTask(taskId: number, userId: number): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // If this is a parent recurring task, delete all instances
    if (task.recurrencePattern && task.parentRecurrencyId === null) {
      await this.taskRepository.delete({
        parentRecurrencyId: taskId,
      });
    }

    // Delete the task itself
    await this.taskRepository.remove(task);
  }

  /**
   * Get all instances of a recurring task
   */
  async getTaskInstances(
    parentRecurrencyId: number,
    userId: number,
  ): Promise<Task[]> {
    return this.taskRepository.find({
      where: {
        parentRecurrencyId,
        userId,
      },
      order: { scheduledTime: 'ASC' },
    });
  }
}
