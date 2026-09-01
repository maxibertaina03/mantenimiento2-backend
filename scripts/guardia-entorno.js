/**
 * Freno para los comandos que pueden borrar datos.
 *
 * Existe por un accidente real: un `prisma migrate diff --shadow-database-url`
 * apuntado a producción vació la base y se perdieron movimientos que no se
 * pudieron recuperar. `prisma migrate dev` y `migrate reset` pueden hacer lo
 * mismo, y nada en el comando avisa a qué base le está pegando.
 *
 * La regla: los comandos destructivos solo corren si el archivo de entorno
 * declara ENTORNO=prueba. El .env de producción no lo declara, así que apuntarle
 * uno de esos comandos falla acá en vez de borrarle los datos.
 */
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

if (entorno !== 'prueba') {
  console.error(
    [
      '',
      '  ⛔ Comando destructivo bloqueado.',
      '',
      `     Base apuntada : ${describir(url)}`,
      `     ENTORNO       : ${entorno ?? '(sin definir)'}`,
      '',
      '     Este comando puede BORRAR TODOS LOS DATOS, y solo se permite',
      '     contra la base de prueba (ENTORNO=prueba).',
      '',
      '     Si querías correrlo en la base de prueba, usá los scripts que ya',
      '     apuntan a .env.prueba:  npm run prueba:migrar  ·  npm run prueba:reset',
      '',
      '     Si de verdad necesitás tocar producción, hacelo con una migración',
      '     revisada (npm run prisma:deploy), nunca con reset ni migrate dev.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`✅ Entorno de prueba (${describir(url)}). Adelante.`);
