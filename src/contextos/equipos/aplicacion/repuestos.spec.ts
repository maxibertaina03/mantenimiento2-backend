import {
  ErrorConflicto,
  ErrorDatosInvalidos,
  ErrorNoEncontrado,
  ErrorTransicionInvalida,
} from '../dominio/errores';
import { GestionarRepuestos } from './gestionar-repuestos';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';
import { RepositorioRepuestosEnMemoria } from './repuestos-en-memoria';

/**
 * Los repuestos de cada equipo: qué materiales del pañol lleva la máquina,
 * para saber qué ir a buscar el día que se rompe.
 */
function armar() {
  const equipos = new RepositorioEquiposEnMemoria([
    { id: 'bomba', nombre: 'Bomba de recibo' },
    { id: 'bomba-2', nombre: 'Bomba 2' },
    { id: 'vieja', nombre: 'Bomba vieja', estado: 'DADO_DE_BAJA' },
  ]);
  const repuestos = new RepositorioRepuestosEnMemoria(equipos, [
    {
      id: 'reten',
      nombre: 'Retén 40x72x10',
      activo: true,
      unidad: 'u',
      stockActual: 2,
      stockMinimo: 4,
    },
    {
      id: 'rodamiento',
      nombre: 'Rodamiento 6205',
      activo: true,
      unidad: 'u',
      stockActual: 10,
      stockMinimo: 2,
    },
    { id: 'jubilado', nombre: 'Sello viejo', activo: false },
  ]);
  return { repuestos, gestionar: new GestionarRepuestos(repuestos, equipos) };
}

describe('GestionarRepuestos', () => {
  it('suma un material a la lista del equipo, con cantidad, nota y stock del pañol', async () => {
    const { gestionar } = armar();

    const lista = await gestionar.agregar(
      'bomba',
      { materialId: 'reten', cantidad: 2, notas: '  lado motor  ' },
      'u1',
    );

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      materialNombre: 'Retén 40x72x10',
      cantidad: 2,
      notas: 'lado motor',
      stockActual: 2,
      unidad: 'u',
      // 2 de stock con mínimo 4: hay que reponer.
      bajoStock: true,
    });
  });

  it('un material va en muchos equipos, y un equipo lleva muchos materiales', async () => {
    const { gestionar } = armar();
    await gestionar.agregar('bomba', { materialId: 'reten' }, null);
    await gestionar.agregar('bomba', { materialId: 'rodamiento' }, null);
    await gestionar.agregar('bomba-2', { materialId: 'reten' }, null);

    expect((await gestionar.listar('bomba')).map((r) => r.materialNombre)).toEqual([
      'Retén 40x72x10',
      'Rodamiento 6205',
    ]);
    expect((await gestionar.equiposQueLoUsan('reten')).map((e) => e.equipoNombre)).toEqual([
      'Bomba 2',
      'Bomba de recibo',
    ]);
  });

  it('REGRESION: el mismo material no va dos veces en la lista: se cambia la cantidad', async () => {
    const { gestionar } = armar();
    await gestionar.agregar('bomba', { materialId: 'reten' }, null);

    await expect(gestionar.agregar('bomba', { materialId: 'reten' }, null)).rejects.toThrow(
      ErrorConflicto,
    );
  });

  it('no se suma un material fuera de circulación, ni a un equipo dado de baja', async () => {
    const { gestionar } = armar();
    await expect(gestionar.agregar('bomba', { materialId: 'jubilado' }, null)).rejects.toThrow(
      ErrorDatosInvalidos,
    );
    await expect(gestionar.agregar('vieja', { materialId: 'reten' }, null)).rejects.toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('una cantidad en cero o negativa se rechaza; vacía vale', async () => {
    const { gestionar } = armar();
    await expect(
      gestionar.agregar('bomba', { materialId: 'reten', cantidad: 0 }, null),
    ).rejects.toThrow(/mayor que cero/);
    const lista = await gestionar.agregar('bomba', { materialId: 'reten', cantidad: null }, null);
    expect(lista[0].cantidad).toBeNull();
  });

  it('se cambia la cantidad y la nota, y se quita', async () => {
    const { gestionar } = armar();
    const [rep] = await gestionar.agregar('bomba', { materialId: 'reten', cantidad: 1 }, null);

    const cambiada = await gestionar.cambiar('bomba', rep.id, { cantidad: 3, notas: '' });
    expect(cambiada[0]).toMatchObject({ cantidad: 3, notas: null });

    expect(await gestionar.quitar('bomba', rep.id)).toEqual([]);
  });

  it('REGRESION: no se toca el repuesto de otro equipo pasando su id', async () => {
    const { gestionar } = armar();
    const [rep] = await gestionar.agregar('bomba', { materialId: 'reten' }, null);

    await expect(gestionar.quitar('bomba-2', rep.id)).rejects.toThrow(ErrorNoEncontrado);
    expect(await gestionar.listar('bomba')).toHaveLength(1);
  });

  it('equipo o material inexistente es 404', async () => {
    const { gestionar } = armar();
    await expect(gestionar.listar('nada')).rejects.toThrow(ErrorNoEncontrado);
    await expect(gestionar.agregar('bomba', { materialId: 'nada' }, null)).rejects.toThrow(
      ErrorNoEncontrado,
    );
  });
});
