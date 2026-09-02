import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { AlmacenImagenesEnMemoria } from './almacen-en-memoria';
import { CambiarFotoEquipo } from './cambiar-foto-equipo';
import { CrearEquipo } from './crear-equipo';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

/**
 * Cambio de foto de un equipo.
 *
 * El orden de las operaciones es lo que se prueba acá: subir antes de guardar y
 * borrar la vieja al final. Hecho al revés, una falla en el medio deja al
 * equipo sin foto o apuntando a una imagen que no existe.
 */
function armar(configurado = true) {
  const equipos = new RepositorioEquiposEnMemoria();
  const almacen = new AlmacenImagenesEnMemoria(configurado);
  return {
    equipos,
    almacen,
    crear: new CrearEquipo(equipos),
    cambiarFoto: new CambiarFotoEquipo(equipos, almacen),
  };
}

const imagen = (kb = 10) => Buffer.alloc(kb * 1024, 1);

describe('CambiarFotoEquipo', () => {
  it('sube la imagen y deja la ficha apuntando a ella', async () => {
    const { crear, cambiarFoto, almacen } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    const actualizado = await cambiarFoto.ejecutar(equipo.id, imagen(), 'compresor.jpg');

    expect(actualizado.fotoUrl).toContain('compresor.jpg');
    expect(almacen.subidas).toHaveLength(1);
  });

  it('guarda las fotos en la carpeta del equipo', async () => {
    // Así se sabe de quién es cada archivo mirando el almacén, sin cruzar
    // contra la base.
    const { crear, cambiarFoto, almacen } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await cambiarFoto.ejecutar(equipo.id, imagen(), 'foto.jpg');
    expect(almacen.subidas[0].ruta.startsWith(`${equipo.id}/`)).toBe(true);
  });

  it('REGRESION: la foto vieja se borra DESPUES de guardar la nueva', async () => {
    // Borrarla antes dejaría al equipo sin foto si la subida falla en el medio.
    const { crear, cambiarFoto, almacen, equipos } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await cambiarFoto.ejecutar(equipo.id, imagen(), 'primera.jpg');
    const ordenAntes = [...almacen.borradas];
    expect(ordenAntes).toHaveLength(0);

    await cambiarFoto.ejecutar(equipo.id, imagen(), 'segunda.jpg');

    expect(almacen.borradas).toHaveLength(1);
    expect(almacen.borradas[0]).toContain('primera.jpg');
    const final = await equipos.buscarPorId(equipo.id);
    expect(final?.fotoUrl).toContain('segunda.jpg');
  });

  it('REGRESION: si la subida falla, la ficha NO se toca', async () => {
    // Si se guardara primero, quedaría apuntando a una imagen inexistente.
    const { crear, cambiarFoto, almacen, equipos } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });
    jest.spyOn(almacen, 'subir').mockRejectedValueOnce(new Error('Supabase respondió 403'));

    await expect(cambiarFoto.ejecutar(equipo.id, imagen(), 'x.jpg')).rejects.toThrow(/403/);
    expect((await equipos.buscarPorId(equipo.id))?.fotoUrl).toBeNull();
  });

  it('la primera foto no intenta borrar nada', async () => {
    const { crear, cambiarFoto, almacen } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await cambiarFoto.ejecutar(equipo.id, imagen(), 'foto.jpg');
    expect(almacen.borradas).toHaveLength(0);
  });

  it('rechaza una imagen vacia', async () => {
    const { crear, cambiarFoto } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await expect(cambiarFoto.ejecutar(equipo.id, Buffer.alloc(0), 'x.jpg')).rejects.toBeInstanceOf(
      ErrorDatosInvalidos,
    );
  });

  it('rechaza una imagen de mas de 5 MB, diciendo cuanto pesa', async () => {
    const { crear, cambiarFoto } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await expect(cambiarFoto.ejecutar(equipo.id, imagen(6 * 1024), 'x.jpg')).rejects.toThrow(
      /6 MB.*5 MB/,
    );
  });

  it('404 si el equipo no existe, sin subir nada', async () => {
    const { cambiarFoto, almacen } = armar();
    await expect(cambiarFoto.ejecutar('fantasma', imagen(), 'x.jpg')).rejects.toBeInstanceOf(
      ErrorNoEncontrado,
    );
    expect(almacen.subidas).toHaveLength(0);
  });

  it('REGRESION: sin almacen configurado avisa, no rompe', async () => {
    // El resto del modulo tiene que seguir funcionando sin fotos.
    const { crear, cambiarFoto } = armar(false);
    const equipo = await crear.ejecutar({ nombre: 'Compresor 1' });

    await expect(cambiarFoto.ejecutar(equipo.id, imagen(), 'x.jpg')).rejects.toThrow(
      /no está configurada/i,
    );
  });
});
