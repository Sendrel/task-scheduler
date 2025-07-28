/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  ParseBoolPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto/update-task.dto';
import { Task } from './entities/task.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new task',
    description:
      'Creates a new task with optional recurrence pattern, parent task relationship, and scheduling',
  })
  @ApiBody({
    type: CreateTaskDto,
    examples: {
      regularTask: {
        summary: 'Regular Task',
        description: 'A simple one-time task',
        value: {
          title: 'Complete project documentation',
          description:
            'Write comprehensive documentation for the task scheduler API',
          scheduledTime: '2024-01-15T14:30:00Z',
        },
      },
      childTask: {
        summary: 'Child Task (Subtask)',
        description: 'A task that belongs to a parent task',
        value: {
          title: 'Review API endpoints section',
          description: 'Review and update the API endpoints documentation',
          scheduledTime: '2024-01-14T10:00:00Z',
          parentTaskId: 5,
        },
      },
      recurringTask: {
        summary: 'Recurring Task',
        description: 'A task that repeats on a schedule',
        value: {
          title: 'Weekly team standup',
          description: 'Weekly team meeting to discuss progress and blockers',
          scheduledTime: '2024-01-15T09:00:00Z',
          recurrencePattern: 'weekly',
          recurrenceInterval: 1,
          recurrenceEndDate: '2024-12-31T23:59:59Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Task successfully created',
    type: Task,
    example: {
      id: 1,
      title: 'Complete project documentation',
      description:
        'Write comprehensive documentation for the task scheduler API',
      scheduledTime: '2024-01-15T14:30:00Z',
      completed: false,
      recurrencePattern: null,
      recurrenceInterval: null,
      recurrenceEndDate: null,
      parentRecurrencyId: null,
      parentTaskId: null,
      userId: 1,
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or business rule violations',
    example: {
      message: [
        'title should not be empty',
        'scheduledTime must be a valid ISO 8601 date string',
      ],
      error: 'Bad Request',
      statusCode: 400,
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
    example: {
      message: 'Unauthorized',
      statusCode: 401,
    },
  })
  create(
    @Body() createTaskDto: CreateTaskDto,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.create(createTaskDto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tasks',
    description:
      'Retrieves all tasks for the authenticated user with optional completion status filter',
  })
  @ApiQuery({
    name: 'completed',
    required: false,
    description: 'Filter tasks by completion status',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'List of tasks',
    type: [Task],
    example: [
      {
        id: 1,
        title: 'Complete project documentation',
        description:
          'Write comprehensive documentation for the task scheduler API',
        scheduledTime: '2024-01-15T14:30:00Z',
        completed: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
        parentRecurrencyId: null,
        parentTaskId: null,
        userId: 1,
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-10T10:00:00Z',
      },
      {
        id: 2,
        title: 'Review API endpoints section',
        description: 'Review and update the API endpoints documentation',
        scheduledTime: '2024-01-14T10:00:00Z',
        completed: true,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
        parentRecurrencyId: null,
        parentTaskId: 1,
        userId: 1,
        createdAt: '2024-01-09T15:30:00Z',
        updatedAt: '2024-01-12T09:15:00Z',
      },
    ],
  })
  findAll(
    @Query('completed', new ParseBoolPipe({ optional: true }))
    completed: boolean | undefined,
    @GetUser() user: User,
  ): Promise<Task[]> {
    if (completed !== undefined) {
      return this.tasksService.findByStatus(completed, user);
    }
    return this.tasksService.findAll(user);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Get task hierarchy tree',
    description:
      'Retrieves all tasks organized in a hierarchical tree structure showing parent-child relationships',
  })
  @ApiResponse({
    status: 200,
    description: 'Hierarchical tree of tasks',
    type: [Task],
    example: [
      {
        id: 1,
        title: 'Complete project documentation',
        description:
          'Write comprehensive documentation for the task scheduler API',
        scheduledTime: '2024-01-15T14:30:00Z',
        completed: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
        parentRecurrencyId: null,
        parentTaskId: null,
        userId: 1,
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-10T10:00:00Z',
        children: [
          {
            id: 2,
            title: 'Review API endpoints section',
            description: 'Review and update the API endpoints documentation',
            scheduledTime: '2024-01-14T10:00:00Z',
            completed: true,
            parentTaskId: 1,
            userId: 1,
            createdAt: '2024-01-09T15:30:00Z',
            updatedAt: '2024-01-12T09:15:00Z',
            children: [],
          },
        ],
      },
    ],
  })
  getTaskTree(@GetUser() user: User): Promise<Task[]> {
    return this.tasksService.getTaskTree(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific task',
    description:
      'Retrieves detailed information about a specific task including relationships',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task details',
    type: Task,
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.findOne(id, user);
  }

  @Get(':id/instances')
  @ApiOperation({
    summary: 'Get recurring task instances',
    description: 'Retrieves all instances of a recurring task',
  })
  @ApiParam({ name: 'id', description: 'Parent recurring task ID' })
  @ApiResponse({
    status: 200,
    description: 'List of task instances',
    type: [Task],
  })
  getRecurringTaskInstances(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task[]> {
    return this.tasksService.getRecurringTaskInstances(id, user);
  }

  @Get(':id/children')
  @ApiOperation({
    summary: 'Get child tasks',
    description: 'Retrieves all direct child tasks of a parent task',
  })
  @ApiParam({ name: 'id', description: 'Parent task ID' })
  @ApiResponse({
    status: 200,
    description: 'List of child tasks',
    type: [Task],
  })
  getChildTasks(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task[]> {
    return this.tasksService.getChildTasks(id, user);
  }

  @Get(':id/hierarchy')
  @ApiOperation({
    summary: 'Get complete task hierarchy',
    description:
      'Retrieves a task with all its descendants in a hierarchical structure',
  })
  @ApiParam({ name: 'id', description: 'Root task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task with complete hierarchy',
    type: Task,
  })
  getTaskHierarchy(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.getTaskHierarchy(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a task',
    description:
      'Updates task details including scheduling, completion status, and relationships',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({
    status: 200,
    description: 'Task successfully updated',
    type: Task,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or business rule violations',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.update(id, updateTaskDto, user);
  }

  @Patch(':id/move')
  @ApiOperation({
    summary: 'Move task in hierarchy',
    description:
      'Moves a task to a different parent or removes it from hierarchy',
  })
  @ApiParam({ name: 'id', description: 'Task ID to move' })
  @ApiBody({
    schema: {
      properties: {
        parentTaskId: {
          type: 'number',
          nullable: true,
          description: 'New parent task ID, or null to remove from hierarchy',
          example: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Task successfully moved',
    type: Task,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - would create circular dependency or other violations',
  })
  moveTask(
    @Param('id', ParseIntPipe) id: number,
    @Body('parentTaskId') parentTaskId: number | null,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.moveTask(id, parentTaskId, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a task',
    description:
      "Deletes a task and all its instances if it's a recurring task",
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 204,
    description: 'Task successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<void> {
    return this.tasksService.remove(id, user);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark task as completed',
    description:
      'Marks a task as completed with validation for dependencies and children',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task marked as completed',
    type: Task,
  })
  @ApiResponse({
    status: 400,
    description:
      'Cannot complete task due to incomplete dependencies or children',
  })
  markAsCompleted(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.markAsCompleted(id, user);
  }

  @Patch(':id/incomplete')
  @ApiOperation({
    summary: 'Mark task as incomplete',
    description: 'Marks a task as incomplete',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task marked as incomplete',
    type: Task,
  })
  markAsIncomplete(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task> {
    return this.tasksService.markAsIncomplete(id, user);
  }

  @Post(':id/block/:blockedTaskId')
  @ApiOperation({
    summary: 'Create task blocking relationship',
    description:
      'Creates a blocking relationship where one task must be completed before another can start',
  })
  @ApiParam({ name: 'id', description: 'Blocking task ID' })
  @ApiParam({ name: 'blockedTaskId', description: 'Blocked task ID' })
  @ApiResponse({
    status: 201,
    description: 'Blocking relationship created',
  })
  @ApiResponse({
    status: 400,
    description:
      'Cannot create blocking relationship - would create circular dependency or violate rules',
  })
  addBlockingRelationship(
    @Param('id', ParseIntPipe) blockingTaskId: number,
    @Param('blockedTaskId', ParseIntPipe) blockedTaskId: number,
    @GetUser() user: User,
  ): Promise<void> {
    return this.tasksService.addBlockingRelationship(
      blockingTaskId,
      blockedTaskId,
      user,
    );
  }

  @Delete(':id/block/:blockedTaskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove task blocking relationship',
    description: 'Removes a blocking relationship between two tasks',
  })
  @ApiParam({ name: 'id', description: 'Blocking task ID' })
  @ApiParam({ name: 'blockedTaskId', description: 'Blocked task ID' })
  @ApiResponse({
    status: 204,
    description: 'Blocking relationship removed',
  })
  removeBlockingRelationship(
    @Param('id', ParseIntPipe) blockingTaskId: number,
    @Param('blockedTaskId', ParseIntPipe) blockedTaskId: number,
    @GetUser() user: User,
  ): Promise<void> {
    return this.tasksService.removeBlockingRelationship(
      blockingTaskId,
      blockedTaskId,
      user,
    );
  }

  @Get(':id/blocking')
  @ApiOperation({
    summary: 'Get tasks that block this task',
    description:
      'Retrieves all tasks that must be completed before this task can start',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'List of blocking tasks',
    type: [Task],
  })
  getBlockingTasks(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task[]> {
    return this.tasksService.getBlockingTasks(id, user);
  }

  @Get(':id/blocked')
  @ApiOperation({
    summary: 'Get tasks blocked by this task',
    description: 'Retrieves all tasks that are blocked by this task',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'List of blocked tasks',
    type: [Task],
  })
  getBlockedTasks(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<Task[]> {
    return this.tasksService.getBlockedTasks(id, user);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Get available tasks',
    description:
      'Retrieves all tasks that are not blocked by incomplete dependencies and can be started',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available tasks',
    type: [Task],
  })
  getAvailableTasks(@GetUser() user: User): Promise<Task[]> {
    return this.tasksService.getAvailableTasks(user);
  }

  @Get(':id/dependencies')
  @ApiOperation({
    summary: 'Get task dependency information',
    description:
      'Retrieves complete dependency information for a task including what blocks it and what it blocks',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task dependency information',
    schema: {
      properties: {
        task: { $ref: '#/components/schemas/Task' },
        blockedBy: {
          type: 'array',
          items: { $ref: '#/components/schemas/Task' },
        },
        blocks: {
          type: 'array',
          items: { $ref: '#/components/schemas/Task' },
        },
        isAvailable: { type: 'boolean' },
      },
    },
    example: {
      task: {
        id: 3,
        title: 'Deploy to production',
        description: 'Deploy the application to production environment',
        scheduledTime: '2024-01-16T16:00:00Z',
        completed: false,
        userId: 1,
        createdAt: '2024-01-10T14:20:00Z',
        updatedAt: '2024-01-10T14:20:00Z',
      },
      blockedBy: [
        {
          id: 1,
          title: 'Complete project documentation',
          scheduledTime: '2024-01-15T14:30:00Z',
          completed: false,
          userId: 1,
        },
        {
          id: 4,
          title: 'Run all tests',
          scheduledTime: '2024-01-15T12:00:00Z',
          completed: true,
          userId: 1,
        },
      ],
      blocks: [
        {
          id: 5,
          title: 'Send deployment notification',
          scheduledTime: '2024-01-16T17:00:00Z',
          completed: false,
          userId: 1,
        },
      ],
      isAvailable: false,
    },
  })
  getTaskDependencyChain(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<{
    task: Task;
    blockedBy: Task[];
    blocks: Task[];
    isAvailable: boolean;
  }> {
    return this.tasksService.getTaskDependencyChain(id, user);
  }

  @Get(':id/available')
  @ApiOperation({
    summary: 'Check if task is available to start',
    description:
      'Checks whether a task can be started (not blocked by incomplete dependencies)',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Whether task is available to start',
    schema: { type: 'boolean' },
  })
  isTaskAvailableToStart(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<boolean> {
    return this.tasksService.isTaskAvailableToStart(id, user);
  }
}
