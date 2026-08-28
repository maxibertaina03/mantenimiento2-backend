import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UnidadesMedidaRepository } from './unidades-medida.repository';
import { UnidadesMedidaService } from './unidades-medida.service';

const litro = {
  id: 'uni-1',
  nombre: 'Litro',
  simbolo: 'lt',
  orden: 70,
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function armar() {
  const repo = {
    buscarTodas: jest.fn<Promise<any>, any[]>(async () => [
      { ...litro, _count: { materiales: 0 } },
    ]),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => ({
      ...litro,
      _count: { materiales: 0 },
    })),
    buscarPorNombreOSimbolo: jest.fn<Promise<any>, any[]>(async () => null),
    crear: jest.fn<Promise<any>, any[]>(async (data) => ({
      ...litro,
      ...data,
      _count: { materiales: 0 },
    })),
    actualizar: jest.fn<Promise<any>, any[]>(async () => ({
      ...litro,
      _count: { materiales: 0 },
    })),
    eliminar: jest.fn<Promise<any>, any[]>(async () => litro),
  };
  return { repo, service: new UnidadesMedidaService(repo as unknown as UnidadesMedidaRepository) };
}

describe('UnidadesMedidaService', () => {
  describe('crear()', () => {
    it('da de alta la unidad con nombre y simbolo sin espacios de sobra', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: '  Litro ', simbolo: ' lt ' });
      expect(repo.crear).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Litro', simbolo: 'lt' }),
      );
    });

    it('REGRESION: rechaza una unidad que ya existe con otras mayusculas', async () => {
      // Es el problema que el catalogo viene a resolver: si dejara entrar "Lt"
      // teniendo "lt", volveria a haber dos unidades para la misma cosa.
      const { service, repo } = armar();
      repo.buscarPorNombreOSimbolo.mockResolvedValue(litro);
      await expect(service.crear({ nombre: 'LITRO', simbolo: 'Lt' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('el simbolo tambien se valida contra el catalogo, no solo el nombre', async () => {
      const { service, repo } = armar();
      // El nombre esta libre, pero el simbolo ya lo usa otra unidad.
      repo.buscarPorNombreOSimbolo.mockResolvedValueOnce(null).mockResolvedValueOnce(litro);
      await expect(
        service.crear({ nombre: 'Litros de agua', simbolo: 'lt' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('activo arranca en true si no se indica', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'Balde', simbolo: 'balde' });
      expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ activo: true }));
    });
  });

  describe('actualizar()', () => {
    it('no se queja de chocar consigo misma al editar', async () => {
      const { service, repo } = armar();
      repo.buscarPorNombreOSimbolo.mockResolvedValue(litro); // se encuentra a si misma
      await expect(
        service.actualizar('uni-1', { nombre: 'Litro', simbolo: 'lt', orden: 5 }),
      ).resolves.toMatchObject({ id: 'uni-1' });
    });

    it('sigue rechazando el choque con OTRA unidad', async () => {
      const { service, repo } = armar();
      repo.buscarPorNombreOSimbolo.mockResolvedValue({ ...litro, id: 'otra' });
      await expect(service.actualizar('uni-1', { nombre: 'Litro' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('404 si la unidad no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.actualizar('fantasma', { orden: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('eliminar()', () => {
    it('borra una unidad que no usa ningun material', async () => {
      const { service, repo } = armar();
      await service.eliminar('uni-1');
      expect(repo.eliminar).toHaveBeenCalledWith('uni-1');
    });

    it('REGRESION: no borra una unidad en uso, para no dejar materiales sin unidad', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue({ ...litro, _count: { materiales: 12 } });
      await expect(service.eliminar('uni-1')).rejects.toThrow(/12 material/);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('el error en uso sugiere desactivarla', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue({ ...litro, _count: { materiales: 3 } });
      await expect(service.eliminar('uni-1')).rejects.toThrow(/desactivala/);
    });
  });

  describe('listar()', () => {
    it('puede pedir solo las activas, para el desplegable del formulario', async () => {
      const { service, repo } = armar();
      await service.listar(true);
      expect(repo.buscarTodas).toHaveBeenCalledWith(true);
    });

    it('expone cuantos materiales usan cada unidad', async () => {
      const { service, repo } = armar();
      repo.buscarTodas.mockResolvedValue([{ ...litro, _count: { materiales: 7 } }]);
      await expect(service.listar()).resolves.toEqual([expect.objectContaining({ materiales: 7 })]);
    });
  });
});
