import { ErrorNoEncontrado, ErrorTransicionInvalida } from '../dominio/errores';
import { Reloj } from '../puertos/reloj';
import { ConsultaEquiposEnMemoria } from './consulta-equipos-en-memoria';
import { ConsultarOrdenesTrabajo } from './consultar-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from './gestionar-ordenes-trabajo';
import { RepositorioOrdenesEnMemoria } from './repositorio-en-memoria';
import { StockEnMemoria } from './stock-en-memoria';
import { UsarMateriales } from './usar-materiales';

const AHORA = new Date('2026-09-21T10:00:00.000Z');
const reloj: Reloj = { ahora: () => AHORA };

function armar() {
  const repo = new RepositorioOrdenesEnMemoria({ 'mat-1': 'Reten 40x72x10' });
  const stock = new StockEnMemoria();
  const equipos = new ConsultaEquiposEnMemoria([
    { id: 'eq-7', nombre: 'Bomba recibo 7', codigo: 'B-007' },
  ]);

  return {
    repo,
    stock,
    gestionar: new GestionarOrdenesTrabajo(repo, equipos, reloj),
    materiales: new UsarMateriales(repo, stock),
    consultar: new ConsultarOrdenesTrabajo(repo),
  };
}

const NUEVA = { titulo: 'Perdida en la bomba', tipo: 'CORRECTIVO' } as const;

describe('abrir una orden de trabajo', () => {
  it('sin equipo se puede, y es el caso normal de mantenimiento hoy', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);

    expect(orden.estado).toBe('ABIERTA');
    expect(orden.equipoId).toBeNull();
    expect(orden.numero).toMatch(/^OT-2026-\d{4}$/);
  });

  it('con un equipo que existe, lo guarda', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear({ ...NUEVA, equipoId: 'eq-7' });
    expect(orden.equipoId).toBe('eq-7');
  });

  it('REGRESION: un equipo inexistente se rechaza al crear', async () => {
    // Sin esto se guardaria un id que no apunta a nada, y el error apareceria
    // meses despues al abrir la ficha de una maquina que no tiene ese trabajo.
    const { gestionar } = armar();
    await expect(gestionar.crear({ ...NUEVA, equipoId: 'eq-inventado' })).rejects.toThrow(
      ErrorNoEncontrado,
    );
  });

  it('un equipo inexistente tambien se rechaza al editar', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);
    await expect(gestionar.editar(orden.id, { equipoId: 'eq-inventado' })).rejects.toThrow(
      ErrorNoEncontrado,
    );
  });
});

describe('cargar materiales', () => {
  it('saca el material del paniol y lo deja atado al movimiento', async () => {
    const { gestionar, materiales, stock, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);

    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    expect(stock.asientos).toHaveLength(1);
    expect(stock.asientos[0]).toMatchObject({
      sentido: 'SALIDA',
      materialId: 'mat-1',
      cantidad: 2,
      numeroOrden: orden.numero,
    });
    // El renglon guarda el id del movimiento: eso es la trazabilidad.
    expect(renglon.movimientoId).toBe(stock.asientos[0].movimientoId);

    const conResumen = await consultar.buscarPorId(orden.id);
    expect(conResumen.materiales).toHaveLength(1);
    expect(conResumen.resumen).toEqual({ materialesDistintos: 1, unidadesTotales: 2 });
  });

  it('REGRESION: si el paniol rechaza el descuento, no queda renglon', async () => {
    // El stock se mueve primero justamente para esto: al reves, la orden diria
    // que uso algo que nunca salio.
    const { gestionar, materiales, stock, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);
    stock.fallarAlDescontar = true;

    await expect(
      materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1'),
    ).rejects.toThrow('No hay stock suficiente.');

    expect((await consultar.buscarPorId(orden.id)).materiales).toHaveLength(0);
  });

  it('REGRESION: si falla el guardado del renglon, el stock se devuelve', async () => {
    // Si no, el paniol arrastraria una salida que ninguna orden reclama, que es
    // exactamente el agujero que este modulo viene a tapar.
    const { gestionar, materiales, stock, repo, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);
    repo.fallarAlAgregarMaterial = true;

    await expect(
      materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1'),
    ).rejects.toThrow('falla simulada');

    expect(stock.saldoFueraDelPanol('mat-1')).toBe(0);
    expect((await consultar.buscarPorId(orden.id)).materiales).toHaveLength(0);
  });

  it('el mismo material se puede cargar dos veces', async () => {
    // Se uso el lunes y otra vez el miercoles: son dos salidas de verdad, cada
    // una con su movimiento.
    const { gestionar, materiales, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);

    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');
    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 3 }, 'u1');

    const conResumen = await consultar.buscarPorId(orden.id);
    expect(conResumen.materiales).toHaveLength(2);
    expect(conResumen.resumen).toEqual({ materialesDistintos: 1, unidadesTotales: 5 });
  });

  it('REGRESION: una orden cerrada no acepta materiales', async () => {
    const { gestionar, materiales, stock } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.cerrar(orden.id, 'Se cambio el reten', 'u1');

    await expect(
      materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u1'),
    ).rejects.toThrow(ErrorTransicionInvalida);

    // Y no llego a tocar el paniol.
    expect(stock.asientos).toHaveLength(0);
  });
});

describe('quitar un material', () => {
  it('devuelve el stock al paniol sin borrar la salida original', async () => {
    const { gestionar, materiales, stock, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);
    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    await materiales.quitar(renglon.id, 'u1');

    // Dos asientos, no cero: la salida queda y la entrada la compensa. El
    // historial del material tiene que poder reconstruir que paso.
    expect(stock.asientos.map((a) => a.sentido)).toEqual(['SALIDA', 'ENTRADA']);
    expect(stock.saldoFueraDelPanol('mat-1')).toBe(0);
    expect((await consultar.buscarPorId(orden.id)).materiales).toHaveLength(0);
  });

  it('REGRESION: si falla la devolucion, el renglon vuelve a la orden', async () => {
    // El peor final posible seria la orden diciendo que no lo uso y el paniol
    // descontado igual, sin nada que explique la diferencia.
    const { gestionar, materiales, stock, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);
    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');
    stock.fallarAlDevolver = true;

    await expect(materiales.quitar(renglon.id, 'u1')).rejects.toThrow('No se pudo devolver');

    const conResumen = await consultar.buscarPorId(orden.id);
    expect(conResumen.materiales).toHaveLength(1);
    expect(conResumen.resumen.unidadesTotales).toBe(2);
  });
});

describe('cerrar, reabrir y anular', () => {
  it('cerrar guarda que se hizo', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);

    const cerrada = await gestionar.cerrar(orden.id, 'Se cambio el reten y la junta', 'u9');

    expect(cerrada.estado).toBe('CERRADA');
    expect(cerrada.resolucion).toBe('Se cambio el reten y la junta');
    expect(cerrada.cerradaEn).toEqual(AHORA);
  });

  it('una orden reabierta vuelve a aceptar materiales', async () => {
    const { gestionar, materiales, stock } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.cerrar(orden.id, 'Listo', 'u1');

    await gestionar.reabrir(orden.id);
    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u1');

    expect(stock.asientos).toHaveLength(1);
  });

  it('REGRESION: no se anula una orden que ya movio stock', async () => {
    const { gestionar, materiales } = armar();
    const orden = await gestionar.crear(NUEVA);
    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    await expect(gestionar.anular(orden.id, 'Me equivoque')).rejects.toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('quitando los materiales, la orden ya se puede anular', async () => {
    const { gestionar, materiales } = armar();
    const orden = await gestionar.crear(NUEVA);
    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    await materiales.quitar(renglon.id, 'u1');
    const anulada = await gestionar.anular(orden.id, 'Se cargo duplicada');

    expect(anulada.estado).toBe('ANULADA');
  });

  it('una orden cerrada no se edita sin reabrirla', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.cerrar(orden.id, 'Listo', 'u1');

    await expect(gestionar.editar(orden.id, { titulo: 'Otro titulo' })).rejects.toThrow(
      /reabrila primero/i,
    );
  });
});

describe('consultar', () => {
  it('filtra por estado', async () => {
    const { gestionar, consultar } = armar();
    const abierta = await gestionar.crear(NUEVA);
    const otra = await gestionar.crear({ titulo: 'Cambio de filtro', tipo: 'PREVENTIVO' });
    await gestionar.cerrar(otra.id, 'Se cambio', 'u1');

    const pagina = await consultar.listar({ estado: 'ABIERTA' }, 1, 20);

    expect(pagina.total).toBe(1);
    expect(pagina.datos[0].id).toBe(abierta.id);
  });

  it('las ordenes de un equipo se pueden pedir para su ficha', async () => {
    const { gestionar, consultar } = armar();
    await gestionar.crear(NUEVA);
    const conEquipo = await gestionar.crear({ ...NUEVA, equipoId: 'eq-7' });

    const delEquipo = await consultar.listarPorEquipo('eq-7');

    expect(delEquipo.map((o) => o.id)).toEqual([conEquipo.id]);
  });

  it('busca por numero y por titulo', async () => {
    const { gestionar, consultar } = armar();
    await gestionar.crear(NUEVA);
    await gestionar.crear({ titulo: 'Cambio de filtro de aire', tipo: 'PREVENTIVO' });

    expect((await consultar.listar({ buscar: 'filtro' }, 1, 20)).total).toBe(1);
    expect((await consultar.listar({ buscar: 'OT-2026-0001' }, 1, 20)).total).toBe(1);
  });

  it('pedir una orden que no existe es un error de dominio, no un null', async () => {
    const { consultar } = armar();
    await expect(consultar.buscarPorId('no-existe')).rejects.toThrow(ErrorNoEncontrado);
  });
});
