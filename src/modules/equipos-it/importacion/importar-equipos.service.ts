import { Injectable, Logger } from '@nestjs/common';
import { Responsable } from '@prisma/client';
import type { TipoEquipo } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TiposEquipoRepository } from '../../tipos-equipo/tipos-equipo.repository';
import { claveDeComparacion, sonElMismoNombre } from '../../../common/dominio/nombres';
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
 * - **Las personas se dan de alta como responsables, no como usuarios**: el
 *   inventario asigna equipos a gente que no usa el sistema, y a veces ni
 *   siquiera a una persona ("Operarios de expedición", "Queco y German"). Antes
 *   entraban como usuarios con un correo inventado; eso estaba mal planteado.
 * - **Marca, modelo y ubicación salen de catálogos**: la planilla los trae como
 *   texto, y lo que no está en el catálogo se da de alta. Así "Tp Link" y
 *   "Tplink" dejan de ser dos marcas.
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
    private readonly tipos: TiposEquipoRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Busca al responsable por nombre y, si no existe, lo da de alta.
   *
   * Ya no crea un usuario del sistema: ese planteo obligaba a inventarle un
   * correo a cada persona que recibía una notebook, y dejaba 31 usuarios que
   * nunca iban a iniciar sesión.
   */
  private async resolverResponsable(
    nombre: string,
    cache: Map<string, Responsable>,
    creados: string[],
  ): Promise<Responsable> {
    // La misma clave que usa el resto del sistema para decidir si dos nombres
    // son la misma persona: con `toLowerCase()` a secas, «José» y «Jose» eran
    // dos entradas distintas del cache y la misma planilla creaba dos fichas.
    const clave = claveDeComparacion(nombre);
    const enCache = cache.get(clave);
    if (enCache) return enCache;

    // Se traen todos y se compara en memoria: son decenas de filas y Postgres,
    // sin la extensión `unaccent`, no ignora los acentos.
    const todos = await this.prisma.responsable.findMany();
    const existente = todos.find((r) => sonElMismoNombre(r.nombre, nombre));
    if (existente) {
      cache.set(clave, existente);
      return existente;
    }

    const nuevo = await this.prisma.responsable.create({ data: { nombre } });
    cache.set(clave, nuevo);
    creados.push(nombre);
    return nuevo;
  }

  /**
   * Devuelve el id de un item del catálogo, dándolo de alta si no está.
   *
   * La planilla trae marca y ubicación como texto libre, y ahí es donde nacen
   * los duplicados: "Tp Link" junto a "Tplink", "Oficina deposito" junto a
   * "Oficina Deposito". Comparando en memoria, el segundo encuentra al primero.
   */
  private async resolverCatalogo(
    tabla: 'marcaEquipo' | 'ubicacionEquipo',
    nombre: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const clave = `${tabla}:${claveDeComparacion(nombre)}`;
    const enCache = cache.get(clave);
    if (enCache) return enCache;

    const delegado = this.prisma[tabla] as {
      findMany(args: unknown): Promise<{ id: string; nombre: string }[]>;
      create(args: unknown): Promise<{ id: string }>;
    };
    const todos = await delegado.findMany({ select: { id: true, nombre: true } });
    const existente = todos.find((x) => sonElMismoNombre(x.nombre, nombre));

    const id = existente
      ? existente.id
      : (await delegado.create({ data: { nombre: nombre.trim() } })).id;
    cache.set(clave, id);
    return id;
  }

  /** El modelo cuelga de una marca: sin marca no se puede catalogar. */
  private async resolverModelo(
    marcaId: string,
    nombre: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const clave = `modelo:${marcaId}:${claveDeComparacion(nombre)}`;
    const enCache = cache.get(clave);
    if (enCache) return enCache;

    const todos = await this.prisma.modeloEquipo.findMany({
      where: { marcaId },
      select: { id: true, nombre: true },
    });
    const existente = todos.find((x) => sonElMismoNombre(x.nombre, nombre));

    const id = existente
      ? existente.id
      : (await this.prisma.modeloEquipo.create({ data: { marcaId, nombre: nombre.trim() } })).id;
    cache.set(clave, id);
    return id;
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

    // Evita ir a la base una vez por fila para la misma persona o el mismo
    // item de catálogo.
    const personas = new Map<string, Responsable>();
    const catalogos = new Map<string, string>();

    // El catálogo se lee una sola vez: es el mismo para todas las filas.
    const catalogo = await this.tipos.buscarTodos();

    for (const [indice, fila] of dto.filas.entries()) {
      // +2: la fila 1 del archivo es el encabezado, y las planillas se cuentan
      // desde 1. Así el número que se informa coincide con lo que ve el usuario.
      const numeroFila = indice + 2;
      const identificador = fila.nombreEquipo?.trim() || `(fila ${numeroFila})`;

      try {
        await this.importarFila(fila, identificador, personas, catalogos, catalogo, resultado);
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
    personas: Map<string, Responsable>,
    catalogos: Map<string, string>,
    catalogo: TipoEquipo[],
    resultado: ResultadoImportacionDto,
  ): Promise<void> {
    const tipo = normalizarTipo(fila.tipo, catalogo);
    if (!tipo) {
      throw new Error(
        `No se reconoce el tipo de equipo "${fila.tipo ?? ''}". ` +
          'Agregalo en Tipos de equipo o corregí esa celda en la planilla.',
      );
    }

    const { marca, modelo, dudoso } = separarMarcaYModelo(fila.modelo);
    if (dudoso) resultado.revisarMarca.push(identificador);

    const accesoRemotoId = normalizarIdAccesoRemoto(fila.accesoRemotoId);
    const nombrePersona = normalizarNombrePersona(fila.asignadoA);

    let responsable: Responsable | null = null;
    if (nombrePersona) {
      responsable = await this.resolverResponsable(
        nombrePersona,
        personas,
        resultado.usuariosCreados,
      );
    }

    const codigoInterno = fila.nombreEquipo?.trim() || null;

    const marcaId = marca ? await this.resolverCatalogo('marcaEquipo', marca, catalogos) : null;

    // Si el "modelo" de la planilla es el nombre del equipo repetido, no es un
    // modelo y no entra al catálogo: el dato ya vive en el código interno.
    const esElCodigoRepetido =
      !!modelo && !!codigoInterno && sonElMismoNombre(modelo, codigoInterno);
    const modeloId =
      marcaId && modelo && !esElCodigoRepetido
        ? await this.resolverModelo(marcaId, modelo, catalogos)
        : null;

    const ubicacionTexto = fila.ubicacion?.trim();
    const ubicacionId = ubicacionTexto
      ? await this.resolverCatalogo('ubicacionEquipo', ubicacionTexto, catalogos)
      : null;

    // Un modelo real que quedó sin marca no puede catalogarse, así que se
    // guarda en las notas para no perderlo.
    const modeloSinMarca = !marcaId && modelo && !esElCodigoRepetido ? modelo : null;
    const notasBase = fila.notas?.trim() || '';
    const notas =
      [notasBase, modeloSinMarca ? `Modelo sin marca asignada: ${modeloSinMarca}` : '']
        .filter(Boolean)
        .join('\n') || null;

    const datos = {
      codigoInterno,
      tipoId: tipo.id,
      // Un equipo dado de baja no puede quedar a cargo de alguien: si viene con
      // persona, manda el estado de la planilla igual, pero sin responsable.
      estado: normalizarEstado(fila.estado),
      marcaId,
      modeloId,
      ubicacionId,
      notas,
      ...(accesoRemotoId ? { accesoRemoto: 'ANYDESK' as const, accesoRemotoId } : {}),
    };

    const existente = datos.codigoInterno
      ? await this.repo.buscarPorCodigoInterno(datos.codigoInterno)
      : null;

    if (existente) {
      await this.repo.actualizar(existente.id, datos);
      resultado.actualizados += 1;
      if (responsable && existente.responsableId !== responsable.id) {
        await this.repo.reasignar({
          equipoId: existente.id,
          responsableId: responsable.id,
          registradoPorId: null,
          motivo: 'Importación de inventario',
          estadoResultante: datos.estado,
        });
      }
      return;
    }

    const creado = await this.repo.crear(datos);
    resultado.creados += 1;

    if (responsable) {
      await this.repo.reasignar({
        equipoId: creado.id,
        responsableId: responsable.id,
        registradoPorId: null,
        motivo: 'Importación de inventario',
        estadoResultante: datos.estado,
      });
    }
  }
}
