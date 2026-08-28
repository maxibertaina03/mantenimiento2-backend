import { Injectable, Logger } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { UsuariosService } from '../../usuarios/usuarios.service';
import {
  FilaImportacionDto,
  ImportarEquiposDto,
  ResultadoImportacionDto,
} from '../dto/importar-equipos.dto';
import { EquiposItRepository } from '../equipos-it.repository';
import {
  normalizarEstado,
  normalizarIdAccesoRemoto,
  normalizarNombrePersona,
  normalizarTipo,
  separarMarcaYModelo,
} from './normalizar';

/**
 * Importación masiva del inventario desde una planilla.
 *
 * Decisiones que definen el comportamiento:
 *
 * - **Idempotente por código interno**: volver a importar la misma planilla
 *   actualiza los equipos en vez de duplicarlos, así se puede corregir el
 *   archivo y reimportar sin ensuciar el inventario.
 * - **Las personas se dan de alta como usuarios sin acceso**: el inventario
 *   asigna equipos a gente que no usa el sistema. Se crean sin `idExterno`,
 *   así aparecen para asignar pero no pueden iniciar sesión.
 * - **Una fila con error no frena la importación**: se salta y se informa al
 *   final. Cortar todo por una celda mal escrita obligaría a arreglar el
 *   archivo entero antes de ver el primer resultado.
 * - **No se importan contraseñas.** La planilla trae las de AnyDesk y las
 *   grabadoras; guardarlas en texto plano expondría el acceso remoto a todos
 *   los equipos ante cualquier volcado de la base.
 */
@Injectable()
export class ImportarEquiposService {
  private readonly logger = new Logger(ImportarEquiposService.name);

  constructor(
    private readonly repo: EquiposItRepository,
    private readonly usuarios: UsuariosService,
  ) {}

  /**
   * Busca a la persona por nombre y, si no existe, la da de alta sin acceso.
   * El email es sintético porque la tabla lo exige y es único; estas personas
   * no reciben notificaciones ni pueden entrar.
   */
  private async resolverPersona(
    nombre: string,
    cache: Map<string, Usuario>,
    creados: string[],
  ): Promise<Usuario> {
    const clave = nombre.toLowerCase();
    const enCache = cache.get(clave);
    if (enCache) return enCache;

    const existente = await this.usuarios.buscarPorNombre(nombre);
    if (existente) {
      cache.set(clave, existente);
      return existente;
    }

    const emailSintetico = `${nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '')}@sin-acceso.local`;

    const nuevo = await this.usuarios.crearSinAcceso({ nombre, email: emailSintetico });
    cache.set(clave, nuevo);
    creados.push(nombre);
    return nuevo;
  }

  async importar(dto: ImportarEquiposDto): Promise<ResultadoImportacionDto> {
    const resultado: ResultadoImportacionDto = {
      creados: 0,
      actualizados: 0,
      conError: 0,
      usuariosCreados: [],
      revisarMarca: [],
      errores: [],
    };

    // Evita ir a la base una vez por fila para la misma persona.
    const personas = new Map<string, Usuario>();

    for (const [indice, fila] of dto.filas.entries()) {
      // +2: la fila 1 del archivo es el encabezado, y las planillas se cuentan
      // desde 1. Así el número que se informa coincide con lo que ve el usuario.
      const numeroFila = indice + 2;
      const identificador = fila.nombreEquipo?.trim() || `(fila ${numeroFila})`;

      try {
        await this.importarFila(fila, identificador, personas, resultado);
      } catch (error) {
        resultado.conError += 1;
        const motivo = error instanceof Error ? error.message : 'Error desconocido';
        resultado.errores.push({ fila: numeroFila, equipo: identificador, motivo });
        this.logger.warn(`Importación: fila ${numeroFila} (${identificador}) omitida: ${motivo}`);
      }
    }

    return resultado;
  }

  private async importarFila(
    fila: FilaImportacionDto,
    identificador: string,
    personas: Map<string, Usuario>,
    resultado: ResultadoImportacionDto,
  ): Promise<void> {
    const tipo = normalizarTipo(fila.tipo);
    if (!tipo) {
      throw new Error(
        `No se reconoce el tipo de equipo "${fila.tipo ?? ''}". Revisá esa celda en la planilla.`,
      );
    }

    const { marca, modelo, dudoso } = separarMarcaYModelo(fila.modelo);
    if (dudoso) resultado.revisarMarca.push(identificador);

    const accesoRemotoId = normalizarIdAccesoRemoto(fila.accesoRemotoId);
    const nombrePersona = normalizarNombrePersona(fila.asignadoA);

    let asignadoA: Usuario | null = null;
    if (nombrePersona) {
      asignadoA = await this.resolverPersona(nombrePersona, personas, resultado.usuariosCreados);
    }

    const datos = {
      codigoInterno: fila.nombreEquipo?.trim() || null,
      tipo,
      // Un equipo dado de baja no puede quedar asignado: si viene con persona,
      // manda el estado de la planilla igual, pero sin asignación.
      estado: normalizarEstado(fila.estado),
      marca,
      // `modelo` es obligatorio en el modelo: si la planilla no lo trae, se usa
      // el nombre del equipo para no perder la referencia.
      modelo: modelo || identificador,
      ubicacion: fila.ubicacion?.trim() || null,
      notas: fila.notas?.trim() || null,
      ...(accesoRemotoId ? { accesoRemoto: 'ANYDESK' as const, accesoRemotoId } : {}),
    };

    const existente = datos.codigoInterno
      ? await this.repo.buscarPorCodigoInterno(datos.codigoInterno)
      : null;

    if (existente) {
      await this.repo.actualizar(existente.id, datos);
      resultado.actualizados += 1;
      if (asignadoA && existente.asignadoAId !== asignadoA.id) {
        await this.repo.reasignar({
          equipoId: existente.id,
          usuarioId: asignadoA.id,
          registradoPorId: null,
          motivo: 'Importación de inventario',
          estadoResultante: datos.estado,
        });
      }
      return;
    }

    const creado = await this.repo.crear(datos);
    resultado.creados += 1;

    if (asignadoA) {
      await this.repo.reasignar({
        equipoId: creado.id,
        usuarioId: asignadoA.id,
        registradoPorId: null,
        motivo: 'Importación de inventario',
        estadoResultante: datos.estado,
      });
    }
  }
}
