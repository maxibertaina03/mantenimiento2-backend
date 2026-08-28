import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FiltroExcepcionesHttp } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // El PDF de una orden viaja en base64 dentro del JSON, y el límite por
  // defecto de Express (100 kb) lo rechaza. 8 mb deja margen sin abrir la
  // puerta a payloads enormes; el DTO además valida el tamaño del base64.
  app.useBodyParser('json', { limit: '8mb' });
  const config = app.get(ConfigService);

  // ── Validación global de DTOs ──
  // whitelist: descarta props no declaradas en el DTO.
  // forbidNonWhitelisted: rechaza la request si manda props de más.
  // transform: convierte payloads planos a instancias de clase (y tipos).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Filtro de excepciones uniforme ──
  app.useGlobalFilters(new FiltroExcepcionesHttp());

  // ── Prefijo global de la API ──
  app.setGlobalPrefix('api');

  // ── CORS para el frontend ──
  const frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  app.enableCors({
    origin: frontendUrl.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Swagger en /docs ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API Mantenimiento')
    .setDescription('Gestión de stock de materiales con trazabilidad de movimientos')
    .setVersion('0.1.0')
    // Permite pegar un JWT de Clerk en Swagger ("Authorize") para probar con auth activa.
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);

  console.log(`🚀 API escuchando en http://localhost:${port}/api`);
  console.log(`📚 Swagger en       http://localhost:${port}/docs`);
}

bootstrap();
