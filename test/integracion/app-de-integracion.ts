import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { FiltroExcepcionesHttp } from '../../src/common/filters/http-exception.filter';
import { PermisosService } from '../../src/common/auth/permisos.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/** El usuario con el que entran los tests (USUARIO_DEV, ver entorno.ts). */
export const USUARIO = {
  // Fijo: el guard guarda el usuario en caché, y entre test y test la base se
  // vacía y se vuelve a sembrar. Con otro id, la caché apuntaría a uno que ya
  // no existe.
  id: 'b0000001-0000-4000-8000-000000000001',
  nombre: 'Integración',
  email: 'integracion@test.local',
  rol: 'ADMIN' as const,
};

export interface AppDeIntegracion {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
}

/**
 * La aplicación entera —módulos, guard, pipes, filtro— contra el Postgres de
 * integración. Igual que main.ts, sin Swagger ni CORS.
 */
export async function levantarApp(): Promise<AppDeIntegracion> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new FiltroExcepcionesHttp());
  app.setGlobalPrefix('api');
  await app.init();
  return { app, http: request(app.getHttpServer()), prisma: app.get(PrismaService) };
}

/**
 * Deja la base vacía —todas las tablas menos el registro de migraciones— y
 * siembra el usuario de los tests. La guarda de base-de-integracion.ts ya
 * comprobó que esta base es la de integración.
 *
 * Después vuelve a sembrar los permisos por rol con el mismo código que corre
 * al arrancar la aplicación: sin ellos, el administrador no podría nada.
 */
export async function vaciarBase({ app, prisma }: AppDeIntegracion): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tablas.length > 0) {
    const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
  }
  await prisma.usuario.create({ data: USUARIO });
  await app.get(PermisosService).onModuleInit();
}

/** Solo el día, en UTC, como lo guarda el calendario. */
export const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const textoDia = (fecha: Date | string) => new Date(fecha).toISOString().slice(0, 10);

/**
 * El lunes de la semana que viene, en UTC. Para lo que el calendario genera
 * solo cerca de hoy (de 30 días atrás en adelante): una fecha fija quedaría
 * afuera con el paso del tiempo.
 */
export function lunesQueViene(): Date {
  const hoy = dia(textoDia(new Date()));
  const faltan = (8 - hoy.getUTCDay()) % 7 || 7;
  return new Date(hoy.getTime() + faltan * 24 * 60 * 60 * 1000);
}

export const sumarDias = (fecha: Date, dias: number) =>
  new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
