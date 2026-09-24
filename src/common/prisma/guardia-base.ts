/**
 * Impide que lo que se está desarrollando le pegue a la base de producción.
 *
 * Existe por el riesgo que había hasta hoy: el `.env` del repo apuntaba a
 * Supabase, así que levantar el backend en la máquina de uno —para probar un
 * cambio, para depurar— escribía en la base real de la empresa. Nada avisaba.
 * Un `seed` mal apuntado o una prueba de "a ver qué pasa si borro esto" caían
 * sobre los movimientos de verdad.
 *
 * La regla es que el entorno y la base tienen que coincidir, y se comprueba en
 * los dos sentidos:
 *
 * - `ENTORNO=local` con una base que no es local              → frena.
 * - `ENTORNO=local` (o `prueba`) contra una base de producción → frena.
 *
 * **Un ENTORNO sin declarar no se bloquea, y es a propósito.** El servidor de
 * producción en Render no declara la variable: si esta guardia la exigiera, el
 * primer despliegue que la incluyera dejaría a la empresa sin sistema. Una
 * protección que puede tirar abajo lo que protege no sirve.
 *
 * Lo que se protege es el caso real: el `.env` de la máquina de uno declara
 * `ENTORNO=local`, y desde ese momento es imposible que apunte a Supabase sin
 * que esto lo frene.
 *
 * El día que Render declare `ENTORNO=produccion` se puede endurecer para que
 * también frene una base de producción sin entorno declarado.
 *
 * Es hermano de `scripts/guardia-entorno.js`, que frena los comandos
 * destructivos de Prisma. Aquel cuida los comandos; este, el arranque de la
 * aplicación y los scripts que escriben.
 */

/** Entornos que sabemos nombrar. Cualquier otra cosa se trata como sin declarar. */
export type Entorno = 'local' | 'prueba' | 'produccion';

/** Los hosts que son la máquina de uno. */
function esBaseLocal(host: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host);
}

/**
 * Los hosts que son producción.
 *
 * Se reconoce por proveedor y no por una lista de direcciones exactas: si
 * mañana Supabase cambia el nombre del pooler, el freno tiene que seguir
 * funcionando. Mejor frenar de más que de menos.
 */
function esBaseDeProduccion(host: string): boolean {
  return /supabase\.(com|co)$/i.test(host);
}

/** El host de la cadena de conexión, sin la contraseña. */
function hostDe(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export interface Veredicto {
  /** `null` si todo está en orden; el motivo si hay que frenar. */
  problema: string | null;
  /** Para poder decir a qué base se apuntaba, sin filtrar la contraseña. */
  host: string;
  entorno: string;
}

/**
 * Decide si esta combinación de entorno y base puede seguir adelante.
 *
 * Función pura y exportada a propósito: así se prueba sin levantar la
 * aplicación ni tener ninguna base delante.
 */
export function revisarBase(url: string | undefined, entorno: string | undefined): Veredicto {
  const host = hostDe(url ?? '') ?? '(sin DATABASE_URL legible)';
  const declarado = entorno ?? '(sin declarar)';
  const base = { host, entorno: declarado };

  if (host === '(sin DATABASE_URL legible)') {
    // Sin entorno declarado tampoco se opina: puede ser un comando que no
    // necesita base (compilar, correr los tests con repositorios en memoria).
    return entorno === undefined
      ? { ...base, problema: null }
      : { ...base, problema: 'No hay DATABASE_URL, o no se entiende.' };
  }

  // Solo opina si alguien DECLARÓ un entorno. Ver el comentario de arriba: sin
  // declarar es el servidor de producción, y ahí no hay que estorbar.
  if (esBaseDeProduccion(host) && entorno !== undefined && entorno !== 'produccion') {
    return {
      ...base,
      problema:
        `La base ${host} es PRODUCCIÓN y ENTORNO es "${declarado}". ` +
        'Para trabajar contra producción hay que declarar ENTORNO=produccion y hacerlo a ' +
        'propósito. Si querías trabajar en tu máquina, usá el .env local.',
    };
  }

  if (entorno === 'local' && !esBaseLocal(host)) {
    return {
      ...base,
      problema:
        `ENTORNO=local pero la base es ${host}, que no está en esta máquina. ` +
        'Revisá DATABASE_URL: el trabajo local va contra el Postgres local.',
    };
  }

  return { ...base, problema: null };
}

/**
 * Corta el arranque si la base no corresponde.
 *
 * Termina el proceso en vez de lanzar una excepción: si esto falla, no hay
 * nada sensato que la aplicación pueda hacer después, y una excepción que
 * alguien atrapa por accidente dejaría la aplicación andando contra la base
 * equivocada, que es justo lo que se quiere evitar.
 */
export function exigirBaseCorrecta(
  url = process.env.DATABASE_URL,
  entorno = process.env.ENTORNO,
): void {
  const { problema, host, entorno: declarado } = revisarBase(url, entorno);
  if (!problema) {
    console.log(`✅ Base: ${host}  ·  ENTORNO=${declarado}`);
    return;
  }

  console.error(
    ['', '  ⛔ Arranque bloqueado: la base no corresponde al entorno.', '', `     ${problema}`, ''].join(
      '\n',
    ),
  );
  process.exit(1);
}
