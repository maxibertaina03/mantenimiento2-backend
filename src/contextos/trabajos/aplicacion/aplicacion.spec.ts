import {
  ErrorDatosInvalidos,
  ErrorNoEncontrado,
  ErrorNoEsSuyo,
  ErrorTransicionInvalida,
} from '../dominio/errores';
import { Reloj } from '../puertos/reloj';
import { ConsultaEquiposEnMemoria } from './consulta-equipos-en-memoria';
import { ConsultaUsuariosEnMemoria } from './consulta-usuarios-en-memoria';
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
  // Dos que trabajan y uno de administracion, que no.
  const usuarios = new ConsultaUsuariosEnMemoria([
    { id: 'u1', nombre: 'Facundo', puedeTrabajar: true },
    { id: 'u2', nombre: 'Leandro', puedeTrabajar: true },
    { id: 'admin', nombre: 'Administracion', puedeTrabajar: false },
  ]);

  return {
    repo,
    stock,
    gestionar: new GestionarOrdenesTrabajo(repo, equipos, usuarios, reloj),
    materiales: new UsarMateriales(repo, stock),
    consultar: new ConsultarOrdenesTrabajo(repo),
  };
}

const NUEVA = { titulo: 'Perdida en la bomba', tipo: 'CORRECTIVO', abiertaPorId: 'u1' } as const;

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
    await expect(gestionar.editar(orden.id, { equipoId: 'eq-inventado' }, 'u1')).rejects.toThrow(
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
  it('cerrar guarda que se hizo y quien la cerro', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);

    const cerrada = await gestionar.cerrar(orden.id, 'Se cambio el reten y la junta', 'u1');

    expect(cerrada.estado).toBe('CERRADA');
    expect(cerrada.resolucion).toBe('Se cambio el reten y la junta');
    expect(cerrada.cerradaEn).toEqual(AHORA);
    // Quien la cerro es el asignado, porque es el unico que puede.
    expect(cerrada.cerradaPorId).toBe('u1');
  });

  it('una orden reabierta vuelve a aceptar materiales', async () => {
    const { gestionar, materiales, stock } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.cerrar(orden.id, 'Listo', 'u1');

    await gestionar.reabrir(orden.id, 'u1');
    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u1');

    expect(stock.asientos).toHaveLength(1);
  });

  it('REGRESION: no se anula una orden que ya movio stock', async () => {
    const { gestionar, materiales } = armar();
    const orden = await gestionar.crear(NUEVA);
    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    await expect(gestionar.anular(orden.id, 'Me equivoque', 'u1')).rejects.toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('quitando los materiales, la orden ya se puede anular', async () => {
    const { gestionar, materiales } = armar();
    const orden = await gestionar.crear(NUEVA);
    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 2 }, 'u1');

    await materiales.quitar(renglon.id, 'u1');
    const anulada = await gestionar.anular(orden.id, 'Se cargo duplicada', 'u1');

    expect(anulada.estado).toBe('ANULADA');
  });

  it('eliminar saca la orden del sistema, despues de anularla', async () => {
    const { gestionar, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.anular(orden.id, 'Era de prueba', 'u1');

    await gestionar.eliminar(orden.id);

    expect((await consultar.listar({}, 1, 20)).total).toBe(0);
    await expect(consultar.buscarPorId(orden.id)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('REGRESION: una orden abierta no se elimina sin anular primero', async () => {
    const { gestionar, consultar } = armar();
    const orden = await gestionar.crear(NUEVA);

    await expect(gestionar.eliminar(orden.id)).rejects.toThrow(ErrorTransicionInvalida);
    expect((await consultar.listar({}, 1, 20)).total).toBe(1);
  });

  it('una orden cerrada no se edita sin reabrirla', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);
    await gestionar.cerrar(orden.id, 'Listo', 'u1');

    await expect(gestionar.editar(orden.id, { titulo: 'Otro titulo' }, 'u1')).rejects.toThrow(
      /reabrila primero/i,
    );
  });
});

describe('el trabajo es de quien lo tiene asignado', () => {
  it('sin elegir a nadie, la orden queda para quien la abre', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(NUEVA);
    expect(orden.asignadoAId).toBe('u1');
  });

  it('un encargado se la asigna a otro y ese otro la trabaja', async () => {
    const { gestionar, materiales, stock } = armar();
    const orden = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });

    await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u2');
    const cerrada = await gestionar.cerrar(orden.id, 'Listo', 'u2');

    expect(stock.asientos).toHaveLength(1);
    expect(cerrada.cerradaPorId).toBe('u2');
  });

  it('REGRESION: el que no la tiene asignada no le carga materiales', async () => {
    // Y no llega a tocar el paniol: el candado va antes que el stock.
    const { gestionar, materiales, stock } = armar();
    const orden = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });

    await expect(
      materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u1'),
    ).rejects.toThrow(ErrorNoEsSuyo);
    expect(stock.asientos).toHaveLength(0);
  });

  it('REGRESION: el que no la tiene asignada no la cierra', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });

    await expect(gestionar.cerrar(orden.id, 'La cierro yo', 'u1')).rejects.toThrow(ErrorNoEsSuyo);
  });

  it('REGRESION: tampoco quita un material que cargo el duenio', async () => {
    const { gestionar, materiales } = armar();
    const orden = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });
    const renglon = await materiales.agregar(orden.id, { materialId: 'mat-1', cantidad: 1 }, 'u2');

    await expect(materiales.quitar(renglon.id, 'u1')).rejects.toThrow(ErrorNoEsSuyo);
  });

  it('no se le asigna a alguien que no puede trabajar ordenes', async () => {
    // Administracion ni ve el modulo: la orden quedaria trabada desde el primer
    // dia y nadie sabria por que.
    const { gestionar } = armar();

    await expect(gestionar.crear({ ...NUEVA, asignadoAId: 'admin' })).rejects.toThrow(
      ErrorDatosInvalidos,
    );
  });

  it('no se le asigna a alguien que no existe', async () => {
    const { gestionar } = armar();
    await expect(gestionar.crear({ ...NUEVA, asignadoAId: 'fantasma' })).rejects.toThrow(
      ErrorNoEncontrado,
    );
  });

  it('reasignar destraba una orden y el nuevo duenio la puede cerrar', async () => {
    // Es la salida para cuando la persona que la tenia no esta.
    const { gestionar } = armar();
    const orden = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });

    const reasignada = await gestionar.reasignar(orden.id, 'u1');
    expect(reasignada.asignadoAId).toBe('u1');

    const cerrada = await gestionar.cerrar(orden.id, 'La termine yo', 'u1');
    expect(cerrada.cerradaPorId).toBe('u1');
  });

  it('las ordenes de una persona se pueden listar aparte', async () => {
    const { gestionar, consultar } = armar();
    await gestionar.crear(NUEVA);
    const deOtro = await gestionar.crear({ ...NUEVA, asignadoAId: 'u2' });

    const suyas = await consultar.listar({ asignadoAId: 'u2' }, 1, 20);

    expect(suyas.total).toBe(1);
    expect(suyas.datos[0].id).toBe(deOtro.id);
  });
});

describe('consultar', () => {
  it('filtra por estado', async () => {
    const { gestionar, consultar } = armar();
    const abierta = await gestionar.crear(NUEVA);
    const otra = await gestionar.crear({
      titulo: 'Cambio de filtro',
      tipo: 'PREVENTIVO',
      abiertaPorId: 'u1',
    });
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
    await gestionar.crear({
      titulo: 'Cambio de filtro de aire',
      tipo: 'PREVENTIVO',
      abiertaPorId: 'u1',
    });

    expect((await consultar.listar({ buscar: 'filtro' }, 1, 20)).total).toBe(1);
    expect((await consultar.listar({ buscar: 'OT-2026-0001' }, 1, 20)).total).toBe(1);
  });

  it('pedir una orden que no existe es un error de dominio, no un null', async () => {
    const { consultar } = armar();
    await expect(consultar.buscarPorId('no-existe')).rejects.toThrow(ErrorNoEncontrado);
  });
});
