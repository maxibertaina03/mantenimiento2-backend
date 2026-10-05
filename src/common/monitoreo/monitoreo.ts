import * as Sentry from '@sentry/node';

/**
 * Aviso de errores del servidor a Sentry.
 *
 * Sin `SENTRY_DSN` no hace nada: en local y en los tests no sale nada, y en
 * producción se prende cargando la variable en Render.
 *
 * Solo se reportan los errores del servidor (5xx): los 4xx son el sistema
 * funcionando —«falta el proveedor», «no alcanza el stock»—, no fallas.
 *
 * Sin datos de nadie: no viajan cuerpos de pedidos (el baúl de contraseñas
 * recibe contraseñas), ni encabezados, ni cookies, ni la dirección IP. Solo
 * qué falló, dónde y la traza.
 */
let prendido = false;

export function iniciarMonitoreo(
  dsn = process.env.SENTRY_DSN,
  entorno = process.env.ENTORNO ?? 'produccion',
): boolean {
  if (!dsn?.trim()) return false;
  Sentry.init({
    dsn,
    environment: entorno,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Los errores los manda el filtro, con criterio: no queremos los que
    // Sentry captura solo por su cuenta (pueden ser 4xx).
    defaultIntegrations: false,
    beforeSend: limpiarEvento,
  });
  prendido = true;
  return true;
}

/** Saca del evento todo lo que pueda tener datos de alguien. */
export function limpiarEvento<T extends Sentry.ErrorEvent>(evento: T): T {
  if (evento.request) {
    delete evento.request.data;
    delete evento.request.cookies;
    delete evento.request.headers;
    delete evento.request.query_string;
  }
  delete evento.user;
  return evento;
}

/** Reporta un error del servidor. Los que no son 5xx se ignoran. */
export function reportarError(
  error: unknown,
  contexto: { metodo: string; ruta: string; estado: number },
): void {
  if (!prendido || contexto.estado < 500) return;
  Sentry.withScope((scope) => {
    // La ruta sin la consulta: los filtros de búsqueda pueden traer nombres.
    scope.setTag('ruta', `${contexto.metodo} ${contexto.ruta.split('?')[0]}`);
    scope.setTag('estado', String(contexto.estado));
    Sentry.captureException(error);
  });
}

/** Para los tests. */
export function _apagarMonitoreo(): void {
  prendido = false;
}
