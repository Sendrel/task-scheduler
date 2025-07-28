import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Task } from './entities/task.entity';

@Injectable()
export class TaskHierarchyService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  /**
   * Validate that a child task's due date is not after its parent's due date
   */
  async validateChildDueDate(
    childScheduledTime: Date,
    parentTaskId: number,
    userId: number,
  ): Promise<void> {
    const parentTask = await this.taskRepository.findOne({
      where: { id: parentTaskId, userId },
    });

    if (!parentTask) {
      throw new NotFoundException(
        `Parent task with ID ${parentTaskId} not found`,
      );
    }

    if (childScheduledTime > parentTask.scheduledTime) {
      throw new BadRequestException(
        `Child task due date (${childScheduledTime.toISOString()}) cannot be after parent task due date (${parentTask.scheduledTime.toISOString()})`,
      );
    }
  }

  /**
   * Validate that parent task assignment doesn't create a circular dependency
   */
  async validateNoCircularDependency(
    taskId: number,
    parentTaskId: number,
    userId: number,
  ): Promise<void> {
    // Check if the proposed parent is actually a descendant of the current task
    const isCircular = await this.isDescendant(parentTaskId, taskId, userId);
    if (isCircular) {
      throw new BadRequestException(
        'Cannot assign parent task: this would create a circular dependency',
      );
    }
  }

  /**
   * Check if a task is a descendant of another task
   */
  private async isDescendant(
    potentialDescendantId: number,
    ancestorId: number,
    userId: number,
  ): Promise<boolean> {
    const task = await this.taskRepository.findOne({
      where: { id: potentialDescendantId, userId },
      relations: ['parentTask'],
    });

    if (!task || !task.parentTask) {
      return false;
    }

    if (task.parentTask.id === ancestorId) {
      return true;
    }

    return this.isDescendant(task.parentTask.id, ancestorId, userId);
  }

  /**
   * Validate that a parent task cannot be completed until all children are complete
   */
  async validateParentCompletion(
    taskId: number,
    userId: number,
  ): Promise<void> {
    const incompleteChildren = await this.taskRepository.find({
      where: {
        parentTaskId: taskId,
        userId,
        completed: false,
      },
    });

    if (incompleteChildren.length > 0) {
      const childTitles = incompleteChildren
        .map((child) => child.title)
        .join(', ');
      throw new BadRequestException(
        `Cannot complete parent task. The following child tasks are still incomplete: ${childTitles}`,
      );
    }
  }

  /**
   * Auto-complete parent tasks when all children are complete
   */
  async checkAndCompleteParentTasks(
    taskId: number,
    userId: number,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
      relations: ['parentTask'],
    });

    if (!task?.parentTask || task.parentTask.completed) {
      return;
    }

    // Check if all siblings are now complete
    const siblings = await this.taskRepository.find({
      where: {
        parentTaskId: task.parentTask.id,
        userId,
      },
    });

    const allSiblingsComplete = siblings.every((sibling) => sibling.completed);

    if (allSiblingsComplete) {
      // Mark parent as complete
      await this.taskRepository.update(
        { id: task.parentTask.id, userId },
        { completed: true },
      );

      // Recursively check grandparent
      await this.checkAndCompleteParentTasks(task.parentTask.id, userId);
    }
  }

  /**
   * Get all child tasks of a parent task
   */
  async getChildTasks(parentTaskId: number, userId: number): Promise<Task[]> {
    return this.taskRepository.find({
      where: { parentTaskId, userId },
      order: { scheduledTime: 'ASC' },
    });
  }

  /**
   * Get the full task hierarchy (parent and all descendants)
   */
  async getTaskHierarchy(taskId: number, userId: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
      relations: ['children'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Recursively load children
    for (const child of task.children) {
      const childWithDescendants = await this.getTaskHierarchy(
        child.id,
        userId,
      );
      Object.assign(child, childWithDescendants);
    }

    return task;
  }

  /**
   * Move a task to a different parent (or remove parent)
   */
  async moveTask(
    taskId: number,
    newParentTaskId: number | null,
    userId: number,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Validate circular dependency if assigning a new parent
    if (newParentTaskId) {
      await this.validateNoCircularDependency(taskId, newParentTaskId, userId);
      await this.validateChildDueDate(
        task.scheduledTime,
        newParentTaskId,
        userId,
      );
    }

    // Update the task
    task.parentTaskId = newParentTaskId;
    return this.taskRepository.save(task);
  }

  /**
   * Get tasks that don't have a parent (root tasks in the hierarchy)
   */
  async getRootTasks(userId: number): Promise<Task[]> {
    return this.taskRepository.find({
      where: {
        userId,
        parentTaskId: IsNull(),
      },
      relations: ['children'],
      order: { scheduledTime: 'ASC' },
    });
  }

  /**
   * Get the complete task tree with all levels of hierarchy
   */
  async getTaskTree(userId: number): Promise<Task[]> {
    const rootTasks = await this.getRootTasks(userId);

    // Recursively load children for each root task
    for (const rootTask of rootTasks) {
      await this.loadTaskChildren(rootTask, userId);
    }

    return rootTasks;
  }

  /**
   * Recursively load children for a task
   */
  private async loadTaskChildren(task: Task, userId: number): Promise<void> {
    const children = await this.getChildTasks(task.id, userId);
    task.children = children;

    for (const child of children) {
      await this.loadTaskChildren(child, userId);
    }
  }
}
