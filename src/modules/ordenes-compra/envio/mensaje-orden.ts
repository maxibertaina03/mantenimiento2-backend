import { OrdenRespuestaDto } from '../dto/orden-respuesta.dto';

/** Un e-mail plausible; lo mínimo para no mandar a una dirección rota. */
export function esEmailValido(valor: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor ?? '').trim());
}

function moneda(valor: number | null): string {
  if (valor === null) return '';
  return `$ ${valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface MensajeOrden {
  asunto: string;
  cuerpo: string;
}

/**
 * Texto de la orden para el correo.
 *
 * Se arma acá y no en el navegador a propósito: el cliente manda el PDF, pero
 * ni el texto ni los destinatarios. Si los mandara, cualquiera con una sesión
 * podría usar la casilla de la empresa para escribirle a quien quisiera.
 */
export function armarMensaje(orden: OrdenRespuestaDto): MensajeOrden {
  const detalle = orden.renglones
    .map((r) => {
      const cantidad = `${r.cantidad}${r.unidad ? ` ${r.unidad}` : ''}`;
      return `• ${r.materialNombre ?? 'Material'} — ${cantidad}`;
    })
    .join('\n');

  const lineas = [
    `Estimados de ${orden.proveedorNombre ?? 'la empresa'}:`,
    '',
    `Les enviamos la orden de compra ${orden.numero}.`,
    '',
    'Detalle:',
    detalle,
  ];

  if (orden.total !== null) lineas.push('', `Total: ${moneda(orden.total)}`);
  if (orden.observaciones) lineas.push('', `Observaciones: ${orden.observaciones}`);

  lineas.push('', 'La orden en PDF va adjunta.', '', 'Saludos,', 'Lácteos Las Tres S.R.L.');

  return {
    asunto: `Orden de compra ${orden.numero} - Lácteos Las Tres S.R.L.`,
    cuerpo: lineas.join('\n'),
  };
}

export interface Destinatarios {
  para: string[];
  copia: string[];
}

/**
 * A quién va la orden.
 *
 * Administración recibe siempre: si el proveedor tiene correo va en copia, y si
 * no lo tiene pasa a ser el destinatario, así el envío queda registrado en vez
 * de perderse.
 */
export function destinatarios(orden: OrdenRespuestaDto, mailAdministracion: string): Destinatarios {
  if (esEmailValido(orden.proveedorEmail)) {
    return { para: [orden.proveedorEmail!.trim()], copia: [mailAdministracion] };
  }
  return { para: [mailAdministracion], copia: [] };
}
