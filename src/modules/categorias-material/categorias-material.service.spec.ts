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
    listarNombres: jest.fn<Promise<any>, any[]>(async () => [categoria]),
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

  it('REGRESION: no deja crear una categoria que ya existe', async () => {
    // No habia ningun control: se podia cargar «Electricidad» dos veces y el
    // desplegable quedaba con dos filas iguales, cada una con la mitad de los
    // materiales. Ningun filtro por categoria vuelve a dar el total.
    const { service, repo } = armar();
    await expect(service.crear({ nombre: 'Electricidad' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('REGRESION: los acentos tampoco hacen otra categoria', async () => {
    // Postgres compara sin distinguir mayusculas, pero no ignora acentos. Por
    // eso la comparacion se hace en memoria, no en la consulta.
    const { service, repo } = armar();
    repo.listarNombres.mockResolvedValue([{ id: 'cat-1', nombre: 'Tornillería' }]);
    await expect(service.crear({ nombre: 'Tornilleria' } as any)).rejects.toThrow(/Tornillería/);
  });

  it('deja crear una categoria que de verdad es nueva', async () => {
    // El limite importa: si bloqueara de mas, la gente inventaria nombres para
    // esquivarlo y el catalogo quedaria peor que sin control.
    const { service, repo } = armar();
    await service.crear({ nombre: 'Neumatica' } as any);
    expect(repo.crear).toHaveBeenCalled();
  });

  it('al renombrar, la categoria no choca consigo misma', async () => {
    const { service, repo } = armar();
    await service.actualizar('cat-1', { nombre: 'Electricidad' } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('REGRESION: no deja renombrar una categoria encima de otra', async () => {
    const { service, repo } = armar();
    repo.listarNombres.mockResolvedValue([
      { id: 'cat-1', nombre: 'Electricidad' },
      { id: 'cat-2', nombre: 'Neumatica' },
    ]);
    await expect(
      service.actualizar('cat-2', { nombre: 'electricidad' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('actualizar() valida existencia primero', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.actualizar('nope', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});
