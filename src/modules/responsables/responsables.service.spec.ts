import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ResponsablesService } from './responsables.controller';

/**
 * Responsables de equipos de IT.
 *
 * Existen porque el planteo original estaba mal: cada persona a la que se le
 * asignaba una notebook entraba como usuario del sistema, con un correo
 * inventado y un rol que nunca usaba. De 35 usuarios, 31 eran eso.
 */
const responsable = (id: string, nombre: string, equipos = 0, asignaciones = 0) => ({
  id,
  nombre,
  sector: null,
  notas: null,
  activo: true,
  _count: { equiposIt: equipos, asignaciones },
});

function armar(existentes: ReturnType<typeof responsable>[] = []) {
  const delegado = {
    findMany: jest.fn<Promise<any>, any[]>(async () => existentes),
    findUnique: jest.fn<Promise<any>, any[]>(
      async ({ where }: any) => existentes.find((r) => r.id === where.id) ?? null,
    ),
    create: jest.fn<Promise<any>, any[]>(async ({ data }: any) =>
      responsable('nuevo', data.nombre),
    ),
    update: jest.fn<Promise<any>, any[]>(async ({ where }: any) =>
      responsable(where.id, 'editado'),
    ),
    delete: jest.fn<Promise<any>, any[]>(async () => undefined),
    updateMany: jest.fn<Promise<any>, any[]>(async () => ({ count: 0 })),
  };
  const equipoIT = { updateMany: jest.fn<Promise<any>, any[]>(async () => ({ count: 3 })) };
  const asignacionEquipoIT = {
    updateMany: jest.fn<Promise<any>, any[]>(async () => ({ count: 5 })),
  };

  const prisma = {
    responsable: delegado,
    equipoIT,
    asignacionEquipoIT,
    // La transaccion ejecuta de verdad: asi se ejerce que unificar mueva las
    // dos tablas y recien despues desactive, no solo que llame a $transaction.
    $transaction: jest.fn(async (fn: any) =>
      fn({ responsable: delegado, equipoIT, asignacionEquipoIT }),
    ),
  } as unknown as PrismaService;

  return { delegado, equipoIT, asignacionEquipoIT, service: new ResponsablesService(prisma) };
}

describe('ResponsablesService', () => {
  describe('alta', () => {
    it('carga un responsable nuevo', async () => {
      const { service, delegado } = armar();
      await service.crear({ nombre: 'Julieta Redolfi' });
      expect(delegado.create.mock.calls[0][0].data.nombre).toBe('Julieta Redolfi');
    });

    it('REGRESION: no crea un usuario del sistema ni le inventa un correo', async () => {
      // Es el bug de fondo que este modulo viene a arreglar.
      const { service, delegado } = armar();
      await service.crear({ nombre: 'Julieta Redolfi' });

      const guardado = JSON.stringify(delegado.create.mock.calls[0][0]);
      expect(guardado).not.toContain('sin-acceso.local');
      expect(guardado).not.toContain('email');
      expect(guardado).not.toContain('rol');
    });

    it('acepta lo que no es una persona, porque el inventario real lo tiene', async () => {
      // "Operarios de expedicion", "Queco y German", "Jose Luis y Monica".
      const { service, delegado } = armar();
      await service.crear({ nombre: 'Operarios de expedición' });
      expect(delegado.create).toHaveBeenCalled();
    });

    it('REGRESION: no deja cargar dos veces a la misma persona', async () => {
      const { service, delegado } = armar([responsable('r-1', 'Julieta Redolfi')]);
      await expect(service.crear({ nombre: 'julieta redolfi' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(delegado.create).not.toHaveBeenCalled();
    });

    it('REGRESION: los acentos tampoco crean otra ficha', async () => {
      const { service } = armar([responsable('r-1', 'José Pérez')]);
      await expect(service.crear({ nombre: 'Jose Perez' })).rejects.toThrow(/José Pérez/);
    });
  });

  describe('unificar', () => {
    it('mueve los equipos y el historial, y desactiva al que se absorbe', async () => {
      // La carga original dejo a la misma persona dos veces: "Julieta" y
      // "Julieta Redolfi", "Romi Ubino" y "Romina Ubino".
      const { service, delegado, equipoIT, asignacionEquipoIT } = armar([
        responsable('r-1', 'Julieta Redolfi', 2),
        responsable('r-2', 'Julieta', 1),
      ]);

      await service.unificar('r-1', 'r-2');

      expect(equipoIT.updateMany).toHaveBeenCalledWith({
        where: { responsableId: 'r-2' },
        data: { responsableId: 'r-1' },
      });
      expect(asignacionEquipoIT.updateMany).toHaveBeenCalledWith({
        where: { responsableId: 'r-2' },
        data: { responsableId: 'r-1' },
      });
      expect(delegado.update).toHaveBeenCalledWith({
        where: { id: 'r-2' },
        data: { activo: false },
      });
    });

    it('REGRESION: el que se absorbe se desactiva, no se borra', async () => {
      // Si manana aparece que eran dos personas distintas, el nombre sigue
      // estando y se puede volver a activar.
      const { service, delegado } = armar([
        responsable('r-1', 'Julieta Redolfi'),
        responsable('r-2', 'Julieta'),
      ]);
      await service.unificar('r-1', 'r-2');
      expect(delegado.delete).not.toHaveBeenCalled();
    });

    it('no se unifica consigo mismo', async () => {
      const { service } = armar([responsable('r-1', 'Julieta')]);
      await expect(service.unificar('r-1', 'r-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404 si alguno de los dos no existe', async () => {
      const { service } = armar([responsable('r-1', 'Julieta')]);
      await expect(service.unificar('r-1', 'fantasma')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('baja', () => {
    it('borra uno que nunca tuvo nada', async () => {
      const { service, delegado } = armar([responsable('r-1', 'Julieta')]);
      await service.eliminar('r-1');
      expect(delegado.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    });

    it('REGRESION: no borra a quien tiene equipos a cargo', async () => {
      const { service, delegado } = armar([responsable('r-1', 'Maximo Bertaina', 20)]);
      await expect(service.eliminar('r-1')).rejects.toThrow(/20 equipo/);
      expect(delegado.delete).not.toHaveBeenCalled();
    });

    it('REGRESION: no borra a quien figura en el historial', async () => {
      // Borrarlo dejaria tramos del historial sin decir quien tenia el equipo.
      const { service, delegado } = armar([responsable('r-1', 'Julieta', 0, 4)]);
      await expect(service.eliminar('r-1')).rejects.toThrow(/historial/);
      expect(delegado.delete).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      const { service } = armar();
      await expect(service.eliminar('fantasma')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listado', () => {
    it('puede pedir solo los activos, para el desplegable', async () => {
      const { service, delegado } = armar([responsable('r-1', 'Julieta')]);
      await service.listar(true);
      expect(delegado.findMany.mock.calls[0][0].where).toEqual({ activo: true });
    });

    it('informa cuantos equipos tiene cada uno', async () => {
      const { service } = armar([responsable('r-1', 'Maximo Bertaina', 20, 20)]);
      await expect(service.listar(false)).resolves.toEqual([
        expect.objectContaining({ nombre: 'Maximo Bertaina', equipos: 20, asignaciones: 20 }),
      ]);
    });
  });
});
