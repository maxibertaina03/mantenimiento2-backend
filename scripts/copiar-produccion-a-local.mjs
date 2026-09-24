/**
 * Trae una copia de la base de producción a la base local.
 *
 * Es lo que permite probar un refactor contra los datos de verdad —506
 * materiales, 326 equipos, 599 movimientos— sin ningún riesgo: **de producción
 * solo LEE**. `pg_dump` abre una transacción de solo lectura y no escribe
 * nada, ni siquiera una tabla de control.
 *
 * Lo que sí destruye es la base LOCAL, que se rehace entera en cada corrida.
 * Para eso está: que rehacerla sea barato y se pueda romper sin miedo.
 *
 * Las dos guardas, por si algún día se invierten los argumentos:
 *
 * - El origen tiene que ser una base de producción; si no, no hay nada que
 *   copiar y probablemente los archivos estén al revés.
 * - **El destino tiene que ser localhost.** Si no lo es, corta antes de tocar
 *   nada. Esta es la que importa: sin ella, un `.env` mal editado convertiría
 *   este script en uno que borra producción y la pisa consigo misma.
 *
 *   node scripts/copiar-produccion-a-local.mjs
 *   ... con --solo-esquema si no se quieren los datos.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

const SOLO_ESQUEMA = process.argv.includes('--solo-esquema');

/** Las herramientas de Postgres 18 instaladas en Windows. */
const BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const pg = (herramienta) => join(BIN, `${herramienta}.exe`);

if (!existsSync(pg('pg_dump'))) {
  console.error(`No encuentro pg_dump en ${BIN}. ¿Está instalado PostgreSQL 18?`);
  process.exit(1);
}

/** Lee un archivo de entorno sin pisar el process.env de este proceso. */
function leerEntorno(archivo) {
  const { parsed, error } = config({ path: archivo, processEnv: {} });
  if (error) {
    console.error(`No pude leer ${archivo}: ${error.message}`);
    process.exit(1);
  }
  return parsed;
}

const produccion = leerEntorno('.env.produccion');
const local = leerEntorno('.env');

// Se usa DIRECT_URL y no DATABASE_URL: el pooler de Supabase (6543) no sirve
// para un dump, hay que ir al puerto 5432.
const origen = produccion.DIRECT_URL ?? produccion.DATABASE_URL;
const destino = local.DIRECT_URL ?? local.DATABASE_URL;

function partes(url, cual) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      puerto: u.port || '5432',
      usuario: decodeURIComponent(u.username),
      clave: decodeURIComponent(u.password),
      base: u.pathname.replace(/^\//, ''),
    };
  } catch {
    console.error(`La URL de ${cual} no se entiende. Revisá el archivo de entorno.`);
    process.exit(1);
  }
}

const desde = partes(origen, 'producción');
const hacia = partes(destino, 'local');

// ── Las guardas ───────────────────────────────────────────────────────────
if (!/supabase\.(com|co)$/i.test(desde.host)) {
  console.error(`\nEl origen es ${desde.host}, que no es producción. ¿Están los archivos al revés?`);
  process.exit(1);
}

if (!['localhost', '127.0.0.1', '::1'].includes(hacia.host)) {
  console.error(
    `\n⛔ El destino es ${hacia.host}, que NO es esta máquina.\n\n` +
      '   Este script BORRA la base de destino. Solo puede apuntar a localhost.\n',
  );
  process.exit(1);
}

if (hacia.clave === 'CONTRASENIA') {
  console.error(
    '\n⛔ Falta poner la contraseña en .env: todavía dice CONTRASENIA.\n' +
      '   Reemplazala por la del usuario de Postgres de esta máquina.\n',
  );
  process.exit(1);
}

console.log(`\nOrigen  (solo lectura):  ${desde.host}/${desde.base}`);
console.log(`Destino (se rehace):     ${hacia.host}:${hacia.puerto}/${hacia.base}\n`);

mkdirSync('.copias', { recursive: true });
const archivo = join('.copias', 'produccion.dump');

/** Corre una herramienta de Postgres con la contraseña por variable de entorno. */
function correr(herramienta, args, clave, permitirFallo = false) {
  try {
    return execFileSync(pg(herramienta), args, {
      env: { ...process.env, PGPASSWORD: clave },
      stdio: permitirFallo ? 'pipe' : 'inherit',
      maxBuffer: 1024 * 1024 * 512,
    });
  } catch (error) {
    if (permitirFallo) return null;
    console.error(`\nFalló ${herramienta}. ${error.message.split('\n')[0]}`);
    process.exit(1);
  }
}

// ── 1. Copiar de producción ───────────────────────────────────────────────
// --no-owner y --no-privileges: los roles de Supabase no existen en local, y
// sin esto el restore se llena de errores por dueños que no se pueden asignar.
// --schema=public: lo demás son los esquemas internos de Supabase.
console.log('1/3  Leyendo producción…');
correr(
  'pg_dump',
  [
    '-h', desde.host, '-p', desde.puerto, '-U', desde.usuario, '-d', desde.base,
    '--format=custom', '--no-owner', '--no-privileges', '--schema=public',
    ...(SOLO_ESQUEMA ? ['--schema-only'] : []),
    '-f', archivo,
  ],
  desde.clave,
);

// ── 2. Rehacer la base local ──────────────────────────────────────────────
console.log('2/3  Rehaciendo la base local…');
const conexionAdmin = ['-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', 'postgres'];

// DROP y CREATE por separado: si la base no existía, el DROP falla y está bien.
correr('psql', [...conexionAdmin, '-c', `DROP DATABASE IF EXISTS "${hacia.base}"`], hacia.clave);
correr('psql', [...conexionAdmin, '-c', `CREATE DATABASE "${hacia.base}"`], hacia.clave);

// El dump de Supabase trae su propio `CREATE SCHEMA public`, y una base recién
// creada ya lo tiene. Con --single-transaction ese choque aborta la restauración
// entera, y el único síntoma es una base vacía. Se le saca el esquema para que
// el dump ponga el suyo: la base acaba de nacer, acá no hay nada que perder.
correr(
  'psql',
  [
    '-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', hacia.base,
    '-c', 'DROP SCHEMA IF EXISTS public CASCADE',
  ],
  hacia.clave,
);

// ── 3. Restaurar ──────────────────────────────────────────────────────────
// --single-transaction: o entra todo o no entra nada. Una base a medio
// restaurar es peor que ninguna, porque parece que funciona.
//
// Los avisos de pg_restore no llegan acá como error, así que si esto falla es
// que falló de verdad y hay que verlo, no taparlo.
console.log('3/3  Restaurando en local…');
correr(
  'pg_restore',
  [
    '-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', hacia.base,
    '--no-owner', '--no-privileges', '--single-transaction', archivo,
  ],
  hacia.clave,
);

// ── Comprobación ──────────────────────────────────────────────────────────
// Que el comando no falle no alcanza: lo que importa es que los datos estén.
const cuenta = correr(
  'psql',
  [
    '-h', hacia.host, '-p', hacia.puerto, '-U', hacia.usuario, '-d', hacia.base,
    '-t', '-A', '-c',
    "select (select count(*) from materiales) || ' materiales, ' || " +
      "(select count(*) from movimientos_stock) || ' movimientos, ' || " +
      "(select count(*) from equipos) || ' equipos'",
  ],
  hacia.clave,
  true,
);

if (cuenta === null) {
  console.error('\nLa copia terminó pero la base local no responde como se esperaba. Revisar.');
  process.exit(1);
}

console.log(`\n✅ Base local lista: ${String(cuenta).trim()}`);
console.log('   Producción no se tocó: solo se leyó.\n');
