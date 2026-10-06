import { urlDeIntegracion } from './base-de-integracion';

/**
 * El entorno de los tests de integración. Corre ANTES de importar AppModule:
 * `ConfigModule.forRoot()` captura process.env al importarse.
 *
 * Lo que no se quiere usar se deja vacío a propósito y no sin definir: el .env
 * local no pisa una variable que ya existe, aunque esté vacía. Así un test no
 * manda un correo de verdad ni sube una foto a Supabase.
 */
const url = urlDeIntegracion();
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

process.env.AUTH_DISABLED = 'true';
process.env.CLERK_SECRET_KEY = '';
// Con AUTH_DISABLED no hay sesión; con esto el guard entra como este usuario,
// que cada test siembra (ver app-de-integracion.ts).
process.env.USUARIO_DEV = 'integracion@test.local';
process.env.CLAVE_SECRETOS = Buffer.alloc(32, 7).toString('base64');

for (const clave of [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'MAIL_AVISOS',
  'MAIL_ADMINISTRACION',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SENTRY_DSN',
  'TOKEN_AVISOS',
]) {
  process.env[clave] = '';
}
