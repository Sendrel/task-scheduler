import { IsNumber } from 'class-validator';

export class CreateBlockingRelationshipDto {
  @IsNumber()
  blockingTaskId: number;

  @IsNumber()
  blockedTaskId: number;
}

export class TaskDependencyResponseDto {
  task: {
    id: number;
    title: string;
    description?: string;
    scheduledTime: Date;
    completed: boolean;
  };

  blockedBy: Array<{
    id: number;
    title: string;
    completed: boolean;
    scheduledTime: Date;
  }>;

  blocks: Array<{
    id: number;
    title: string;
    completed: boolean;
    scheduledTime: Date;
  }>;

  isAvailable: boolean;
}
