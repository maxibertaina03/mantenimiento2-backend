import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstanteriasMaterialService } from './estanterias-material.controller';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * El modulo se subio a produccion sin una sola prueba. Estas cubren lo unico
 * que puede romper datos: que entren dos estanterias con el mismo nombre, y
 * que se borre una que tiene materiales guardados adentro.
 */
const estanteria = (id: string, nombre: string, materiales = 0) => ({
  id,
  nombre,
  orden: 0,
  activo: true,
  _count: { materiales },
});

function armar(existentes: ReturnType<typeof estanteria>[] = []) {
  const delegado = {
    findMany: jest.fn<Promise<any>, any[]>(async () => existentes),
    findUnique: jest.fn<Promise<any>, any[]>(async ({ where }: any) => {
      return existentes.find((e) => e.id === where.id) ?? null;
    }),
    create: jest.fn<Promise<any>, any[]>(async ({ data }: any) => estanteria('nueva', data.nombre)),
    update: jest.fn<Promise<any>, any[]>(async ({ where }: any) => estanteria(where.id, 'editada')),
    delete: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  const prisma = { estanteriaMaterial: delegado } as unknown as PrismaService;
  return { delegado, service: new EstanteriasMaterialService(prisma) };
}

describe('EstanteriasMaterialService', () => {
  describe('alta', () => {
    it('crea una estanteria nueva', async () => {
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await service.crear({ nombre: 'Estantería B' });
      expect(delegado.create.mock.calls[0][0].data.nombre).toBe('Estantería B');
    });

    it('recorta los espacios de los costados', async () => {
      const { service, delegado } = armar();
      await service.crear({ nombre: '  Estantería C  ' });
      expect(delegado.create.mock.calls[0][0].data.nombre).toBe('Estantería C');
    });

    it('REGRESION: no deja crear una estanteria que ya existe', async () => {
      // Dos estanterias con el mismo nombre parten los materiales entre las
      // dos, y la pregunta «que hay en la A» deja de tener una sola respuesta.
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await expect(service.crear({ nombre: 'estantería a' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(delegado.create).not.toHaveBeenCalled();
    });

    it('REGRESION: los acentos tampoco hacen una estanteria nueva', async () => {
      // Postgres compara sin distinguir mayusculas, pero no ignora acentos: por
      // eso la comparacion se hace en memoria y no en la consulta.
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await expect(service.crear({ nombre: 'Estanteria A' })).rejects.toThrow(/Estantería A/);
      expect(delegado.create).not.toHaveBeenCalled();
    });
  });

  describe('edición', () => {
    it('REGRESION: no deja renombrar una estanteria encima de otra', async () => {
      // El duplicado entraba por esta puerta aunque el alta estuviera cubierta.
      const { service, delegado } = armar([
        estanteria('e-1', 'Estantería A'),
        estanteria('e-2', 'Estantería B'),
      ]);
      await expect(service.actualizar('e-2', { nombre: 'Estanteria A' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(delegado.update).not.toHaveBeenCalled();
    });

    it('renombrarse a si misma no choca', async () => {
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await service.actualizar('e-1', { nombre: 'Estantería A', orden: 3 });
      expect(delegado.update).toHaveBeenCalled();
    });

    it('desactivar sin tocar el nombre no dispara la validacion', async () => {
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await service.actualizar('e-1', { activo: false });
      expect(delegado.update.mock.calls[0][0].data.activo).toBe(false);
    });
  });

  describe('baja', () => {
    it('404 si no existe', async () => {
      const { service } = armar();
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('REGRESION: no borra una estanteria con materiales adentro', async () => {
      // Borrarla dejaria a esos materiales sin ubicacion, y nadie sabria donde
      // estaban. Lo correcto es desactivarla, y el mensaje lo dice.
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A', 47)]);
      await expect(service.eliminar('e-1')).rejects.toThrow(/47/);
      expect(delegado.delete).not.toHaveBeenCalled();
    });

    it('borra una estanteria vacia', async () => {
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A', 0)]);
      await service.eliminar('e-1');
      expect(delegado.delete).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    });
  });

  describe('listado', () => {
    it('puede pedir solo las activas, para el desplegable del material', async () => {
      const { service, delegado } = armar([estanteria('e-1', 'Estantería A')]);
      await service.listar(true);
      expect(delegado.findMany.mock.calls[0][0].where).toEqual({ activo: true });
    });

    it('informa cuantos materiales hay en cada una', async () => {
      const { service } = armar([estanteria('e-1', 'Estantería A', 47)]);
      await expect(service.listar(false)).resolves.toEqual([
        expect.objectContaining({ nombre: 'Estantería A', materiales: 47 }),
      ]);
    });
  });
});
