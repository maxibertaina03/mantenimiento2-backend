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
