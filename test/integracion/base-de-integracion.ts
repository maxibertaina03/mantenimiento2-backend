/**
 * La base de los tests de integración, y la guarda que impide usar otra.
 *
 * Estos tests BORRAN todo lo que hay en la base antes de cada caso. Por eso
 * solo aceptan una base que cumpla las dos cosas:
 *
 *  - está en esta máquina (localhost / 127.0.0.1) o es el servicio `postgres`
 *    del CI;
 *  - su nombre termina en `_integracion`.
 *
 * Producción (Supabase) no cumple ninguna, y la copia local de producción
 * (`mantenimiento`) tampoco la segunda. La URL sale de INTEGRACION_DATABASE_URL
 * y de ningún otro lado: ni de DATABASE_URL ni del .env, para que un .env
 * apuntado a producción no pueda colarse.
 */
const HOSTS_PERMITIDOS = new Set(['localhost', '127.0.0.1', 'postgres']);

export function urlDeIntegracion(): string {
  const url = process.env.INTEGRACION_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta INTEGRACION_DATABASE_URL. Ejemplo: ' +
        'postgresql://usuario:clave@localhost:5432/mantenimiento_integracion ' +
        '(ver docs/tests-de-integracion.md).',
    );
  }
  const { hostname, pathname } = new URL(url);
  const base = pathname.replace(/^\//, '');
  if (!HOSTS_PERMITIDOS.has(hostname)) {
    throw new Error(`Los tests de integración borran la base: ${hostname} no es local. No corro.`);
  }
  if (!base.endsWith('_integracion')) {
    throw new Error(
      `Los tests de integración borran la base: «${base}» no termina en _integracion. No corro.`,
    );
  }
  return url;
}
