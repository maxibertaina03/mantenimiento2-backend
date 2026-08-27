import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriasMaterialService } from './categorias-material.service';
import { CategoriasMaterialRepository } from './categorias-material.repository';

const categoria = { id: 'cat-1', nombre: 'Electricidad', descripcion: null };

function armar() {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => categoria),
    buscarTodas: jest.fn<Promise<any>, any[]>(async () => [categoria]),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => categoria),
    actualizar: jest.fn<Promise<any>, any[]>(async () => categoria),
    eliminar: jest.fn<Promise<any>, any[]>(async () => categoria),
    contarMateriales: jest.fn<Promise<any>, any[]>(async () => 0),
  };

  return {
    repo,
    service: new CategoriasMaterialService(repo as unknown as CategoriasMaterialRepository),
  };
}

describe('CategoriasMaterialService', () => {
  it('obtener() lanza 404 si no existe', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar() devuelve todas las categorias', async () => {
    const { service } = armar();
    await expect(service.listar()).resolves.toHaveLength(1);
  });

  it('impide borrar una categoria en uso', async () => {
    const { service, repo } = armar();
    repo.contarMateriales.mockResolvedValue(831);
    await expect(service.eliminar('cat-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('el mensaje de error dice cuantos materiales la usan', async () => {
    const { service, repo } = armar();
    repo.contarMateriales.mockResolvedValue(831);
    await expect(service.eliminar('cat-1')).rejects.toThrow(/831/);
  });

  it('borra si no tiene materiales asociados', async () => {
    const { service, repo } = armar();
    await service.eliminar('cat-1');
    expect(repo.eliminar).toHaveBeenCalledWith('cat-1');
  });

  it('actualizar() valida existencia primero', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.actualizar('nope', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});
