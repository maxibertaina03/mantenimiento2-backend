/**
 * Freno para los comandos que pueden borrar datos.
 *
 * Existe por un accidente real: un `prisma migrate diff --shadow-database-url`
 * apuntado a producción vació la base y se perdieron movimientos que no se
 * pudieron recuperar. `prisma migrate dev` y `migrate reset` pueden hacer lo
 * mismo, y nada en el comando avisa a qué base le está pegando.
 *
 * La regla: los comandos destructivos solo corren si el archivo de entorno
 * declara ENTORNO=local o ENTORNO=prueba. Producción declara
 * ENTORNO=produccion, y el servidor de Render no declara nada, así que
 * apuntarle uno de estos comandos falla acá en vez de borrarle los datos.
 *
 * `local` se sumó cuando el trabajo pasó a hacerse contra el Postgres de la
 * máquina: ahí borrar y rehacer la base es lo normal, y tiene que ser cómodo.
 * Lo que nunca se afloja es el otro lado.
 */
const PERMITIDOS = ['local', 'prueba'];
const entorno = process.env.ENTORNO;
const url = process.env.DATABASE_URL ?? '';

/** Deja ver a qué base apunta sin exponer la contraseña. */
function describir(cadena) {
  try {
    const u = new URL(cadena);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(DATABASE_URL ausente o ilegible)';
  }
}

if (!PERMITIDOS.includes(entorno)) {
  console.error(
    [
      '',
      '  ⛔ Comando destructivo bloqueado.',
      '',
      `     Base apuntada : ${describir(url)}`,
      `     ENTORNO       : ${entorno ?? '(sin definir)'}`,
      '',
      '     Este comando puede BORRAR TODOS LOS DATOS, y solo se permite',
      '     contra una base de trabajo (ENTORNO=local o ENTORNO=prueba).',
      '',
      '     Si querías correrlo en tu base local, usá los scripts que ya',
      '     apuntan a .env:  npm run local:migrar  ·  npm run local:reset',
      '',
      '     Si de verdad necesitás tocar producción, hacelo con una migración',
      '     revisada (npm run prisma:deploy), nunca con reset ni migrate dev.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`✅ Entorno de ${entorno} (${describir(url)}). Adelante.`);
