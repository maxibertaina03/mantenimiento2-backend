import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Lo que se trae de cada credencial en los listados.
 *
 * `secretoCifrado` y `huella` NO están acá a propósito. Si estuvieran, el
 * secreto cifrado viajaría por toda la aplicación en cada listado, y bastaría
 * un `console.log` de una fila para dejarlo escrito en los registros del
 * servidor. Se piden solo cuando hacen falta, con `buscarSecreto`.
 */
const CAMPOS_VISIBLES = {
  id: true,
  nombre: true,
  tipo: true,
  usuario: true,
  url: true,
  notas: true,
  equipoItId: true,
  rotarCadaDias: true,
  rotadaEn: true,
  proximaRotacion: true,
  activo: true,
  creadoEn: true,
  equipoIt: {
    select: {
      codigoInterno: true,
      marca: { select: { nombre: true } },
      modelo: { select: { nombre: true } },
    },
  },
  _count: { select: { rotaciones: true, vistas: true } },
} satisfies Prisma.CredencialSelect;

@Injectable()
export class CredencialesRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarTodas(where: Prisma.CredencialWhereInput, skip: number, take: number) {
    return this.prisma.credencial.findMany({
      where,
      skip,
      take,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: CAMPOS_VISIBLES,
    });
  }

  contar(where: Prisma.CredencialWhereInput): Promise<number> {
    return this.prisma.credencial.count({ where });
  }

  buscarPorId(id: string) {
    return this.prisma.credencial.findUnique({ where: { id }, select: CAMPOS_VISIBLES });
  }

  /** Los nombres de todas, para no dar de alta dos veces el mismo acceso. */
  listarNombres(): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.credencial.findMany({ select: { id: true, nombre: true } });
  }

  /**
   * El secreto cifrado y su huella. Se pide aparte y nunca en un listado: lo
   * que no viaja no se puede filtrar por accidente.
   */
  buscarSecreto(id: string): Promise<{ secretoCifrado: string; huella: string } | null> {
    return this.prisma.credencial.findUnique({
      where: { id },
      select: { secretoCifrado: true, huella: true },
    });
  }

  /** Las huellas de todas las contraseñas que esta credencial ya usó. */
  /**
   * Si existe ese equipo de IT.
   *
   * Va por acá y no por el módulo de equipos de IT para no atar los dos módulos
   * enteros por una pregunta de sí o no.
   */
  async existeEquipoIt(id: string): Promise<boolean> {
    const fila = await this.prisma.equipoIT.findUnique({ where: { id }, select: { id: true } });
    return fila !== null;
  }

  async huellasUsadas(id: string): Promise<string[]> {
    const [actual, anteriores] = await Promise.all([
      this.prisma.credencial.findUnique({ where: { id }, select: { huella: true } }),
      this.prisma.rotacionCredencial.findMany({
        where: { credencialId: id },
        select: { huellaAnterior: true },
      }),
    ]);
    return [...(actual ? [actual.huella] : []), ...anteriores.map((r) => r.huellaAnterior)];
  }

  crear(data: Prisma.CredencialUncheckedCreateInput) {
    return this.prisma.credencial.create({ data, select: CAMPOS_VISIBLES });
  }

  actualizar(id: string, data: Prisma.CredencialUncheckedUpdateInput) {
    return this.prisma.credencial.update({ where: { id }, data, select: CAMPOS_VISIBLES });
  }

  /**
   * Cambia la contraseña y anota la rotación en la misma transacción.
   *
   * Van juntas porque separadas pueden quedar a medias: la contraseña nueva
   * guardada y el historial sin la rotación, que es exactamente el estado en el
   * que el sistema miente sobre cuándo se cambió por última vez.
   */
  rotar(params: {
    id: string;
    secretoCifrado: string;
    huella: string;
    huellaAnterior: string;
    rotadaEn: Date;
    proximaRotacion: Date | null;
    rotadaPorId: string | null;
    motivo: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.rotacionCredencial.create({
        data: {
          credencialId: params.id,
          huellaAnterior: params.huellaAnterior,
          rotadaPorId: params.rotadaPorId,
          motivo: params.motivo,
          rotadaEn: params.rotadaEn,
        },
      });
      return tx.credencial.update({
        where: { id: params.id },
        data: {
          secretoCifrado: params.secretoCifrado,
          huella: params.huella,
          rotadaEn: params.rotadaEn,
          proximaRotacion: params.proximaRotacion,
        },
        select: CAMPOS_VISIBLES,
      });
    });
  }

  registrarVista(credencialId: string, usuarioId: string) {
    return this.prisma.vistaCredencial.create({ data: { credencialId, usuarioId } });
  }

  historial(id: string) {
    return this.prisma.$transaction([
      this.prisma.rotacionCredencial.findMany({
        where: { credencialId: id },
        orderBy: { rotadaEn: 'desc' },
        select: {
          id: true,
          rotadaEn: true,
          motivo: true,
          rotadaPor: { select: { nombre: true } },
        },
      }),
      this.prisma.vistaCredencial.findMany({
        where: { credencialId: id },
        orderBy: { vistaEn: 'desc' },
        take: 50,
        select: { id: true, vistaEn: true, usuario: { select: { nombre: true } } },
      }),
    ]);
  }

  eliminar(id: string): Promise<unknown> {
    return this.prisma.credencial.delete({ where: { id } });
  }
}
