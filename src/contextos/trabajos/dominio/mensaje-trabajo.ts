/**
 * El correo que le llega al taller con una orden de trabajo.
 *
 * Dice qué equipo va y qué hay que hacerle, igual que el papel que viaja con
 * él (que va adjunto). Lo arma el servidor con los datos guardados, nunca
 * quien llama: si no, la casilla de la empresa serviría para escribirle a
 * cualquiera cualquier cosa.
 */
export interface OrdenParaElTaller {
  numero: string;
  titulo: string;
  descripcion: string | null;
  equipoNombre: string | null;
  equipoCodigo: string | null;
  equipoItNombre: string | null;
  proveedorNombre: string | null;
}

export interface MensajeAlTaller {
  asunto: string;
  cuerpo: string;
}

const FIRMA = 'Lácteos Las Tres S.R.L.';

function nombreDelEquipo(orden: OrdenParaElTaller): string | null {
  if (orden.equipoNombre) {
    return orden.equipoCodigo
      ? `${orden.equipoNombre} (${orden.equipoCodigo})`
      : orden.equipoNombre;
  }
  return orden.equipoItNombre;
}

export function armarMensajeAlTaller(orden: OrdenParaElTaller): MensajeAlTaller {
  const equipo = nombreDelEquipo(orden);
  const lineas = [
    `Estimados de ${orden.proveedorNombre ?? 'la empresa'}:`,
    '',
    `Les enviamos la orden de trabajo ${orden.numero}.`,
    '',
  ];
  if (equipo) lineas.push(`Equipo: ${equipo}`);
  lineas.push(`Trabajo a realizar: ${orden.titulo}`);
  if (orden.descripcion) lineas.push('', `Detalle: ${orden.descripcion}`);
  lineas.push(
    '',
    'La orden en PDF va adjunta. Por favor, que viaje con el equipo y nos la devuelvan con lo ' +
      'que se le hizo.',
    '',
    'Saludos,',
    FIRMA,
  );

  return {
    asunto: `Orden de trabajo ${orden.numero}${equipo ? ` - ${equipo}` : ''} - ${FIRMA}`,
    cuerpo: lineas.join('\n'),
  };
}
