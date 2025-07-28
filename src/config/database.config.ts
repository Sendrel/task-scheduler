import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Task } from '../modules/tasks/entities/task.entity';
import { User } from '../modules/users/entities/user.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  console.log(configService.get<string>('DATABASE_URL'), 'Database url');
  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [Task, User, Notification],
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    ssl:
      configService.get<string>('NODE_ENV') === 'production'
        ? { rejectUnauthorized: false }
        : false,
    logging: configService.get<string>('NODE_ENV') === 'development',
  };
};
