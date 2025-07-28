/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for frontend integration
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Set global prefix for API routes
  app.setGlobalPrefix('api');

  // Configure Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Task Scheduler API')
    .setDescription(
      'A comprehensive task management system with recurring tasks, notifications, and task dependencies',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('tasks', 'Task management endpoints')
    .addTag('notifications', 'Notification management endpoints')
    .addTag('users', 'User management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `🚀 Task Scheduler API is running on: http://localhost:${port}/api`,
  );
  console.log(
    `📚 API Documentation is available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
