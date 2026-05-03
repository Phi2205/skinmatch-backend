import { NestFactory } from '@nestjs/core';
import * as swagger from '@nestjs/swagger';
const { SwaggerModule, DocumentBuilder } = swagger;

import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS Configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.use(cookieParser());


  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('SkinMatch API')
    .setDescription('The SkinMatch Backend API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Validation
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true,
    transform: true,
  }));

  // Apply interceptor globally
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
