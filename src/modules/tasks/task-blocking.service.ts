import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TaskBlockingService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  /**
   * Add a blocking relationship between tasks
   * @param blockingTaskId - The task that will block
   * @param blockedTaskId - The task that will be blocked
   * @param userId - The user ID for authorization
   */
  async addBlockingRelationship(
    blockingTaskId: number,
    blockedTaskId: number,
    userId: number,
  ): Promise<void> {
    // Validate that both tasks exist and belong to the user
    const [blockingTask, blockedTask] = await Promise.all([
      this.taskRepository.findOne({
        where: { id: blockingTaskId, userId },
        relations: ['blocks'],
      }),
      this.taskRepository.findOne({
        where: { id: blockedTaskId, userId },
        relations: ['blockedBy'],
      }),
    ]);

    if (!blockingTask) {
      throw new NotFoundException(
        `Blocking task with ID ${blockingTaskId} not found`,
      );
    }

    if (!blockedTask) {
      throw new NotFoundException(
        `Blocked task with ID ${blockedTaskId} not found`,
      );
    }

    if (blockingTaskId === blockedTaskId) {
      throw new BadRequestException('A task cannot block itself');
    }

    const existingRelationship = blockingTask.blocks.some(
      (task) => task.id === blockedTaskId,
    );

    if (existingRelationship) {
      throw new BadRequestException(
        'This blocking relationship already exists',
      );
    }

    await this.validateNoCircularBlocking(
      blockingTaskId,
      blockedTaskId,
      userId,
    );

    await this.validateBlockingRules(blockingTask, blockedTask, userId);

    blockingTask.blocks.push(blockedTask);
    await this.taskRepository.save(blockingTask);
  }

  /**
   * Remove a blocking relationship between tasks
   */
  async removeBlockingRelationship(
    blockingTaskId: number,
    blockedTaskId: number,
    userId: number,
  ): Promise<void> {
    const blockingTask = await this.taskRepository.findOne({
      where: { id: blockingTaskId, userId },
      relations: ['blocks'],
    });

    if (!blockingTask) {
      throw new NotFoundException(
        `Blocking task with ID ${blockingTaskId} not found`,
      );
    }

    blockingTask.blocks = blockingTask.blocks.filter(
      (task) => task.id !== blockedTaskId,
    );

    await this.taskRepository.save(blockingTask);
  }

  /**
   * Get all tasks that are blocking a specific task
   */
  async getBlockingTasks(taskId: number, userId: number): Promise<Task[]> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
      relations: ['blockedBy'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return task.blockedBy;
  }

  /**
   * Get all tasks that are blocked by a specific task
   */
  async getBlockedTasks(taskId: number, userId: number): Promise<Task[]> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
      relations: ['blocks'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return task.blocks;
  }

  /**
   * Check if a task can be completed (not blocked by incomplete tasks)
   */
  async validateTaskCanBeCompleted(
    taskId: number,
    userId: number,
  ): Promise<void> {
    const blockingTasks = await this.getBlockingTasks(taskId, userId);

    const incompleteBlockingTasks = blockingTasks.filter(
      (task) => !task.completed,
    );

    if (incompleteBlockingTasks.length > 0) {
      const blockingTaskTitles = incompleteBlockingTasks
        .map((task) => task.title)
        .join(', ');

      throw new BadRequestException(
        `Cannot complete task. The following tasks are blocking it and must be completed first: ${blockingTaskTitles}`,
      );
    }
  }

  /**
   * Check if a task is available to start (not blocked by incomplete tasks)
   */
  async isTaskAvailableToStart(
    taskId: number,
    userId: number,
  ): Promise<boolean> {
    const blockingTasks = await this.getBlockingTasks(taskId, userId);
    return blockingTasks.every((task) => task.completed);
  }

  /**
   * Get all available tasks (not blocked by incomplete tasks)
   */
  async getAvailableTasks(userId: number): Promise<Task[]> {
    const userTasks = await this.taskRepository.find({
      where: { userId, completed: false },
      relations: ['blockedBy'],
    });

    return userTasks.filter((task) =>
      task.blockedBy.every((blockingTask) => blockingTask.completed),
    );
  }

  /**
   * Get task dependency chain (what blocks this task, what it blocks)
   */
  async getTaskDependencyChain(
    taskId: number,
    userId: number,
  ): Promise<{
    task: Task;
    blockedBy: Task[];
    blocks: Task[];
    isAvailable: boolean;
  }> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
      relations: ['blockedBy', 'blocks'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const isAvailable = task.blockedBy.every(
      (blockingTask) => blockingTask.completed,
    );

    return {
      task,
      blockedBy: task.blockedBy,
      blocks: task.blocks,
      isAvailable,
    };
  }

  /**
   * Validate that creating a blocking relationship won't create circular dependencies
   */
  private async validateNoCircularBlocking(
    blockingTaskId: number,
    blockedTaskId: number,
    userId: number,
  ): Promise<void> {
    // Check if the blocked task would eventually block the blocking task
    const wouldCreateCircle = await this.doesTaskEventuallyBlock(
      blockedTaskId,
      blockingTaskId,
      userId,
      new Set(),
    );

    if (wouldCreateCircle) {
      throw new BadRequestException(
        'Cannot create blocking relationship: this would create a circular dependency',
      );
    }
  }

  /**
   * Recursively check if taskA eventually blocks taskB
   */
  private async doesTaskEventuallyBlock(
    taskAId: number,
    taskBId: number,
    userId: number,
    visited: Set<number>,
  ): Promise<boolean> {
    if (visited.has(taskAId)) {
      return false; // Already visited, avoid infinite recursion
    }

    visited.add(taskAId);

    const taskA = await this.taskRepository.findOne({
      where: { id: taskAId, userId },
      relations: ['blocks'],
    });

    if (!taskA) {
      return false;
    }

    if (taskA.blocks.some((blockedTask) => blockedTask.id === taskBId)) {
      return true;
    }

    for (const blockedTask of taskA.blocks) {
      const eventuallyBlocks = await this.doesTaskEventuallyBlock(
        blockedTask.id,
        taskBId,
        userId,
        new Set(visited),
      );
      if (eventuallyBlocks) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate that tasks don't have a hierarchical relationship that would conflict with blocking
   */
  private async validateNoHierarchyConflict(
    blockingTaskId: number,
    blockedTaskId: number,
    userId: number,
  ): Promise<void> {
    const isParentBlocking = await this.isAncestor(
      blockingTaskId,
      blockedTaskId,
      userId,
    );
    if (isParentBlocking) {
      throw new BadRequestException(
        'Parent tasks cannot block their child tasks. The hierarchy already establishes this dependency.',
      );
    }

    const isChildBlocking = await this.isAncestor(
      blockedTaskId,
      blockingTaskId,
      userId,
    );
    if (isChildBlocking) {
      throw new BadRequestException(
        'Child tasks cannot block their parent tasks. The hierarchy already establishes that parents depend on children.',
      );
    }
  }

  /**
   * Check if taskA is an ancestor (parent, grandparent, etc.) of taskB
   */
  private async isAncestor(
    taskAId: number,
    taskBId: number,
    userId: number,
  ): Promise<boolean> {
    const taskB = await this.taskRepository.findOne({
      where: { id: taskBId, userId },
      relations: ['parentTask'],
    });

    if (!taskB || !taskB.parentTask) {
      return false;
    }

    if (taskB.parentTask.id === taskAId) {
      return true;
    }

    return this.isAncestor(taskAId, taskB.parentTask.id, userId);
  }

  /**
   * Validate business rules for blocking relationships
   */
  private async validateBlockingRules(
    blockingTask: Task,
    blockedTask: Task,
    userId: number,
  ): Promise<void> {
    // Rule 1: Completed tasks cannot be used as blocking tasks
    if (blockingTask.completed) {
      throw new BadRequestException(
        'Completed tasks cannot be used to block other tasks',
      );
    }

    // Rule 2: Recurring task instances cannot block or be blocked
    if (blockingTask.parentRecurrencyId) {
      throw new BadRequestException(
        'Recurring task instances cannot block other tasks',
      );
    }

    if (blockedTask.parentRecurrencyId) {
      throw new BadRequestException(
        'Recurring task instances cannot be blocked by other tasks',
      );
    }

    // Rule 3: Recurring parent tasks cannot block or be blocked
    if (blockingTask.recurrencePattern) {
      throw new BadRequestException(
        'Recurring parent tasks cannot block other tasks',
      );
    }

    if (blockedTask.recurrencePattern) {
      throw new BadRequestException(
        'Recurring parent tasks cannot be blocked by other tasks',
      );
    }

    // Rule 4: Hierarchy relationship validation
    await this.validateNoHierarchyConflict(
      blockingTask.id,
      blockedTask.id,
      userId,
    );

    // Rule 5: Validate logical scheduling (blocking task should generally be scheduled before blocked task)
    if (blockingTask.scheduledTime > blockedTask.scheduledTime) {
      throw new BadRequestException(
        'Warning: The blocking task is scheduled after the blocked task. This may not make logical sense.',
      );
    }
  }
}
