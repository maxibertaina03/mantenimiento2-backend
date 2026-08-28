import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaterialesService } from './materiales.service';
import { MaterialesRepository } from './materiales.repository';
import { CategoriasMaterialService } from '../categorias-material/categorias-material.service';
import { UnidadesMedidaService } from '../unidades-medida/unidades-medida.service';

const categoria = { id: 'cat-1', nombre: 'Electricidad', descripcion: null };
const unidadMetro = { id: 'uni-1', nombre: 'Metro', simbolo: 'm', orden: 90, activo: true };

const material = {
  id: 'mat-1',
  nombre: 'Cable 2.5mm',
  categoriaId: 'cat-1',
  unidadId: 'uni-1',
  unidad: unidadMetro,
  stockActual: 50,
  stockMinimo: 10,
  notas: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  categoria,
};

function armar() {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => material),
    buscarTodos: jest.fn<Promise<any>, any[]>(async () => [material]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => material),
    buscarConHistorial: jest.fn<Promise<any>, any[]>(async () => ({
      ...material,
      movimientos: [],
    })),
    buscarBajoStock: jest.fn<Promise<any>, any[]>(async () => [material]),
    actualizar: jest.fn<Promise<any>, any[]>(async () => material),
    eliminar: jest.fn<Promise<any>, any[]>(async () => material),
    contarMovimientos: jest.fn<Promise<any>, any[]>(async () => 0),
    contarSinUnidad: jest.fn<Promise<any>, any[]>(async () => 0),
    asignarUnidadMasiva: jest.fn<Promise<any>, any[]>(async () => 831),
  };

  const categorias = {
    obtener: jest.fn<Promise<any>, any[]>(async () => categoria),
  };

  const unidades = {
    obtener: jest.fn<Promise<any>, any[]>(async () => unidadMetro),
  };

  return {
    repo,
    categorias,
    unidades,
    service: new MaterialesService(
      repo as unknown as MaterialesRepository,
      categorias as unknown as CategoriasMaterialService,
      unidades as unknown as UnidadesMedidaService,
    ),
  };
}

describe('MaterialesService', () => {
  describe('crear()', () => {
    it('valida que la categoria exista antes de crear', async () => {
      const { service, categorias } = armar();
      await service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'cat-1' } as any);
      expect(categorias.obtener).toHaveBeenCalledWith('cat-1');
    });

    it('propaga el 404 si la categoria no existe', async () => {
      const { service, categorias } = armar();
      categorias.obtener.mockRejectedValue(new NotFoundException('no existe'));
      await expect(
        service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'fantasma' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('el stock inicial NO se puede setear desde el alta (solo via movimientos)', async () => {
      const { service, repo } = armar();
      await service.crear({
        nombre: 'X',
        unidadId: 'uni-1',
        categoriaId: 'cat-1',
        stockActual: 999,
      } as any);
      expect(repo.crear.mock.calls[0][0]).not.toHaveProperty('stockActual');
    });

    it('stockMinimo por defecto es 0', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'cat-1' } as any);
      expect(repo.crear.mock.calls[0][0].stockMinimo).toBe(0);
    });
  });

  describe('listar()', () => {
    it('sin busqueda no filtra', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      expect(repo.buscarTodos.mock.calls[0][2]).toEqual({});
    });

    it('con busqueda filtra por nombre sin distinguir mayusculas', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, buscar: 'cable' } as any);
      expect(repo.buscarTodos.mock.calls[0][2]).toEqual({
        nombre: { contains: 'cable', mode: 'insensitive' },
      });
    });

    it('devuelve la forma paginada completa', async () => {
      const { service } = armar();
      const res = await service.listar({ pagina: 2, limite: 20, skip: 20 } as any);
      expect(res).toMatchObject({ total: 1, pagina: 2, limite: 20 });
      expect(res.datos).toHaveLength(1);
    });
  });

  describe('obtener()', () => {
    it('lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('obtenerConHistorial lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarConHistorial.mockResolvedValue(null);
      await expect(service.obtenerConHistorial('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminar()', () => {
    it('impide borrar un material con movimientos (integridad del historial)', async () => {
      const { service, repo } = armar();
      repo.contarMovimientos.mockResolvedValue(3);
      await expect(service.eliminar('mat-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('borra si no tiene movimientos', async () => {
      const { service, repo } = armar();
      await service.eliminar('mat-1');
      expect(repo.eliminar).toHaveBeenCalledWith('mat-1');
    });

    it('lanza 404 antes de contar movimientos si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.contarMovimientos).not.toHaveBeenCalled();
    });
  });

  describe('actualizar()', () => {
    it('valida la nueva categoria si se envia', async () => {
      const { service, categorias } = armar();
      await service.actualizar('mat-1', { categoriaId: 'cat-2' } as any);
      expect(categorias.obtener).toHaveBeenCalledWith('cat-2');
    });

    it('no toca la categoria si no se envia', async () => {
      const { service, repo } = armar();
      await service.actualizar('mat-1', { nombre: 'Nuevo' } as any);
      expect(repo.actualizar.mock.calls[0][1]).not.toHaveProperty('categoria');
    });
  });
  describe('asignarUnidadMasiva()', () => {
    it('por defecto solo completa los materiales SIN unidad', async () => {
      // Pisar los que ya tienen borraria el trabajo hecho a mano.
      const { service, repo } = armar();
      await service.asignarUnidadMasiva({ unidadId: 'uni-1' });
      expect(repo.asignarUnidadMasiva).toHaveBeenCalledWith('uni-1', true);
    });

    it('con soloSinUnidad=false pisa todas', async () => {
      const { service, repo } = armar();
      await service.asignarUnidadMasiva({ unidadId: 'uni-1', soloSinUnidad: false });
      expect(repo.asignarUnidadMasiva).toHaveBeenCalledWith('uni-1', false);
    });

    it('REGRESION: valida la unidad ANTES de tocar ningun material', async () => {
      // Sin esto el updateMany fallaria a mitad con un error de FK poco claro.
      const { service, repo, unidades } = armar();
      unidades.obtener.mockRejectedValue(new NotFoundException('no existe'));
      await expect(service.asignarUnidadMasiva({ unidadId: 'fantasma' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.asignarUnidadMasiva).not.toHaveBeenCalled();
    });

    it('informa cuantos actualizo y cuantos siguen sin unidad', async () => {
      const { service, repo } = armar();
      repo.contarSinUnidad.mockResolvedValue(3);
      await expect(service.asignarUnidadMasiva({ unidadId: 'uni-1' })).resolves.toEqual({
        actualizados: 831,
        sinUnidad: 3,
      });
    });
  });
});
