import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsultaEquipos, EquipoReferenciado } from '../puertos/consulta-equipos';

/**
 * La capa anticorrupción contra el contexto de equipos.
 *
 * Lee la tabla directo en vez de pedirle el repositorio al otro contexto, y es
 * deliberado: así se trae exactamente lo que este contexto necesita —id, nombre
 * y código— sin arrastrar el modelo entero de equipos ni depender de su
 * módulo. Si mañana el equipo gana o pierde campos, acá no cambia nada.
 */
@Injectable()
export class PrismaConsultaEquipos implements ConsultaEquipos {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorId(id: string): Promise<EquipoReferenciado | null> {
    const fila = await this.prisma.equipo.findUnique({
      where: { id },
      select: { id: true, nombre: true, codigoInterno: true },
    });
    if (!fila) return null;
    return { id: fila.id, nombre: fila.nombre, codigo: fila.codigoInterno };
  }
}
