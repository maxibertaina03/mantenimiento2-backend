import {
  ErrorDatosInvalidos,
  ErrorNoEncontrado,
  ErrorTransicionInvalida,
} from '../dominio/errores';
import { EquipoParaMontar, ocurrioDuranteElTramo, validarMontaje } from '../dominio/montaje';
import { RelojFijo } from '../puertos/reloj';
import { ActualizarEquipo } from './actualizar-equipo';
import { GestionarMontajes } from './gestionar-montajes';
import { RepositorioMontajesEnMemoria } from './montajes-en-memoria';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

describe('Montajes - dominio', () => {
  const eq = (id: string, extra: Partial<EquipoParaMontar> = {}): EquipoParaMontar => ({
    id,
    nombre: id,
    estado: 'OPERATIVO',
    equipoPadreId: null,
    ...extra,
  });

  it('un equipo no se monta en sí mismo', () => {
    expect(() => validarMontaje(eq('a'), eq('a'), [])).toThrow(/dentro de sí mismo/);
  });

  it('REGRESION: no se cierra un círculo, directo ni por varios niveles', () => {
    // La bomba está en la desnatadora: la desnatadora no puede ir en la bomba.
    expect(() => validarMontaje(eq('desnatadora'), eq('bomba'), ['desnatadora'])).toThrow(
      ErrorDatosInvalidos,
    );
    // Motor en bomba en desnatadora: la desnatadora tampoco puede ir en el motor.
    expect(() => validarMontaje(eq('desnatadora'), eq('motor'), ['bomba', 'desnatadora'])).toThrow(
      /adentro del otro/,
    );
  });

  it('nada dado de baja entra en el árbol', () => {
    expect(() => validarMontaje(eq('b', { estado: 'DADO_DE_BAJA' }), eq('m'), [])).toThrow(
      ErrorTransicionInvalida,
    );
    expect(() => validarMontaje(eq('b'), eq('m', { estado: 'DADO_DE_BAJA' }), [])).toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('montarlo donde ya está se avisa, no duplica el tramo', () => {
    expect(() => validarMontaje(eq('b', { equipoPadreId: 'm' }), eq('m'), [])).toThrow(
      /ya está montado/,
    );
  });

  it('un trabajo cuenta para el tramo si pasó entre el desde y el hasta', () => {
    const tramo = {
      componenteId: 'b',
      equipoPadreId: 'm',
      desde: new Date('2026-03-01'),
      hasta: new Date('2026-08-01'),
    };
    expect(ocurrioDuranteElTramo(tramo, new Date('2026-05-01'))).toBe(true);
    expect(ocurrioDuranteElTramo(tramo, new Date('2026-02-01'))).toBe(false);
    expect(ocurrioDuranteElTramo(tramo, new Date('2026-08-01'))).toBe(false);
    expect(ocurrioDuranteElTramo({ ...tramo, hasta: null }, new Date('2030-01-01'))).toBe(true);
  });
});

describe('GestionarMontajes', () => {
  function armar() {
    const equipos = new RepositorioEquiposEnMemoria([
      { id: 'desnatadora', nombre: 'Desnatadora 1' },
      { id: 'recibo', nombre: 'Bomba de recibo' },
      { id: 'bomba', nombre: 'Electrobomba centrífuga' },
      { id: 'motor', nombre: 'Motor 15 HP' },
    ]);
    const montajes = new RepositorioMontajesEnMemoria(equipos);
    const reloj = new RelojFijo(new Date('2026-10-01T12:00:00.000Z'));
    return { equipos, montajes, reloj, caso: new GestionarMontajes(montajes, equipos, reloj) };
  }

  it('monta la bomba en la desnatadora y aparece como componente', async () => {
    const { caso, equipos } = armar();
    await caso.montar('bomba', 'desnatadora', 'u1', 'Instalación');

    expect((await equipos.buscarPorId('bomba'))?.equipoPadreId).toBe('desnatadora');
    expect((await caso.componentes('desnatadora')).map((c) => c.id)).toEqual(['bomba']);
  });

  it('trasladar cierra el tramo anterior y abre el nuevo, sin huecos', async () => {
    const { caso, montajes, reloj } = armar();
    await caso.montar('bomba', 'desnatadora', null);
    reloj.mover(new Date('2026-10-15T09:00:00.000Z'));
    await caso.montar('bomba', 'recibo', null, 'Se pasó a recibo');

    const [nuevo, viejo] = await caso.historial('bomba');
    expect(nuevo).toMatchObject({ equipoPadreId: 'recibo', hasta: null });
    expect(viejo.equipoPadreId).toBe('desnatadora');
    expect(viejo.hasta).toEqual(nuevo.desde);
    expect(montajes.tramos.filter((t) => t.hasta === null)).toHaveLength(1);
    expect(await caso.componentes('desnatadora')).toHaveLength(0);
  });

  it('desmontar cierra el tramo y lo deja suelto', async () => {
    const { caso, equipos } = armar();
    await caso.montar('bomba', 'desnatadora', null);
    await caso.desmontar('bomba', 'A rebobinar');

    expect((await equipos.buscarPorId('bomba'))?.equipoPadreId).toBeNull();
    expect((await caso.historial('bomba'))[0].hasta).not.toBeNull();
  });

  it('REGRESION: no deja cerrar un círculo por varios niveles', async () => {
    const { caso } = armar();
    await caso.montar('bomba', 'desnatadora', null);
    await caso.montar('motor', 'bomba', null);
    await expect(caso.montar('desnatadora', 'motor', null)).rejects.toThrow(ErrorDatosInvalidos);
  });

  it('desmontar algo suelto se avisa', async () => {
    const { caso } = armar();
    await expect(caso.desmontar('bomba')).rejects.toThrow(/no está montado/);
  });

  it('un equipo que no existe es 404', async () => {
    const { caso } = armar();
    await expect(caso.montar('nope', 'desnatadora', null)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('dar de baja un equipo montado lo desmonta solo', async () => {
    const { caso, equipos, montajes, reloj } = armar();
    await caso.montar('bomba', 'desnatadora', null);

    await new ActualizarEquipo(equipos, montajes, reloj).ejecutar('bomba', {
      estado: 'DADO_DE_BAJA',
    });

    expect((await equipos.buscarPorId('bomba'))?.equipoPadreId).toBeNull();
    expect(montajes.tramos.every((t) => t.hasta !== null)).toBe(true);
  });
});
