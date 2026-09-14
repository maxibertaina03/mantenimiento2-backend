import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoEquipoIT, Usuario } from '@prisma/client';
import { EquiposItService } from './equipos-it.service';
import { EquiposItRepository } from './equipos-it.repository';
import { ResponsablesService } from '../responsables/responsables.controller';

const equipoBase = {
  id: 'eq-1',
  codigoInterno: 'IT-0042',
  tipoId: 'tipo-notebook',
  tipo: { nombre: 'Notebook', llevaEspecificaciones: true },
  estado: EstadoEquipoIT.EN_DEPOSITO,
  marcaId: 'marca-dell',
  marca: { nombre: 'Dell' },
  modeloId: 'modelo-latitude',
  modelo: { nombre: 'Latitude 5420' },
  numeroSerie: 'SN-123',
  procesador: 'Intel Core i5',
  memoriaRamGb: 16,
  discoTipo: 'SSD',
  discoCapacidadGb: 512,
  sistemaOperativo: 'Windows 11 Pro',
  direccionIp: '192.168.1.50',
  direccionMac: '00:1A:2B:3C:4D:5E',
  nombreEnRed: 'PC-ADMIN-01',
  accesoRemoto: 'ANYDESK',
  accesoRemotoId: '123 456 789',
  ubicacionId: 'ubi-admin',
  ubicacion: { nombre: 'Administración' },
  proveedorId: null,
  fechaCompra: null,
  garantiaHasta: null,
  notas: null,
  responsableId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  proveedor: null,
  responsable: null,
};

function armar(equipo: any = equipoBase) {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => equipo),
    buscarConFiltros: jest.fn<Promise<any>, any[]>(async () => [equipo]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => equipo),
    buscarPorCodigoInterno: jest.fn<Promise<any>, any[]>(async () => null),
    actualizar: jest.fn<Promise<any>, any[]>(async () => equipo),
    reasignar: jest.fn<Promise<any>, any[]>(async () => equipo),
    listarAsignaciones: jest.fn<Promise<any>, any[]>(async () => []),
    resumen: jest.fn<Promise<any>, any[]>(async () => ({ porTipo: [], porEstado: [], total: 0 })),
    eliminar: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  const responsables = {
    obtener: jest.fn<Promise<any>, any[]>(async () => ({ id: 'resp-1', nombre: 'Julieta' })),
  };

  return {
    repo,
    responsables,
    service: new EquiposItService(
      repo as unknown as EquiposItRepository,
      responsables as unknown as ResponsablesService,
    ),
  };
}

const dtoBase = { tipoId: 'tipo-notebook', marcaId: 'marca-dell', modeloId: 'modelo-latitude' };

describe('EquiposItService - alta', () => {
  it('un equipo sin asignar nace EN_DEPOSITO', async () => {
    const { service, repo } = armar();
    await service.crear(dtoBase as any);
    expect(repo.crear.mock.calls[0][0].estado).toBe(EstadoEquipoIT.EN_DEPOSITO);
  });

  it('un equipo que nace a cargo de alguien queda EN_USO', async () => {
    const { service, repo } = armar();
    await service.crear({ ...dtoBase, responsableId: 'resp-1' } as any);
    expect(repo.crear.mock.calls[0][0].estado).toBe(EstadoEquipoIT.EN_USO);
  });

  it('REGRESION: si nace a cargo de alguien, el historial arranca con ese tramo', async () => {
    const { service, repo } = armar();
    await service.crear({ ...dtoBase, responsableId: 'resp-1' } as any);
    expect(repo.reasignar).toHaveBeenCalled();
    expect(repo.reasignar.mock.calls[0][0].motivo).toBe('Alta del equipo');
  });

  it('REGRESION: rechaza un codigo interno ya usado', async () => {
    const { service, repo } = armar();
    repo.buscarPorCodigoInterno.mockResolvedValue({
      id: 'otro',
      marca: 'HP',
      modelo: 'EliteBook',
    });
    await expect(service.crear({ ...dtoBase, codigoInterno: 'IT-0042' } as any)).rejects.toThrow(
      /Ya existe un equipo/,
    );
  });

  it('valida que el responsable exista', async () => {
    const { service, responsables } = armar();
    responsables.obtener.mockRejectedValue(new NotFoundException('no existe'));
    await expect(
      service.crear({ ...dtoBase, responsableId: 'fantasma' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('REGRESION: no se puede dar de alta dado de baja y a cargo de alguien a la vez', async () => {
    const { service } = armar();
    await expect(
      service.crear({
        ...dtoBase,
        estado: EstadoEquipoIT.DADO_DE_BAJA,
        responsableId: 'resp-1',
      } as any),
    ).rejects.toThrow(/dado de baja/);
  });

  it('acepta una camara sin procesador ni RAM', async () => {
    const { service } = armar();
    await expect(
      service.crear({
        tipoId: 'tipo-camara',
        marca: 'Hikvision',
        modelo: 'DS-2CD1043',
        direccionIp: '192.168.1.90',
      } as any),
    ).resolves.toBeDefined();
  });
});

describe('EquiposItService - asignacion', () => {
  it('asignar a un usuario deja el equipo EN_USO', async () => {
    const { service, repo } = armar();
    await service.asignar('eq-1', { responsableId: 'resp-1' } as any);
    expect(repo.reasignar.mock.calls[0][0].estadoResultante).toBe(EstadoEquipoIT.EN_USO);
    expect(repo.reasignar.mock.calls[0][0].responsableId).toBe('resp-1');
  });

  it('devolver a deposito (usuarioId null) deja el equipo EN_DEPOSITO', async () => {
    const asignado = { ...equipoBase, responsableId: 'resp-1', estado: EstadoEquipoIT.EN_USO };
    const { service, repo } = armar(asignado);
    await service.asignar('eq-1', { responsableId: null } as any);
    expect(repo.reasignar.mock.calls[0][0].responsableId).toBeNull();
    expect(repo.reasignar.mock.calls[0][0].estadoResultante).toBe(EstadoEquipoIT.EN_DEPOSITO);
  });

  it('registra quien hizo el movimiento', async () => {
    const { service, repo } = armar();
    await service.asignar('eq-1', { responsableId: 'resp-1' } as any, { id: 'admin-1' } as Usuario);
    expect(repo.reasignar.mock.calls[0][0].registradoPorId).toBe('admin-1');
  });

  it('guarda el motivo del movimiento', async () => {
    const { service, repo } = armar();
    await service.asignar('eq-1', {
      responsableId: 'resp-1',
      motivo: 'Ingreso de personal',
    } as any);
    expect(repo.reasignar.mock.calls[0][0].motivo).toBe('Ingreso de personal');
  });

  it('REGRESION: no se puede asignar un equipo dado de baja', async () => {
    const { service, repo } = armar({ ...equipoBase, estado: EstadoEquipoIT.DADO_DE_BAJA });
    await expect(service.asignar('eq-1', { responsableId: 'resp-1' } as any)).rejects.toThrow(
      /dado de baja/,
    );
    expect(repo.reasignar).not.toHaveBeenCalled();
  });

  it('REGRESION: reasignar al mismo responsable se rechaza (no ensucia el historial)', async () => {
    const { service, repo } = armar({ ...equipoBase, responsableId: 'resp-1' });
    await expect(service.asignar('eq-1', { responsableId: 'resp-1' } as any)).rejects.toThrow(
      /ya está a cargo/,
    );
    expect(repo.reasignar).not.toHaveBeenCalled();
  });

  it('devolver a deposito un equipo que ya esta en deposito se rechaza', async () => {
    const { service } = armar();
    await expect(service.asignar('eq-1', { responsableId: null } as any)).rejects.toThrow(
      /ya está en depósito/,
    );
  });

  it('lanza 404 si el equipo no existe', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(
      service.asignar('nope', { responsableId: 'resp-1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EquiposItService - listado y consultas', () => {
  it('pasa los filtros al repositorio', async () => {
    const { service, repo } = armar();
    await service.listar({
      pagina: 1,
      limite: 20,
      skip: 0,
      tipoId: 'tipo-servidor',
      estado: EstadoEquipoIT.EN_USO,
      buscar: 'dell',
    } as any);
    expect(repo.buscarConFiltros.mock.calls[0][0]).toMatchObject({
      tipoId: 'tipo-servidor',
      estado: EstadoEquipoIT.EN_USO,
      buscar: 'dell',
    });
  });

  it('obtener() lanza 404 si no existe', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca la garantia vencida', async () => {
    const vencida = { ...equipoBase, garantiaHasta: new Date('2020-01-01') };
    const { service } = armar(vencida);
    const res = await service.obtener('eq-1');
    expect(res.garantiaVencida).toBe(true);
  });

  it('no marca vencida una garantia futura', async () => {
    const vigente = { ...equipoBase, garantiaHasta: new Date('2099-01-01') };
    const { service } = armar(vigente);
    expect((await service.obtener('eq-1')).garantiaVencida).toBe(false);
  });

  it('sin garantia cargada no la marca vencida', async () => {
    const { service } = armar();
    expect((await service.obtener('eq-1')).garantiaVencida).toBe(false);
  });
});

describe('EquiposItService - baja', () => {
  it('REGRESION: no se elimina un equipo asignado', async () => {
    const { service, repo } = armar({ ...equipoBase, responsableId: 'resp-1' });
    await expect(service.eliminar('eq-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });

  it('elimina un equipo en deposito', async () => {
    const { service, repo } = armar();
    await service.eliminar('eq-1');
    expect(repo.eliminar).toHaveBeenCalledWith('eq-1');
  });
});
