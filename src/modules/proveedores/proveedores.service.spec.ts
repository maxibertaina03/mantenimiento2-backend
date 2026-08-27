import { NotFoundException } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresRepository } from './proveedores.repository';

const proveedor = {
  id: 'p-1',
  nombre: 'Ferreteria Central',
  cuit: '30-12345678-9',
  email: null,
  telefono: null,
  notas: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function armar() {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => proveedor),
    buscarTodos: jest.fn<Promise<any>, any[]>(async () => [proveedor]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => proveedor),
    actualizar: jest.fn<Promise<any>, any[]>(async () => proveedor),
    eliminar: jest.fn<Promise<any>, any[]>(async () => proveedor),
  };

  return { repo, service: new ProveedoresService(repo as unknown as ProveedoresRepository) };
}

describe('ProveedoresService', () => {
  describe('listar() - busqueda', () => {
    it('sin busqueda no filtra', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      expect(repo.buscarTodos.mock.calls[0][2]).toEqual({});
    });

    it('busca por nombre O por CUIT', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, buscar: '3012' } as any);
      const where = repo.buscarTodos.mock.calls[0][2];
      expect(where.OR).toEqual([
        { nombre: { contains: '3012', mode: 'insensitive' } },
        { cuit: { contains: '3012', mode: 'insensitive' } },
      ]);
    });

    it('aplica el mismo filtro al contar (total coherente con la pagina)', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, buscar: 'ferre' } as any);
      expect(repo.contar.mock.calls[0][0]).toEqual(repo.buscarTodos.mock.calls[0][2]);
    });

    it('respeta el skip de paginacion', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 3, limite: 20, skip: 40 } as any);
      expect(repo.buscarTodos.mock.calls[0][0]).toBe(40);
      expect(repo.buscarTodos.mock.calls[0][1]).toBe(20);
    });
  });

  describe('CRUD', () => {
    it('obtener() lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('actualizar() valida existencia primero', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.actualizar('nope', {} as any)).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('eliminar() valida existencia primero', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('acepta CUIT duplicado (hay repetidos en los datos reales)', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'Otra sucursal', cuit: '30-12345678-9' } as any);
      expect(repo.crear).toHaveBeenCalled();
    });
  });
});
