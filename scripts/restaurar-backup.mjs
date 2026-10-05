/**
 * Restaura un backup de producción (el .dump.gpg de Google Drive) en la base
 * LOCAL, para revisarlo o recuperar datos.
 *
 * Un backup que nunca se restauró no es un backup: este script es el ensayo.
 *
 * Las guardas, las mismas que copiar-produccion-a-local.mjs:
 * - **El destino tiene que ser localhost.** Si no, corta antes de tocar nada.
 *   Este script BORRA la base de destino y la rehace con el backup.
 * - La restauración es todo o nada (--single-transaction).
 *
 * La frase de cifrado la pide gpg en pantalla: no se escribe en ningún archivo
 * ni en la línea de comandos. Para un ensayo automático se puede pasar en la
 * variable de entorno CLAVE_BACKUP, que llega a gpg por la entrada estándar.
 *
 *   node scripts/restaurar-backup.mjs <archivo.dump.gpg>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { config } from 'dotenv';

const archivo = process.argv[2];
if (!archivo || !existsSync(archivo)) {
  console.error('Uso: node scripts/restaurar-backup.mjs <archivo.dump.gpg>');
  process.exit(1);
}

/** Las herramientas de Postgres 18 instaladas en Windows. */
const BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const pg = (herramienta) => (existsSync(BIN) ? join(BIN, `${herramienta}.exe`) : herramienta);

const { parsed: local, error } = config({ path: '.env', processEnv: {} });
if (error) {
  console.error(`No pude leer .env: ${error.message}`);
  process.exit(1);
}
const u = new URL(local.DIRECT_URL ?? local.DATABASE_URL);
const hacia = {
  host: u.hostname,
  puerto: u.port || '5432',
  usuario: decodeURIComponent(u.username),
  clave: decodeURIComponent(u.password),
  base: u.pathname.replace(/^\//, ''),
};

if (!['localhost', '127.0.0.1', '::1'].includes(hacia.host)) {
  console.error(
    `\n⛔ El destino es ${hacia.host}, que NO es esta máquina.\n\n` +
      '   Este script BORRA la base de destino. Solo puede apuntar a localhost.\n',
  );
  process.exit(1);
}

function correr(herramienta, args, { conClave = true, permitirFallo = false, entrada } = {}) {
  try {
    return execFileSync(herramienta, args, {
      env: { ...process.env, ...(conClave ? { PGPASSWORD: hacia.clave } : {}) },
      input: entrada,
      stdio: entrada !== undefined ? ['pipe', 'inherit', 'inherit'] : permitirFallo ? 'pipe' : 'inherit',
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (e) {
    if (permitirFallo) return null;
    console.error(`\nFalló ${basename(herramienta)}. ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
}

console.log(`\nBackup:  ${archivo}`);
console.log(`Destino: ${hacia.host}:${hacia.puerto}/${hacia.base} (se rehace)\n`);

mkdirSync('.copias', { recursive: true });
const descifrado = join('.copias', 'backup-restaurado.dump');

try {
  // ── 1. Descifrar ─────────────────────────────────────────────────────────
  console.log('1/3  Descifrando (gpg te va a pedir la frase de CLAVE_BACKUP)…');
  const frase = process.env.CLAVE_BACKUP;
  correr(
    'gpg',
    frase
      ? ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
         '--output', descifrado, '--decrypt', archivo]
      : ['--yes', '--output', descifrado, '--decrypt', archivo],
    { conClave: false, entrada: frase },
  );

  // ── 2. Rehacer la base local ─────────────────────────────────────────────
  console.log('2/3  Rehaciendo la base local…');
  const admin = ['-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', 'postgres'];
  correr(pg('psql'), [...admin, '-c', `DROP DATABASE IF EXISTS "${hacia.base}"`]);
  correr(pg('psql'), [...admin, '-c', `CREATE DATABASE "${hacia.base}"`]);
  // El dump trae su propio esquema public (ver copiar-produccion-a-local.mjs).
  correr(pg('psql'), [
    '-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', hacia.base,
    '-c', 'DROP SCHEMA IF EXISTS public CASCADE',
  ]);

  // ── 3. Restaurar ─────────────────────────────────────────────────────────
  console.log('3/3  Restaurando…');
  correr(pg('pg_restore'), [
    '-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', hacia.base,
    '--no-owner', '--no-privileges', '--single-transaction', descifrado,
  ]);
} finally {
  // El dump descifrado tiene los datos en claro: no se deja tirado.
  rmSync(descifrado, { force: true });
}

console.log('\n✅ Restaurado en la base local.');
console.log('   Para compararlo con producción (los dos deberían coincidir):');
console.log('     node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env');
console.log('     node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env.produccion\n');
