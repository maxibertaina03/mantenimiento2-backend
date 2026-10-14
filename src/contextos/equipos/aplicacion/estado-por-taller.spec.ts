import { EstadoEquipo } from '../dominio/estado-equipo';
import { EstadoPorTaller } from './estado-por-taller';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

/** Qué le pasa a una máquina cuando sale a un taller de afuera, y cuando vuelve. */
async function conEquipo(estado: EstadoEquipo) {
  const repo = new RepositorioEquiposEnMemoria();
  const equipo = await repo.crear({ nombre: 'Tubo 1', estado } as never);
  return { repo, id: equipo.id, taller: new EstadoPorTaller(repo) };
}

const estadoDe = async (repo: RepositorioEquiposEnMemoria, id: string) =>
  (await repo.buscarPorId(id))!.estado;

describe('el estado de una máquina en un taller de afuera', () => {
  it('operativa: sale en reparación y vuelve operativa', async () => {
    const { repo, id, taller } = await conEquipo('OPERATIVO');
    await taller.salio(id);
    expect(await estadoDe(repo, id)).toBe('EN_REPARACION');
    await taller.volvio(id);
    expect(await estadoDe(repo, id)).toBe('OPERATIVO');
  });

  it('fuera de servicio: sale en reparación y vuelve operativa, que es para lo que se mandó', async () => {
    const { repo, id, taller } = await conEquipo('FUERA_DE_SERVICIO');
    await taller.salio(id);
    expect(await estadoDe(repo, id)).toBe('EN_REPARACION');
    await taller.volvio(id);
    expect(await estadoDe(repo, id)).toBe('OPERATIVO');
  });

  it('dada de baja: no cambia', async () => {
    const { repo, id, taller } = await conEquipo('DADO_DE_BAJA');
    await taller.salio(id);
    await taller.volvio(id);
    expect(await estadoDe(repo, id)).toBe('DADO_DE_BAJA');
  });

  it('si mientras estaba afuera alguien la marcó fuera de servicio, al volver se respeta', async () => {
    const { repo, id, taller } = await conEquipo('OPERATIVO');
    await taller.salio(id);
    await repo.actualizar(id, { estado: 'FUERA_DE_SERVICIO' });
    await taller.volvio(id);
    expect(await estadoDe(repo, id)).toBe('FUERA_DE_SERVICIO');
  });

  it('una máquina que ya no existe no rompe nada', async () => {
    const { taller } = await conEquipo('OPERATIVO');
    await expect(taller.salio('no-existe')).resolves.toBeUndefined();
  });
});
