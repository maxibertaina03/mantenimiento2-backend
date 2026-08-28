import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TiposEquipoService } from './tipos-equipo.service';
import { TiposEquipoRepository } from './tipos-equipo.repository';

const tipoBase = {
  id: 't-1',
  nombre: 'Cámara de seguridad',
  alias: 'camara de seguridad,camara',
  llevaEspecificaciones: false,
  orden: 60,
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  _count: { equipos: 0 },
};

function armar(tipo: any = tipoBase) {
  const repo = {
    buscarTodos: jest.fn<Promise<any>, any[]>(async () => [tipo]),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => tipo),
    buscarPorNombre: jest.fn<Promise<any>, any[]>(async () => null),
    crear: jest.fn<Promise<any>, any[]>(async (d: any) => ({ ...tipoBase, ...d })),
    actualizar: jest.fn<Promise<any>, any[]>(async () => tipo),
    eliminar: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  return { repo, service: new TiposEquipoService(repo as unknown as TiposEquipoRepository) };
}

describe('TiposEquipoService', () => {
  describe('alta', () => {
    it('crea un tipo nuevo', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'Proyector' } as any);
      expect(repo.crear.mock.calls[0][0].nombre).toBe('Proyector');
    });

    it('por defecto pide especificaciones y queda activo', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'Proyector' } as any);
      expect(repo.crear.mock.calls[0][0]).toMatchObject({
        llevaEspecificaciones: true,
        activo: true,
      });
    });

    it('recorta el nombre y deja el alias vacío en null', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: '  Proyector  ', alias: '   ' } as any);
      expect(repo.crear.mock.calls[0][0]).toMatchObject({ nombre: 'Proyector', alias: null });
    });

    it('REGRESION: rechaza un nombre repetido', async () => {
      // El nombre identifica al tipo en la UI: repetirlo confunde.
      const { service, repo } = armar();
      repo.buscarPorNombre.mockResolvedValue({ id: 'otro', nombre: 'Notebook' });
      await expect(service.crear({ nombre: 'notebook' } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('edición', () => {
    it('lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.actualizar('nope', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('renombrarse a sí mismo no choca con la validación de duplicados', async () => {
      const { service, repo } = armar();
      repo.buscarPorNombre.mockResolvedValue({ id: 't-1', nombre: 'Cámara de seguridad' });
      await expect(
        service.actualizar('t-1', { nombre: 'Cámara de seguridad' } as any),
      ).resolves.toBeDefined();
    });

    it('rechaza tomar el nombre de otro tipo', async () => {
      const { service, repo } = armar();
      repo.buscarPorNombre.mockResolvedValue({ id: 'otro', nombre: 'Notebook' });
      await expect(service.actualizar('t-1', { nombre: 'Notebook' } as any)).rejects.toThrow(
        /Ya existe/,
      );
    });
  });

  describe('baja', () => {
    it('elimina un tipo que no usa ningún equipo', async () => {
      const { service, repo } = armar();
      await service.eliminar('t-1');
      expect(repo.eliminar).toHaveBeenCalledWith('t-1');
    });

    it('REGRESION: no elimina un tipo en uso', async () => {
      // Borrarlo dejaría equipos apuntando a un tipo inexistente.
      const { service, repo } = armar({ ...tipoBase, _count: { equipos: 12 } });
      await expect(service.eliminar('t-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('el mensaje dice cuántos equipos lo usan y sugiere desactivarlo', async () => {
      const { service } = armar({ ...tipoBase, _count: { equipos: 12 } });
      await expect(service.eliminar('t-1')).rejects.toThrow(/12 equipo/);
      await expect(service.eliminar('t-1')).rejects.toThrow(/desactivalo/i);
    });
  });

  describe('listado', () => {
    it('informa cuántos equipos usa cada tipo', async () => {
      const { service } = armar({ ...tipoBase, _count: { equipos: 12 } });
      const [t] = await service.listar();
      expect(t.equipos).toBe(12);
    });

    it('puede pedir solo los activos', async () => {
      const { service, repo } = armar();
      await service.listar(true);
      expect(repo.buscarTodos).toHaveBeenCalledWith(true);
    });
  });
});
