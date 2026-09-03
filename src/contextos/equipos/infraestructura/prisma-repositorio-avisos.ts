import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AvisoEnviado, RepositorioAvisos, claveAviso } from '../puertos/repositorio-avisos';

@Injectable()
export class PrismaRepositorioAvisos implements RepositorioAvisos {
  constructor(private readonly prisma: PrismaService) {}

  async yaAvisados(claves: { planId: string; fechaService: Date }[]): Promise<Set<string>> {
    if (claves.length === 0) return new Set();

    // Un OR con todos los pares, en una sola consulta. Preguntar uno por uno
    // serían veinte viajes a la base cada mañana para no hacer nada.
    const filas = await this.prisma.avisoEnviado.findMany({
      where: { OR: claves.map((c) => ({ planId: c.planId, fechaService: c.fechaService })) },
      select: { planId: true, fechaService: true },
    });

    return new Set(filas.map((f) => claveAviso(f.planId, f.fechaService)));
  }

  async registrar(avisos: AvisoEnviado[]): Promise<void> {
    if (avisos.length === 0) return;

    // `skipDuplicates` por el índice único (planId, fechaService): si dos
    // disparos se pisan, el segundo no revienta con un error de clave repetida.
    await this.prisma.avisoEnviado.createMany({ data: avisos, skipDuplicates: true });
  }
}
