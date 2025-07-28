import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto/update-task.dto';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ScheduledNotificationService } from '../notifications/scheduled-notification.service';
import { RecurringTaskService } from './recurring-task.service';
import { TaskHierarchyService } from './task-hierarchy.service';
import { TaskBlockingService } from './task-blocking.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private notificationsService: NotificationsService,
    private scheduledNotificationService: ScheduledNotificationService,
    private recurringTaskService: RecurringTaskService,
    private taskHierarchyService: TaskHierarchyService,
    private taskBlockingService: TaskBlockingService,
  ) {}

  async create(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
    // Validate that recurring tasks cannot have children and child tasks cannot be recurring
    if (createTaskDto.recurrencePattern && createTaskDto.parentTaskId) {
      throw new BadRequestException(
        'Recurring tasks cannot be child tasks. Please create the recurring task without a parent or create a non-recurring child task.',
      );
    }

    if (createTaskDto.parentTaskId) {
      await this.taskHierarchyService.validateChildDueDate(
        new Date(createTaskDto.scheduledTime),
        createTaskDto.parentTaskId,
        user.id,
      );

      // Check if parent task is recurring - prevent adding children to recurring tasks
      const parentTask = await this.taskRepository.findOne({
        where: { id: createTaskDto.parentTaskId, userId: user.id },
      });

      if (parentTask?.recurrencePattern) {
        throw new BadRequestException(
          'Cannot add child tasks to recurring task templates. Recurring tasks cannot have children.',
        );
      }

      if (parentTask?.parentRecurrencyId) {
        throw new BadRequestException(
          'Cannot add child tasks to recurring task instances. Recurring task instances cannot have children.',
        );
      }
    }

    // If this is a recurring task, use the RecurringTaskService
    if (createTaskDto.recurrencePattern) {
      const parentTask = await this.recurringTaskService.createRecurringTask(
        createTaskDto,
        user.id,
      );

      await this.notificationsService.createTaskCreatedNotification(
        parentTask.id,
        user.id,
        parentTask.title,
      );

      return parentTask;
    }

    // Handle regular (non-recurring) tasks
    const task = this.taskRepository.create({
      ...createTaskDto,
      scheduledTime: new Date(createTaskDto.scheduledTime),
      userId: user.id,
    });

    const savedTask = await this.taskRepository.save(task);

    await this.notificationsService.createTaskCreatedNotification(
      savedTask.id,
      user.id,
      savedTask.title,
    );

    // Schedule reminders for the task (30 minutes, 10 minutes, 5 minutes before)
    await this.scheduledNotificationService.scheduleRemindersForTask(savedTask);

    return savedTask;
  }

  async findAll(user: User): Promise<Task[]> {
    return this.taskRepository.find({
      where: { userId: user.id },
      order: { scheduledTime: 'ASC' },
    });
  }

  async findOne(id: number, user: User): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id, userId: user.id },
      relations: [
        'parentTask',
        'children',
        'parentRecurringTask',
        'blocks',
        'blockedBy',
      ], // Include hierarchy, recurrency, and blocking relations
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async update(
    id: number,
    updateTaskDto: UpdateTaskDto,
    user: User,
  ): Promise<Task> {
    const task = await this.findOne(id, user);

    // Validate that recurring tasks cannot have hierarchy relationships
    if (updateTaskDto.recurrencePattern && task.parentTaskId) {
      throw new BadRequestException(
        'Cannot convert child task to recurring. Please remove parent relationship first.',
      );
    }

    if (updateTaskDto.recurrencePattern && task.children?.length > 0) {
      throw new BadRequestException(
        'Cannot convert task with children to recurring. Please remove children first.',
      );
    }

    if (updateTaskDto.parentTaskId && task.recurrencePattern) {
      throw new BadRequestException(
        'Cannot add parent to recurring task. Recurring tasks cannot be child tasks.',
      );
    }

    if (updateTaskDto.completed === true && !task.completed) {
      await this.taskHierarchyService.validateParentCompletion(id, user.id);
      await this.taskBlockingService.validateTaskCanBeCompleted(id, user.id);
    }

    if (updateTaskDto.parentTaskId !== undefined) {
      if (updateTaskDto.parentTaskId !== null) {
        // Check if target parent is recurring - prevent adding children to recurring tasks
        const parentTask = await this.taskRepository.findOne({
          where: { id: updateTaskDto.parentTaskId, userId: user.id },
        });

        if (parentTask?.recurrencePattern) {
          throw new BadRequestException(
            'Cannot add child tasks to recurring task templates. Recurring tasks cannot have children.',
          );
        }

        if (parentTask?.parentRecurrencyId) {
          throw new BadRequestException(
            'Cannot add child tasks to recurring task instances. Recurring task instances cannot have children.',
          );
        }
        // Validate circular dependency
        await this.taskHierarchyService.validateNoCircularDependency(
          id,
          updateTaskDto.parentTaskId,
          user.id,
        );
        // Validate due date constraint
        const newScheduledTime = updateTaskDto.scheduledTime
          ? new Date(updateTaskDto.scheduledTime)
          : task.scheduledTime;
        await this.taskHierarchyService.validateChildDueDate(
          newScheduledTime,
          updateTaskDto.parentTaskId,
          user.id,
        );
      }
    } else if (updateTaskDto.scheduledTime && task.parentTaskId) {
      await this.taskHierarchyService.validateChildDueDate(
        new Date(updateTaskDto.scheduledTime),
        task.parentTaskId,
        user.id,
      );
    }

    if (task.recurrencePattern && task.parentRecurrencyId === null) {
      return await this.recurringTaskService.updateRecurringTask(
        id,
        {
          ...updateTaskDto,
          scheduledTime: updateTaskDto.scheduledTime
            ? new Date(updateTaskDto.scheduledTime)
            : undefined,
          recurrenceEndDate: updateTaskDto.recurrenceEndDate
            ? new Date(updateTaskDto.recurrenceEndDate)
            : undefined,
        },
        user.id,
      );
    }

    // Handle regular task updates
    const wasCompleted = task.completed;

    Object.assign(task, updateTaskDto);
    if (updateTaskDto.scheduledTime) {
      task.scheduledTime = new Date(updateTaskDto.scheduledTime);
    }

    const updatedTask = await this.taskRepository.save(task);

    // If task was marked as completed
    if (!wasCompleted && updateTaskDto.completed === true) {
      await this.notificationsService.createTaskCompletedNotification(
        updatedTask.id,
        user.id,
        updatedTask.title,
      );

      // Trigger smart generation for recurring task instances
      await this.recurringTaskService.onTaskInstanceCompleted(updatedTask);

      // Check if parent tasks should be auto-completed
      await this.taskHierarchyService.checkAndCompleteParentTasks(id, user.id);
    }

    // If scheduled time was updated, reschedule reminders
    if (updateTaskDto.scheduledTime && !updatedTask.completed) {
      await this.scheduledNotificationService.scheduleRemindersForTask(
        updatedTask,
      );
    }

    return updatedTask;
  }

  async remove(id: number, user: User): Promise<void> {
    const task = await this.findOne(id, user);

    // If this is a recurring parent task, use RecurringTaskService
    if (task.recurrencePattern && task.parentRecurrencyId === null) {
      await this.recurringTaskService.deleteRecurringTask(id, user.id);
      return;
    }

    // Handle regular task deletion
    await this.taskRepository.remove(task);
  }

  async findByStatus(completed: boolean, user: User): Promise<Task[]> {
    return this.taskRepository.find({
      where: { completed, userId: user.id },
      order: { scheduledTime: 'ASC' },
    });
  }

  async markAsCompleted(id: number, user: User): Promise<Task> {
    // Validate that parent task can be completed (all children must be complete)
    await this.taskHierarchyService.validateParentCompletion(id, user.id);

    // Validate that task is not blocked by incomplete tasks
    await this.taskBlockingService.validateTaskCanBeCompleted(id, user.id);

    const result = await this.update(id, { completed: true }, user);

    // Check if parent tasks should be auto-completed
    await this.taskHierarchyService.checkAndCompleteParentTasks(id, user.id);

    return result;
  }

  async markAsIncomplete(id: number, user: User): Promise<Task> {
    return this.update(id, { completed: false }, user);
  }

  async getRecurringTaskInstances(
    parentRecurrencyId: number,
    user: User,
  ): Promise<Task[]> {
    return this.recurringTaskService.getTaskInstances(
      parentRecurrencyId,
      user.id,
    );
  }

  // New hierarchy methods
  async getChildTasks(parentTaskId: number, user: User): Promise<Task[]> {
    return this.taskHierarchyService.getChildTasks(parentTaskId, user.id);
  }

  async getTaskHierarchy(taskId: number, user: User): Promise<Task> {
    return this.taskHierarchyService.getTaskHierarchy(taskId, user.id);
  }

  async moveTask(
    taskId: number,
    newParentTaskId: number | null,
    user: User,
  ): Promise<Task> {
    return this.taskHierarchyService.moveTask(taskId, newParentTaskId, user.id);
  }

  async getTaskTree(user: User): Promise<Task[]> {
    return this.taskHierarchyService.getTaskTree(user.id);
  }

  // Task blocking methods
  async addBlockingRelationship(
    blockingTaskId: number,
    blockedTaskId: number,
    user: User,
  ): Promise<void> {
    return this.taskBlockingService.addBlockingRelationship(
      blockingTaskId,
      blockedTaskId,
      user.id,
    );
  }

  async removeBlockingRelationship(
    blockingTaskId: number,
    blockedTaskId: number,
    user: User,
  ): Promise<void> {
    return this.taskBlockingService.removeBlockingRelationship(
      blockingTaskId,
      blockedTaskId,
      user.id,
    );
  }

  async getBlockingTasks(taskId: number, user: User): Promise<Task[]> {
    return this.taskBlockingService.getBlockingTasks(taskId, user.id);
  }

  async getBlockedTasks(taskId: number, user: User): Promise<Task[]> {
    return this.taskBlockingService.getBlockedTasks(taskId, user.id);
  }

  async getAvailableTasks(user: User): Promise<Task[]> {
    return this.taskBlockingService.getAvailableTasks(user.id);
  }

  async getTaskDependencyChain(
    taskId: number,
    user: User,
  ): Promise<{
    task: Task;
    blockedBy: Task[];
    blocks: Task[];
    isAvailable: boolean;
  }> {
    return this.taskBlockingService.getTaskDependencyChain(taskId, user.id);
  }

  async isTaskAvailableToStart(taskId: number, user: User): Promise<boolean> {
    return this.taskBlockingService.isTaskAvailableToStart(taskId, user.id);
  }
}
