import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  scheduledTime: Date;

  @Column({ default: false })
  completed: boolean;

  // Recurrence fields

  @Column({
    type: 'enum',
    enum: RecurrencePattern,
    nullable: true,
  })
  recurrencePattern: RecurrencePattern;

  @Column({ nullable: true })
  recurrenceInterval: number; // Every X days/weeks/months

  @Column({ nullable: true })
  recurrenceEndDate: Date;

  // Recurring task relationship (for task instances linking to their template)
  @Column({ nullable: true })
  parentRecurrencyId: number | null;

  @ManyToOne(() => Task, (task) => task.recurrenceInstances, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentRecurrencyId' })
  parentRecurringTask: Task;

  @OneToMany(() => Task, (task) => task.parentRecurringTask)
  recurrenceInstances: Task[];

  // Task hierarchy relationship (for parent-child task organization)
  @Column({ nullable: true })
  parentTaskId: number | null;

  @ManyToOne(() => Task, (task) => task.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentTaskId' })
  parentTask: Task;

  @OneToMany(() => Task, (task) => task.parentTask)
  children: Task[];

  // Task blocking relationships
  @ManyToMany(() => Task, (task) => task.blockedBy, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'task_blocks',
    joinColumn: { name: 'blockingTaskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'blockedTaskId', referencedColumnName: 'id' },
  })
  blocks: Task[]; // Tasks that this task blocks

  @ManyToMany(() => Task, (task) => task.blocks, { onDelete: 'CASCADE' })
  blockedBy: Task[]; // Tasks that block this task

  @ManyToOne(() => User, (user) => user.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
