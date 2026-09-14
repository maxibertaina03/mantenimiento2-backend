import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogosEquipoService, ModelosEquipoController } from './catalogos.controller';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Los catalogos de equipos: ubicaciones, tipos de planta, marcas y modelos.
 *
 * No tenian control de repetidos: se podia cargar «Sala de máquinas» dos veces
 * y el desplegable quedaba con dos filas iguales, con los equipos repartidos
 * entre las dos. Desde ahi, filtrar por ubicacion nunca vuelve a dar el total.
 */
const item = (id: string, nombre: string, equipos = 0) => ({
  id,
  nombre,
  orden: 0,
  activo: true,
  _count: { equipos },
});

function delegadoFalso(existentes: ReturnType<typeof item>[]) {
  return {
    findMany: jest.fn<Promise<any>, any[]>(async () => existentes),
    findUnique: jest.fn<Promise<any>, any[]>(
      async ({ where }: any) => existentes.find((e) => e.id === where.id) ?? null,
    ),
    create: jest.fn<Promise<any>, any[]>(async ({ data }: any) => item('nuevo', data.nombre)),
    update: jest.fn<Promise<any>, any[]>(async ({ where }: any) => item(where.id, 'editado')),
    delete: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
}

describe('CatalogosEquipoService', () => {
  const servicio = () => new CatalogosEquipoService({} as unknown as PrismaService);

  it('crea un item nuevo', async () => {
    const d = delegadoFalso([item('u-1', 'Sala de máquinas')]);
    await servicio().crear(d as any, { nombre: 'Pretratamiento' }, 'la ubicación');
    expect(d.create.mock.calls[0][0].data.nombre).toBe('Pretratamiento');
  });

  it('REGRESION: no deja crear un item que ya existe', async () => {
    const d = delegadoFalso([item('u-1', 'Sala de máquinas')]);
    await expect(
      servicio().crear(d as any, { nombre: 'SALA DE MAQUINAS' }, 'la ubicación'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(d.create).not.toHaveBeenCalled();
  });

  it('REGRESION: los acentos tampoco hacen un item nuevo', async () => {
    // Postgres compara sin distinguir mayusculas, pero no ignora acentos, y en
    // las carpetas de la planta conviven las dos formas de escribir el sector.
    const d = delegadoFalso([item('u-1', 'Elaboración')]);
    await expect(
      servicio().crear(d as any, { nombre: 'Elaboracion' }, 'la ubicación'),
    ).rejects.toThrow(/Elaboración/);
  });

  it('REGRESION: tampoco deja renombrar un item encima de otro', async () => {
    const d = delegadoFalso([item('u-1', 'Elaboración'), item('u-2', 'Envasado')]);
    await expect(
      servicio().actualizar(d as any, 'u-2', { nombre: 'Elaboracion' }, 'la ubicación'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(d.update).not.toHaveBeenCalled();
  });

  it('renombrarse a si mismo no choca', async () => {
    const d = delegadoFalso([item('u-1', 'Elaboración')]);
    await servicio().actualizar(
      d as any,
      'u-1',
      { nombre: 'Elaboración', orden: 2 },
      'la ubicación',
    );
    expect(d.update).toHaveBeenCalled();
  });

  it('desactivar sin tocar el nombre no dispara la validacion', async () => {
    const d = delegadoFalso([item('u-1', 'Elaboración')]);
    await servicio().actualizar(d as any, 'u-1', { activo: false }, 'la ubicación');
    expect(d.update.mock.calls[0][0].data.activo).toBe(false);
  });

  it('REGRESION: no borra un item que usan equipos', async () => {
    const d = delegadoFalso([item('u-1', 'Elaboración', 31)]);
    await expect(servicio().eliminar(d as any, 'u-1', 'la ubicación')).rejects.toThrow(/31/);
    expect(d.delete).not.toHaveBeenCalled();
  });
});

describe('ModelosEquipoController', () => {
  /** Un modelo es unico DENTRO de su marca, no en todo el catalogo. */
  function armar(modelos: { id: string; marcaId: string; nombre: string }[]) {
    const prisma = {
      marcaEquipo: {
        findUnique: jest.fn<Promise<any>, any[]>(async ({ where }: any) =>
          where.id === 'm-grundfos' ? { id: 'm-grundfos', nombre: 'Grundfos' } : null,
        ),
      },
      modeloEquipo: {
        findMany: jest.fn<Promise<any>, any[]>(async ({ where }: any) =>
          modelos.filter((m) => m.marcaId === where.marcaId),
        ),
        findUnique: jest.fn<Promise<any>, any[]>(async ({ where }: any) => {
          const m = modelos.find((x) => x.id === where.id);
          return m ? { ...m, orden: 0, activo: true, marca: { nombre: 'Grundfos' } } : null;
        }),
        create: jest.fn<Promise<any>, any[]>(async ({ data }: any) => ({
          id: 'nuevo',
          ...data,
          marca: { nombre: 'Grundfos' },
          _count: { equipos: 0 },
        })),
        update: jest.fn<Promise<any>, any[]>(async ({ where }: any) => ({
          id: where.id,
          marcaId: 'm-grundfos',
          nombre: 'editado',
          orden: 0,
          activo: true,
          marca: { nombre: 'Grundfos' },
          _count: { equipos: 0 },
        })),
      },
    } as unknown as PrismaService;
    return { prisma, controller: new ModelosEquipoController(prisma) };
  }

  it('404 si la marca no existe', async () => {
    const { controller } = armar([]);
    await expect(
      controller.crear({ marcaId: 'm-nope', nombre: '5030' } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('REGRESION: los acentos no hacen un modelo nuevo dentro de la marca', async () => {
    const { controller, prisma } = armar([
      { id: 'x-1', marcaId: 'm-grundfos', nombre: 'Rotátil 20' },
    ]);
    await expect(
      controller.crear({ marcaId: 'm-grundfos', nombre: 'Rotatil 20' } as any),
    ).rejects.toThrow(/Rotátil 20/);
    expect((prisma as any).modeloEquipo.create).not.toHaveBeenCalled();
  });

  it('el mismo nombre en OTRA marca si se puede: no es un choque', async () => {
    // El limite importa. Un "5030" de Grundfos y uno de Siemens conviven, y
    // bloquearlo seria inventar un conflicto que no existe.
    const { controller, prisma } = armar([{ id: 'x-1', marcaId: 'm-siemens', nombre: '5030' }]);
    await controller.crear({ marcaId: 'm-grundfos', nombre: '5030' } as any);
    expect((prisma as any).modeloEquipo.create).toHaveBeenCalled();
  });

  it('REGRESION: tampoco deja renombrar un modelo encima de otro de su marca', async () => {
    const { controller, prisma } = armar([
      { id: 'x-1', marcaId: 'm-grundfos', nombre: 'Rotátil 20' },
      { id: 'x-2', marcaId: 'm-grundfos', nombre: '5030' },
    ]);
    await expect(controller.actualizar('x-2', { nombre: 'Rotatil 20' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((prisma as any).modeloEquipo.update).not.toHaveBeenCalled();
  });

  it('renombrarse a si mismo no choca', async () => {
    const { controller, prisma } = armar([
      { id: 'x-1', marcaId: 'm-grundfos', nombre: 'Rotátil 20' },
    ]);
    await controller.actualizar('x-1', { nombre: 'Rotátil 20', orden: 5 });
    expect((prisma as any).modeloEquipo.update).toHaveBeenCalled();
  });
});
