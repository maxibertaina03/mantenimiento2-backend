import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { UsuariosService } from './usuarios.service';
import { UsuariosRepository } from './usuarios.repository';

const usuario = {
  id: 'u-1',
  nombre: 'maxi',
  email: 'maxi@example.com',
  idExterno: 'clerk_123',
  rol: RolUsuario.OPERARIO,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function armar() {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => usuario),
    upsertPorEmail: jest.fn<Promise<any>, any[]>(async () => usuario),
    buscarTodos: jest.fn<Promise<any>, any[]>(async () => [usuario]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => usuario),
    buscarPorIdExterno: jest.fn<Promise<any>, any[]>(async () => null),
    buscarPorEmail: jest.fn<Promise<any>, any[]>(async () => null),
    actualizar: jest.fn<Promise<any>, any[]>(async () => usuario),
    contarPorRol: jest.fn<Promise<any>, any[]>(async () => 2),
    eliminar: jest.fn<Promise<any>, any[]>(async () => usuario),
  };

  return { repo, service: new UsuariosService(repo as unknown as UsuariosRepository) };
}

const datosClerk = { idExterno: 'clerk_123', email: 'maxi@example.com', nombre: 'maxi' };

describe('UsuariosService.buscarOCrearPorClerk()', () => {
  it('si ya existe por idExterno y no cambio nada, no escribe', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue(usuario);

    const res = await service.buscarOCrearPorClerk(datosClerk);

    expect(res).toBe(usuario);
    expect(repo.actualizar).not.toHaveBeenCalled();
    expect(repo.upsertPorEmail).not.toHaveBeenCalled();
  });

  it('sincroniza el nombre si cambio en Clerk', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue({ ...usuario, nombre: 'viejo' });

    await service.buscarOCrearPorClerk(datosClerk);

    expect(repo.actualizar).toHaveBeenCalledWith('u-1', {
      nombre: 'maxi',
      email: 'maxi@example.com',
    });
  });

  it('sincroniza el email si cambio en Clerk', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue({ ...usuario, email: 'viejo@example.com' });

    await service.buscarOCrearPorClerk(datosClerk);

    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('REGRESION: provisiona con upsert atomico (sin race buscar-luego-crear)', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue(null);

    await service.buscarOCrearPorClerk(datosClerk);

    // No debe haber un findUnique-por-email seguido de un create: eso es la race.
    expect(repo.crear).not.toHaveBeenCalled();
    expect(repo.upsertPorEmail).toHaveBeenCalledWith({
      idExterno: 'clerk_123',
      email: 'maxi@example.com',
      nombre: 'maxi',
      rol: RolUsuario.OPERARIO,
    });
  });

  it('REGRESION: dos provisioning simultaneos del mismo usuario no rompen', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue(null);

    const [a, b] = await Promise.all([
      service.buscarOCrearPorClerk(datosClerk),
      service.buscarOCrearPorClerk(datosClerk),
    ]);

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(repo.upsertPorEmail).toHaveBeenCalledTimes(2);
  });

  it('los usuarios nuevos entran como OPERARIO, nunca como ADMIN', async () => {
    const { repo, service } = armar();
    repo.buscarPorIdExterno.mockResolvedValue(null);

    await service.buscarOCrearPorClerk(datosClerk);

    expect(repo.upsertPorEmail.mock.calls[0][0].rol).toBe(RolUsuario.OPERARIO);
  });
});

describe('UsuariosService - CRUD', () => {
  it('obtener() lanza 404 si no existe', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualizar() valida existencia primero', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.actualizar('nope', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('eliminar() valida existencia primero', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('REGRESION: no se puede quitar el rol al ultimo administrador', async () => {
    // Sin esto, el unico ADMIN podia quitarse el rol desde la pantalla de
    // usuarios y nadie quedaba con permiso para devolverselo.
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.ADMIN });
    repo.contarPorRol.mockResolvedValue(1);

    await expect(
      service.actualizar('u-1', { rol: RolUsuario.OPERARIO } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('si hay mas de un administrador, si se puede degradar a uno', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.ADMIN });
    repo.contarPorRol.mockResolvedValue(2);

    await service.actualizar('u-1', { rol: RolUsuario.OPERARIO } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('promover a ADMIN nunca se bloquea', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.OPERARIO });
    repo.contarPorRol.mockResolvedValue(1);

    await service.actualizar('u-1', { rol: RolUsuario.ADMIN } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('cambiar el nombre de un admin no dispara la validacion', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.ADMIN });
    repo.contarPorRol.mockResolvedValue(1);

    await service.actualizar('u-1', { nombre: 'Otro nombre' } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('REGRESION: tampoco se elimina al ultimo administrador', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.ADMIN });
    repo.contarPorRol.mockResolvedValue(1);

    await expect(service.eliminar('u-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('eliminar un operario no toca la validacion de admins', async () => {
    const { repo, service } = armar();
    repo.buscarPorId.mockResolvedValue({ ...usuario, rol: RolUsuario.OPERARIO });

    await service.eliminar('u-1');
    expect(repo.eliminar).toHaveBeenCalledWith('u-1');
  });

  it('listar() devuelve la forma paginada', async () => {
    const { service } = armar();
    const res = await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
    expect(res).toMatchObject({ total: 1, pagina: 1, limite: 20 });
  });
});
