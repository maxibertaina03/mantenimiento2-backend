import { ServicioAAvisar, armarMensajeAviso, esEmailUtilizable, textoVencimiento } from './aviso';

/**
 * El correo de aviso de mantenimiento.
 *
 * Todo funciones puras: se prueba el texto exacto que le va a llegar a una
 * persona, sin mandar nada a ningún lado.
 */
const servicio = (over: Partial<ServicioAAvisar> = {}): ServicioAAvisar => ({
  planId: 'p1',
  fechaService: new Date('2026-09-05T00:00:00.000Z'),
  equipoNombre: 'Compresor 1',
  ubicacionNombre: 'Caldera',
  nombrePlan: 'Cambio de aceite',
  tareas: null,
  estado: 'POR_VENCER',
  diasParaVencer: 3,
  ...over,
});

describe('textoVencimiento', () => {
  it('REGRESION: lo vencido se dice en positivo', () => {
    // "faltan -3 dias" es lo que sale si nadie se ocupa de los negativos, y es
    // justo el caso que mas importa.
    expect(textoVencimiento(-3)).toBe('vencido hace 3 días');
    expect(textoVencimiento(-1)).toBe('vencido hace 1 día');
  });

  it('hoy y manana se dicen con palabras', () => {
    expect(textoVencimiento(0)).toBe('vence hoy');
    expect(textoVencimiento(1)).toBe('vence mañana');
  });

  it('mas adelante cuenta los dias', () => {
    expect(textoVencimiento(7)).toBe('faltan 7 días');
  });
});

describe('armarMensajeAviso', () => {
  it('el asunto dice cuantos hay, sin que haya que abrirlo', () => {
    const m = armarMensajeAviso([
      servicio({ estado: 'VENCIDO', diasParaVencer: -5 }),
      servicio({ planId: 'p2', estado: 'POR_VENCER', diasParaVencer: 2 }),
    ]);
    expect(m.asunto).toContain('1 vencido');
    expect(m.asunto).toContain('1 por vencer');
  });

  it('REGRESION: es UN correo con la lista, no uno por service', () => {
    // Veinte correos separados terminan en una regla de bandeja que los
    // archiva sin leer.
    const m = armarMensajeAviso([
      servicio({ planId: 'a', equipoNombre: 'Compresor 1' }),
      servicio({ planId: 'b', equipoNombre: 'Tina 2' }),
      servicio({ planId: 'c', equipoNombre: 'Caldera' }),
    ]);
    expect(m.cuerpo).toContain('Compresor 1');
    expect(m.cuerpo).toContain('Tina 2');
    expect(m.cuerpo).toContain('Caldera');
  });

  it('REGRESION: lo vencido va primero', () => {
    // Es lo que hay que atender hoy.
    const m = armarMensajeAviso([
      servicio({ planId: 'a', equipoNombre: 'Por vencer', estado: 'POR_VENCER' }),
      servicio({ planId: 'b', equipoNombre: 'Ya vencido', estado: 'VENCIDO', diasParaVencer: -2 }),
    ]);
    expect(m.cuerpo.indexOf('Ya vencido')).toBeLessThan(m.cuerpo.indexOf('Por vencer'));
  });

  it('muestra el sector, para saber donde ir', () => {
    const m = armarMensajeAviso([servicio({ ubicacionNombre: 'Drenoprensa' })]);
    expect(m.cuerpo).toContain('(Drenoprensa)');
  });

  it('un equipo sin sector no deja parentesis vacios', () => {
    const m = armarMensajeAviso([servicio({ ubicacionNombre: null })]);
    expect(m.cuerpo).not.toContain('()');
  });

  it('incluye las tareas cuando estan cargadas', () => {
    const m = armarMensajeAviso([servicio({ tareas: 'Vaciar y cargar 5 lt' })]);
    expect(m.cuerpo).toContain('Vaciar y cargar 5 lt');
  });

  it('sin vencidos, el asunto no los menciona', () => {
    const m = armarMensajeAviso([servicio(), servicio({ planId: 'p2' })]);
    expect(m.asunto).not.toMatch(/vencido/i);
    expect(m.asunto).toContain('2 services');
  });

  it('el singular y el plural quedan bien con uno solo', () => {
    const m = armarMensajeAviso([servicio()]);
    expect(m.asunto).toContain('1 service por vencer');
  });

  it('explica que registrar el trabajo adelanta la fecha sola', () => {
    // Sin eso, alguien podria pensar que hay que corregirla a mano cada vez.
    expect(armarMensajeAviso([servicio()]).cuerpo).toMatch(/se calcula sola/i);
  });
});

describe('esEmailUtilizable', () => {
  it('REGRESION: descarta las direcciones sinteticas de la importacion', () => {
    // Las invento la importacion de equipos IT para personas sin login: de los
    // 35 usuarios, 31 las tienen. Mandarles correo rebota, y los rebotes queman
    // la reputacion del remitente.
    expect(esEmailUtilizable('juan.perez@sin-acceso.local')).toBe(false);
  });

  it('acepta las direcciones reales', () => {
    expect(esEmailUtilizable('mantenimiento@lacteoslastres.com.ar')).toBe(true);
    expect(esEmailUtilizable('mantenimiento.lastres@gmail.com')).toBe(true);
  });

  it.each([null, undefined, '', '   ', 'sin-arroba', 'a@b'])('rechaza %p', (v) => {
    expect(esEmailUtilizable(v)).toBe(false);
  });
});
