import { OrdenRespuestaDto } from '../dto/orden-respuesta.dto';
import { armarMensaje, destinatarios, esEmailValido } from './mensaje-orden';

const ADMIN = 'administracion@lacteoslastres.com.ar';

const orden = (over: Partial<OrdenRespuestaDto> = {}) =>
  ({
    numero: 'OC-2026-0007',
    proveedorNombre: 'Ferretería Central',
    proveedorEmail: 'ventas@ferreteria.com.ar',
    observaciones: null,
    total: 1000,
    renglones: [{ materialNombre: 'Cable 2.5mm', unidad: 'm', cantidad: 100 }],
    ...over,
  }) as OrdenRespuestaDto;

describe('destinatarios', () => {
  it('el proveedor recibe y administracion queda en copia', () => {
    expect(destinatarios(orden(), ADMIN)).toEqual({
      para: ['ventas@ferreteria.com.ar'],
      copia: [ADMIN],
    });
  });

  it('REGRESION: sin correo del proveedor, la orden va igual a administracion', () => {
    // Antes que perderse: asi el envio queda registrado y alguien puede
    // reenviarla a mano.
    expect(destinatarios(orden({ proveedorEmail: null }), ADMIN)).toEqual({
      para: [ADMIN],
      copia: [],
    });
  });

  it('un correo roto del proveedor se trata como si no hubiera', () => {
    expect(destinatarios(orden({ proveedorEmail: 'no tiene' }), ADMIN).para).toEqual([ADMIN]);
  });

  it('REGRESION: si el proveedor tiene la misma casilla que administracion, no se duplica', () => {
    // Mandar dos veces a la misma direccion la deja duplicada en la bandeja, y
    // hay proveedores de correo que rechazan el mensaje entero por destinatario
    // repetido.
    const r = destinatarios(orden({ proveedorEmail: ADMIN }), ADMIN);
    expect(r).toEqual({ para: [ADMIN], copia: [] });
  });

  it('la comparacion no distingue mayusculas ni espacios', () => {
    const r = destinatarios(orden({ proveedorEmail: `  ${ADMIN.toUpperCase()} ` }), ADMIN);
    expect(r.copia).toEqual([]);
  });

  it('dos casillas distintas del mismo dominio siguen siendo dos', () => {
    // El limite importa: si agrupara por dominio, administracion dejaria de
    // recibir copia de las ordenes de sus propios proveedores.
    const r = destinatarios(orden({ proveedorEmail: 'compras@lacteoslastres.com.ar' }), ADMIN);
    expect(r.copia).toEqual([ADMIN]);
  });
});

describe('armarMensaje', () => {
  it('el asunto lleva el numero de orden', () => {
    expect(armarMensaje(orden()).asunto).toContain('OC-2026-0007');
  });

  it('el cuerpo lista el detalle con cantidad y unidad', () => {
    expect(armarMensaje(orden()).cuerpo).toContain('Cable 2.5mm — 100 m');
  });

  it('avisa que el PDF va adjunto', () => {
    expect(armarMensaje(orden()).cuerpo).toMatch(/PDF va adjunta/i);
  });

  it('sin total, no escribe un total vacio', () => {
    expect(armarMensaje(orden({ total: null })).cuerpo).not.toContain('Total:');
  });

  it('las observaciones aparecen cuando las hay', () => {
    expect(armarMensaje(orden({ observaciones: 'Entregar por la tarde' })).cuerpo).toContain(
      'Entregar por la tarde',
    );
  });
});

describe('esEmailValido', () => {
  it.each(['ventas@ferreteria.com.ar', 'a.b+c@x.co'])('acepta %s', (v) => {
    expect(esEmailValido(v)).toBe(true);
  });

  it.each([null, undefined, '', '  ', 'sin-arroba', 'a@b'])('rechaza %p', (v) => {
    expect(esEmailValido(v)).toBe(false);
  });
});

describe('destinatarios sin copia interna', () => {
  // Hoy la copia interna esta apagada: el servidor de correo de la empresa
  // rechaza todo lo que sale por Brevo con 550 Blacklisted [France, Europe],
  // asi que rebotaba siempre.
  it('sin casilla interna, la orden va SOLO al proveedor', () => {
    expect(destinatarios(orden(), null)).toEqual({
      para: ['ventas@ferreteria.com.ar'],
      copia: [],
    });
  });

  it('una casilla interna vacia se trata como si no hubiera', () => {
    // Es lo que queda al borrar la variable en el panel sin quitar la linea.
    expect(destinatarios(orden(), '   ').copia).toEqual([]);
  });

  it('una casilla interna rota tampoco se usa', () => {
    // Mandarle a algo que no es una direccion hace rebotar el envio entero.
    expect(destinatarios(orden(), 'esto no es un correo').copia).toEqual([]);
  });

  it('REGRESION: sin correo del proveedor NI casilla interna, no hay a donde mandar', () => {
    // Mandar un correo sin destinatario no falla: simplemente no le llega a
    // nadie, y la orden quedaria marcada como enviada. Quien llama tiene que
    // ver este caso y frenar.
    expect(destinatarios(orden({ proveedorEmail: null }), null)).toEqual({ para: [], copia: [] });
  });

  it('con casilla interna, un proveedor sin correo sigue teniendo a donde ir', () => {
    expect(destinatarios(orden({ proveedorEmail: null }), ADMIN)).toEqual({
      para: [ADMIN],
      copia: [],
    });
  });
});
