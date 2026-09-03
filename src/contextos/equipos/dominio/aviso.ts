import { PlanConEquipo } from '../puertos/repositorio-planes';
import { EstadoPlan, diasParaVencer, estadoPlan } from './plan-mantenimiento';

/** Un service que hay que avisar, con lo que necesita el correo. */
export interface ServicioAAvisar {
  planId: string;
  /**
   * La fecha de vencimiento de ESTE ciclo del plan.
   *
   * Es la mitad de la clave de idempotencia: cuando el trabajo se hace, el plan
   * avanza a otra fecha y eso habilita el aviso del ciclo siguiente sin tocar
   * nada.
   */
  fechaService: Date;
  equipoNombre: string;
  ubicacionNombre: string | null;
  nombrePlan: string;
  tareas: string | null;
  estado: EstadoPlan;
  diasParaVencer: number;
}

export function aServicioAAvisar(plan: PlanConEquipo, hoy: Date): ServicioAAvisar {
  return {
    planId: plan.id,
    fechaService: plan.proximaFecha,
    equipoNombre: plan.equipoNombre,
    ubicacionNombre: plan.ubicacionNombre,
    nombrePlan: plan.nombre,
    tareas: plan.tareas,
    estado: estadoPlan(plan.proximaFecha, hoy),
    diasParaVencer: diasParaVencer(plan.proximaFecha, hoy),
  };
}

/**
 * Cuánto falta, dicho como se lo diría una persona.
 *
 * "Faltan -3 días" es lo que sale si nadie se ocupa de los negativos, y es
 * justo el caso que más importa: el service que ya venció.
 */
export function textoVencimiento(dias: number): string {
  if (dias < 0) return `vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `faltan ${dias} días`;
}

export interface MensajeAviso {
  asunto: string;
  cuerpo: string;
}

/**
 * Arma el correo con todos los services que vencen.
 *
 * Es **un solo correo con la lista completa**, no uno por service. Veinte
 * correos separados terminan en una regla de bandeja que los archiva sin leer,
 * y ahí el módulo entero pierde sentido.
 *
 * La lista incluye todo lo que está vencido o por vencer, aunque parte ya se
 * haya avisado antes: el correo tiene que dar el panorama completo, no solo la
 * novedad del día.
 */
export function armarMensajeAviso(servicios: ServicioAAvisar[]): MensajeAviso {
  const vencidos = servicios.filter((s) => s.estado === 'VENCIDO');
  const porVencer = servicios.filter((s) => s.estado !== 'VENCIDO');

  const resumen =
    vencidos.length > 0
      ? `${vencidos.length} vencido${vencidos.length === 1 ? '' : 's'}` +
        (porVencer.length > 0 ? ` y ${porVencer.length} por vencer` : '')
      : `${porVencer.length} service${porVencer.length === 1 ? '' : 's'} por vencer`;

  const lineas: string[] = [
    'Mantenimiento de equipos — Lácteos Las Tres S.R.L.',
    '',
    `Hay ${resumen}.`,
  ];

  const bloque = (titulo: string, items: ServicioAAvisar[]) => {
    if (items.length === 0) return;
    lineas.push('', titulo, '');
    for (const s of items) {
      const donde = s.ubicacionNombre ? ` (${s.ubicacionNombre})` : '';
      lineas.push(
        `• ${s.equipoNombre}${donde} — ${s.nombrePlan}, ${textoVencimiento(s.diasParaVencer)}`,
      );
      if (s.tareas) lineas.push(`    ${s.tareas}`);
    }
  };

  // Lo vencido primero: es lo que hay que atender hoy.
  bloque('VENCIDOS', vencidos);
  bloque('PRÓXIMOS A VENCER', porVencer);

  lineas.push(
    '',
    'Al registrar el trabajo en el sistema, la próxima fecha se calcula sola.',
    '',
    'Este aviso lo manda el sistema de mantenimiento automáticamente.',
  );

  return {
    asunto: `Mantenimiento: ${resumen}`,
    cuerpo: lineas.join('\n'),
  };
}

/** Un e-mail plausible; lo mínimo para no mandar a una dirección rota. */
export function esEmailUtilizable(valor: string | null | undefined): boolean {
  const v = (valor ?? '').trim();
  // Las direcciones @sin-acceso.local las inventó la importación de equipos IT
  // para las personas sin login. Mandarles correo rebota, y los rebotes queman
  // la reputación del remitente.
  if (v.endsWith('@sin-acceso.local')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
