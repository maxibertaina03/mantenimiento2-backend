/**
 * Saca o repone una foto completa de la base LOCAL.
 *
 * Sirve para comparar dos versiones del código sobre exactamente los mismos
 * datos: se saca la foto, se corre la versión vieja, se repone la foto, se
 * corre la nueva, y cualquier diferencia en el resultado es del código y no
 * de los datos.
 *
 * Solo trabaja contra localhost, igual que `copiar-produccion-a-local`: reponer
 * BORRA la base de destino, y apuntado a otro lado sería un desastre.
 *
 *   node scripts/foto-local.mjs --guardar   nombre
 *   node scripts/foto-local.mjs --reponer   nombre
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

const GUARDAR = process.argv.includes('--guardar');
const REPONER = process.argv.includes('--reponer');
const nombre = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'foto';

if (GUARDAR === REPONER) {
  console.error('Usá --guardar o --reponer, uno de los dos.');
  process.exit(1);
}

const BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const pg = (h) => join(BIN, `${h}.exe`);

const { parsed } = config({ path: '.env', processEnv: {} });
const u = new URL(parsed.DIRECT_URL ?? parsed.DATABASE_URL);
const destino = {
  host: u.hostname,
  puerto: u.port || '5432',
  usuario: decodeURIComponent(u.username),
  clave: decodeURIComponent(u.password),
  base: u.pathname.replace(/^\//, ''),
};

if (!['localhost', '127.0.0.1', '::1'].includes(destino.host)) {
  console.error(`\n⛔ La base es ${destino.host}, que NO es esta máquina. Solo localhost.\n`);
  process.exit(1);
}

mkdirSync('.copias', { recursive: true });
const archivo = join('.copias', `local-${nombre}.dump`);
const env = { ...process.env, PGPASSWORD: destino.clave };
const conexion = ['-h', destino.host, '-p', destino.puerto, '-U', destino.usuario];

if (GUARDAR) {
  execFileSync(
    pg('pg_dump'),
    [...conexion, '-d', destino.base, '--format=custom', '--no-owner', '--no-privileges', '-f', archivo],
    { env, stdio: 'inherit' },
  );
  console.log(`Foto guardada: ${archivo}`);
  process.exit(0);
}

if (!existsSync(archivo)) {
  console.error(`No existe la foto ${archivo}.`);
  process.exit(1);
}

// Se desconecta a quien esté usando la base: con el backend levantado, el DROP
// falla por conexiones abiertas.
execFileSync(
  pg('psql'),
  [
    ...conexion,
    '-d',
    'postgres',
    '-c',
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${destino.base}' AND pid <> pg_backend_pid()`,
  ],
  { env, stdio: 'pipe' },
);
execFileSync(pg('psql'), [...conexion, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS "${destino.base}"`], {
  env,
  stdio: 'pipe',
});
execFileSync(pg('psql'), [...conexion, '-d', 'postgres', '-c', `CREATE DATABASE "${destino.base}"`], {
  env,
  stdio: 'pipe',
});
// A diferencia del volcado de Supabase, uno de la base local no trae su propio
// `CREATE SCHEMA public`: la base recien creada ya lo tiene y el volcado lo usa.
// Borrarlo, como hace copiar-produccion-a-local, rompe la restauracion.
execFileSync(
  pg('pg_restore'),
  [...conexion, '-d', destino.base, '--no-owner', '--no-privileges', '--single-transaction', archivo],
  { env, stdio: 'inherit' },
);
console.log(`Foto repuesta: ${archivo}`);
