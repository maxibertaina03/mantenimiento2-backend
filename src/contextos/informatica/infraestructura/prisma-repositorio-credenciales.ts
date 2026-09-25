import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CambiosCredencial, Credencial, TipoCredencial } from '../dominio/credencial';
import { DIAS_DE_AVISO } from '../dominio/rotacion';
import {
  CredencialConRelaciones,
  DatosRotacion,
  FiltroCredenciales,
  RepositorioCredenciales,
  SecretoGuardado,
} from '../puertos/repositorio-credenciales';

/**
 * Lo que se trae de cada credencial.
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

type Fila = Prisma.CredencialGetPayload<{ select: typeof CAMPOS_VISIBLES }>;

/** El único archivo del baúl que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioCredenciales implements RepositorioCredenciales {
  constructor(private readonly prisma: PrismaService) {}

  private aDominio(fila: Fila): CredencialConRelaciones {
    const marcaYModelo = [fila.equipoIt?.marca?.nombre, fila.equipoIt?.modelo?.nombre]
      .filter(Boolean)
      .join(' ');

    return {
      id: fila.id,
      nombre: fila.nombre,
      tipo: fila.tipo as TipoCredencial,
      usuario: fila.usuario,
      url: fila.url,
      notas: fila.notas,
      equipoItId: fila.equipoItId,
      rotarCadaDias: fila.rotarCadaDias,
      rotadaEn: fila.rotadaEn,
      proximaRotacion: fila.proximaRotacion,
      activo: fila.activo,
      creadoEn: fila.creadoEn,
      equipoItCodigo: fila.equipoIt?.codigoInterno ?? null,
      // Igual que en el resto del sistema: si faltan marca y modelo, el que
      // identifica al equipo es el código interno pegado en la máquina.
      equipoItNombre: marcaYModelo || fila.equipoIt?.codigoInterno || null,
      vecesRotada: fila._count.rotaciones,
      vecesVista: fila._count.vistas,
    };
  }

  private where(filtro: FiltroCredenciales, hoy: Date): Prisma.CredencialWhereInput {
    const where: Prisma.CredencialWhereInput = {};

    if (!filtro.incluirInactivas) where.activo = true;
    if (filtro.tipo) where.tipo = filtro.tipo;
    if (filtro.equipoItId) where.equipoItId = filtro.equipoItId;

    if (filtro.buscar) {
      // `contains` y no comparación de identidad: acá se busca, no se decide
      // si dos nombres son el mismo. Ver `common/dominio/nombres`.
      where.OR = [
        { nombre: { contains: filtro.buscar, mode: 'insensitive' } },
        { usuario: { contains: filtro.buscar, mode: 'insensitive' } },
        { notas: { contains: filtro.buscar, mode: 'insensitive' } },
      ];
    }

    if (filtro.soloPorVencer) {
      const enUnaSemana = new Date(hoy);
      enUnaSemana.setUTCDate(enUnaSemana.getUTCDate() + DIAS_DE_AVISO);
      where.proximaRotacion = { lte: enUnaSemana };
    }

    return where;
  }

  async listar(
    filtro: FiltroCredenciales,
    skip: number,
    take: number,
    hoy: Date,
  ): Promise<CredencialConRelaciones[]> {
    const filas = await this.prisma.credencial.findMany({
      where: this.where(filtro, hoy),
      skip,
      take,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: CAMPOS_VISIBLES,
    });
    return filas.map((f) => this.aDominio(f));
  }

  contar(filtro: FiltroCredenciales, hoy: Date): Promise<number> {
    return this.prisma.credencial.count({ where: this.where(filtro, hoy) });
  }

  async buscarPorId(id: string): Promise<CredencialConRelaciones | null> {
    const fila = await this.prisma.credencial.findUnique({
      where: { id },
      select: CAMPOS_VISIBLES,
    });
    return fila ? this.aDominio(fila) : null;
  }

  listarNombres(): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.credencial.findMany({ select: { id: true, nombre: true } });
  }

  buscarSecreto(id: string): Promise<SecretoGuardado | null> {
    return this.prisma.credencial.findUnique({
      where: { id },
      select: { secretoCifrado: true, huella: true },
    });
  }

  async huellasUsadas(id: string): Promise<string[]> {
    const [actual, anteriores] = await Promise.all([
      this.prisma.credencial.findUnique({ where: { id }, select: { huella: true } }),
      this.prisma.rotacionCredencial.findMany({
        where: { credencialId: id },
        select: { huellaAnterior: true },
      }),
    ]);

    return [...(actual?.huella ? [actual.huella] : []), ...anteriores.map((r) => r.huellaAnterior)];
  }

  async crear(
    credencial: Omit<Credencial, 'id' | 'creadoEn'> & SecretoGuardado,
  ): Promise<CredencialConRelaciones> {
    const fila = await this.prisma.credencial.create({
      data: {
        nombre: credencial.nombre,
        tipo: credencial.tipo,
        usuario: credencial.usuario,
        url: credencial.url,
        notas: credencial.notas,
        equipoItId: credencial.equipoItId,
        rotarCadaDias: credencial.rotarCadaDias,
        // En la base no es opcional: una credencial siempre empieza a correr
        // cuando se guarda. En el dominio es nullable porque el tipo describe
        // tambien a las que se leen, y ahi puede faltar.
        ...(credencial.rotadaEn ? { rotadaEn: credencial.rotadaEn } : {}),
        proximaRotacion: credencial.proximaRotacion,
        activo: credencial.activo,
        secretoCifrado: credencial.secretoCifrado,
        huella: credencial.huella,
      },
      select: CAMPOS_VISIBLES,
    });
    return this.aDominio(fila);
  }

  async actualizar(id: string, cambios: CambiosCredencial): Promise<CredencialConRelaciones> {
    const fila = await this.prisma.credencial.update({
      where: { id },
      data: {
        ...(cambios.nombre === undefined ? {} : { nombre: cambios.nombre }),
        ...(cambios.tipo === undefined ? {} : { tipo: cambios.tipo }),
        ...(cambios.usuario === undefined ? {} : { usuario: cambios.usuario }),
        ...(cambios.url === undefined ? {} : { url: cambios.url }),
        ...(cambios.notas === undefined ? {} : { notas: cambios.notas }),
        ...(cambios.equipoItId === undefined ? {} : { equipoItId: cambios.equipoItId }),
        ...(cambios.rotarCadaDias === undefined ? {} : { rotarCadaDias: cambios.rotarCadaDias }),
        ...(cambios.activo === undefined ? {} : { activo: cambios.activo }),
      },
      select: CAMPOS_VISIBLES,
    });
    return this.aDominio(fila);
  }

  /**
   * Cambia la contraseña y anota la rotación en la misma transacción.
   *
   * Van juntas porque separadas pueden quedar a medias: la contraseña nueva
   * guardada y el historial sin la rotación, que es exactamente el estado en
   * el que el sistema miente sobre cuándo se cambió por última vez.
   */
  async rotar(datos: DatosRotacion): Promise<CredencialConRelaciones> {
    const fila = await this.prisma.$transaction(async (tx) => {
      await tx.rotacionCredencial.create({
        data: {
          credencialId: datos.id,
          huellaAnterior: datos.huellaAnterior,
          rotadaPorId: datos.rotadaPorId,
          motivo: datos.motivo,
          rotadaEn: datos.rotadaEn,
        },
      });
      return tx.credencial.update({
        where: { id: datos.id },
        data: {
          secretoCifrado: datos.secretoCifrado,
          huella: datos.huella,
          rotadaEn: datos.rotadaEn,
          proximaRotacion: datos.proximaRotacion,
        },
        select: CAMPOS_VISIBLES,
      });
    });
    return this.aDominio(fila);
  }

  registrarVista(credencialId: string, usuarioId: string): Promise<{ vistaEn: Date }> {
    return this.prisma.vistaCredencial.create({
      data: { credencialId, usuarioId },
      select: { vistaEn: true },
    });
  }

  async historial(id: string) {
    const [rotaciones, vistas] = await this.prisma.$transaction([
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

    return {
      rotaciones: rotaciones.map((r) => ({
        id: r.id,
        rotadaEn: r.rotadaEn,
        motivo: r.motivo,
        rotadaPorNombre: r.rotadaPor?.nombre ?? null,
      })),
      vistas: vistas.map((v) => ({
        id: v.id,
        vistaEn: v.vistaEn,
        usuarioNombre: v.usuario?.nombre ?? null,
      })),
    };
  }

  async eliminar(id: string): Promise<void> {
    await this.prisma.credencial.delete({ where: { id } });
  }
}
