/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
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
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({
    status: 201,
    description: 'Notification successfully created',
    example: {
      id: 1,
      type: 'task_reminder',
      title: 'Task Reminder',
      message: 'You have a task scheduled for this time',
      priority: 'medium',
      isRead: false,
      scheduledFor: '2024-01-15T14:00:00Z',
      isSent: false,
      userId: 1,
      taskId: 5,
      metadata: { urgencyLevel: 'high', category: 'work' },
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T10:00:00Z',
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @GetUser() user: User,
  ) {
    return this.notificationsService.create(createNotificationDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications with optional filters' })
  @ApiQuery({ type: NotificationFilterDto })
  @ApiResponse({
    status: 200,
    description: 'List of notifications with pagination',
    example: {
      notifications: [
        {
          id: 1,
          type: 'task_reminder',
          title: 'Task Reminder',
          message: 'You have a task scheduled for this time',
          priority: 'medium',
          isRead: false,
          scheduledFor: '2024-01-15T14:00:00Z',
          isSent: false,
          userId: 1,
          taskId: 5,
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
          task: {
            id: 5,
            title: 'Complete project documentation',
            scheduledTime: '2024-01-15T14:30:00Z',
          },
        },
        {
          id: 2,
          type: 'task_completed',
          title: 'Task Completed',
          message: 'Task "Review API endpoints" has been completed',
          priority: 'low',
          isRead: true,
          scheduledFor: null,
          isSent: true,
          userId: 1,
          taskId: 3,
          createdAt: '2024-01-09T15:30:00Z',
          updatedAt: '2024-01-12T09:15:00Z',
          task: {
            id: 3,
            title: 'Review API endpoints',
            scheduledTime: '2024-01-12T10:00:00Z',
          },
        },
      ],
      total: 15,
    },
  })
  findAll(@Query() filterDto: NotificationFilterDto, @GetUser() user: User) {
    return this.notificationsService.findAll(user.id, filterDto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  @ApiResponse({
    status: 200,
    description: 'Number of unread notifications',
    example: 7,
  })
  getUnreadCount(@GetUser() user: User) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.notificationsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiResponse({
    status: 200,
    description: 'Notification successfully updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @GetUser() user: User,
  ) {
    return this.notificationsService.update(id, user.id, updateNotificationDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  markAsRead(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  markAllAsRead(@GetUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  remove(@Param('id', ParseIntPipe) id: number, @GetUser() user: User) {
    return this.notificationsService.remove(id, user.id);
  }
}
