import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security Headers
  app.use(helmet());

  // Cookie Parser for secure refresh tokens
  app.use(cookieParser());

  // Credentialed CORS with explicit configured web origin
  const webUrl = configService.getOrThrow<string>('WEB_URL');
  app.enableCors({
    origin: webUrl,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);

  logger.log(`Buildora API running on port ${port} (prefix: /api/v1)`);
  logger.log(`CORS configured for origin: ${webUrl}`);
}

bootstrap();
