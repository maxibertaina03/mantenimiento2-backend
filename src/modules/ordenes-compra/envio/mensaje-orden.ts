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
 * La copia interna es opcional. Hoy está apagada porque el servidor de correo
 * de la empresa rechaza todo lo que sale por Brevo con
 * `550 5.7.1 Blacklisted [France, Europe]`: es un bloqueo por IP europea, no un
 * problema de autenticación, así que ningún registro DNS lo arregla y la copia
 * rebotaba siempre. Que quede como opcional y no borrada permite volver a
 * encenderla con una variable el día que el hosting lo destrabe.
 *
 * Sin copia interna, la constancia de lo que salió la da la tabla
 * `envios_orden`, que además guarda lo que se mandó por WhatsApp.
 *
 * `para` puede volver vacío: es el caso de un proveedor sin correo y sin copia
 * interna configurada. Quien llama tiene que tratarlo, porque mandar un correo
 * sin destinatario no falla, simplemente no le llega a nadie.
 */
export function destinatarios(
  orden: OrdenRespuestaDto,
  mailAdministracion: string | null,
): Destinatarios {
  const interno = (mailAdministracion ?? '').trim();
  const copiaInterna = esEmailValido(interno) ? [interno] : [];

  if (!esEmailValido(orden.proveedorEmail)) {
    // Sin correo del proveedor, la copia interna pasa a ser el destinatario:
    // así el envío queda registrado en vez de perderse. Si tampoco hay copia
    // interna, no hay a dónde mandarlo y `para` vuelve vacío.
    return { para: copiaInterna, copia: [] };
  }

  const proveedor = orden.proveedorEmail!.trim();

  // Si el proveedor tiene cargada la misma casilla que administración, la copia
  // sobra: mandar dos veces a la misma dirección la deja duplicada en la
  // bandeja, y hay proveedores de correo que rechazan el mensaje entero por
  // destinatario repetido.
  const esLaMisma = proveedor.toLowerCase() === interno.toLowerCase();

  return { para: [proveedor], copia: esLaMisma ? [] : copiaInterna };
}
