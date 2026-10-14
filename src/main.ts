import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FiltroExcepcionesHttp } from './common/filters/http-exception.filter';
import { iniciarMonitoreo } from './common/monitoreo/monitoreo';
import { exigirBaseCorrecta } from './common/prisma/guardia-base';

/**
 * La versión de `package.json`, leída al arrancar.
 *
 * Se lee del archivo y no con un `import` del JSON: importarlo haría que el
 * compilador saque `package.json` de `src/` y cambie la carpeta de salida
 * (`dist/src/main.js` en vez de `dist/main.js`), que es justo lo que rompe el
 * arranque en Render.
 */
function versionDelPaquete(): string {
  try {
    const ruta = join(__dirname, '..', 'package.json');
    return (JSON.parse(readFileSync(ruta, 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function bootstrap() {
  // Lo PRIMERO, antes de crear la aplicación: si la base no corresponde al
  // entorno declarado, acá se corta. Después de `NestFactory.create` ya habría
  // una conexión abierta contra la base equivocada.
  exigirBaseCorrecta();

  // Aviso de errores del servidor. Sin SENTRY_DSN no hace nada.
  iniciarMonitoreo();

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
    .setDescription('Mantenimiento de planta: pañol, compras, equipos, trabajos e informática')
    // La versión y el commit que corre (Render lo pone en RENDER_GIT_COMMIT):
    // así se puede comprobar que un despliegue llegó aunque no cambie ninguna ruta.
    .setVersion(`${versionDelPaquete()}+${process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local'}`)
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
