import { execSync } from 'node:child_process';
import { urlDeIntegracion } from './base-de-integracion';

/**
 * Antes de todos los tests: la base de integración con todas las migraciones,
 * las mismas que corren en producción. Si no existe, Prisma la crea.
 *
 * `migrate deploy` y nunca `migrate dev` ni `reset`: aplica lo que hay en
 * prisma/migrations y nada más, sin base sombra.
 */
export default function prepararBase(): void {
  const url = urlDeIntegracion();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
