import { ErrorDominio } from '../../../common/dominio/errores';
import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import {
  contarRenglon,
  decidir,
  resumirToma,
  ResumenToma,
  validarAnulable,
  validarCierre,
  validarQueEstaAbierta,
} from '../dominio/toma-inventario';
import { Reloj, relojDelSistema } from '../puertos/reloj';
import {
  RenglonConMaterial,
  RepositorioTomas,
  TomaConRelaciones,
} from '../puertos/repositorio-tomas';
import { RegistrarMovimientos } from './registrar-movimientos';

export interface DetalleToma {
  toma: TomaConRelaciones;
  renglones: RenglonConMaterial[];
  resumen: ResumenToma;
}

/** Lo que pasó en una confirmación, para mostrarlo. */
export interface ResultadoConfirmacion extends DetalleToma {
  ajustados: number;
  sinDiferencia: number;
  recontar: number;
  /** Materiales que no se pudieron ajustar, y por qué (por ejemplo, salieron de circulación). */
  errores: { materialNombre: string; motivo: string }[];
}

/** 2,5 → «2,5»; 3 → «3». */
const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

/**
 * Abrir, contar, confirmar y anular una toma de inventario.
 *
 * Los ajustes pasan por `RegistrarMovimientos`, el mismo camino que un ajuste
 * cargado a mano: valen las mismas reglas (el material tiene que estar en uso,
 * nada por detrás del último ajuste) y quedan en el historial como cualquier
 * otro, con la nota de la toma.
 */
export class TomarInventario {
  constructor(
    private readonly repo: RepositorioTomas,
    private readonly movimientos: RegistrarMovimientos,
    private readonly reloj: Reloj = relojDelSistema,
  ) {}

  private async traer(id: string): Promise<TomaConRelaciones> {
    const toma = await this.repo.buscarPorId(id);
    if (!toma) throw new ErrorNoEncontrado(`No existe la toma de inventario con id ${id}`);
    return toma;
  }

  async abrir(
    datos: { categoriaId?: string | null; estanteriaId?: string | null; notas?: string | null },
    usuarioId: string | null,
  ): Promise<TomaConRelaciones> {
    const alcance = {
      categoriaId: datos.categoriaId ?? null,
      estanteriaId: datos.estanteriaId ?? null,
    };
    const materialIds = await this.repo.materialesDelAlcance(alcance);
    if (materialIds.length === 0) {
      throw new ErrorDatosInvalidos('No hay materiales en uso en lo que se eligió para contar.');
    }
    const notas = (datos.notas ?? '').trim();
    return this.repo.crear(
      {
        ...alcance,
        estado: 'ABIERTA',
        notas: notas === '' ? null : notas,
        abiertaEn: this.reloj.ahora(),
        abiertaPorId: usuarioId,
        cerradaEn: null,
        cerradaPorId: null,
        motivoAnulacion: null,
      },
      materialIds,
    );
  }

  listar(): Promise<TomaConRelaciones[]> {
    return this.repo.listar();
  }

  async detalle(id: string): Promise<DetalleToma> {
    const toma = await this.traer(id);
    const renglones = await this.repo.renglones(id);
    return { toma, renglones, resumen: resumirToma(renglones) };
  }

  async contar(
    tomaId: string,
    renglonId: string,
    cantidad: number | null,
    usuarioId: string | null,
  ): Promise<RenglonConMaterial> {
    const toma = await this.traer(tomaId);
    const renglon = await this.repo.buscarRenglon(renglonId);
    if (!renglon || renglon.tomaId !== tomaId) {
      throw new ErrorNoEncontrado('Ese material no está en esta toma.');
    }
    return this.repo.actualizarRenglon(
      renglonId,
      contarRenglon(toma, renglon, cantidad, renglon.stockActual, this.reloj.ahora(), usuarioId),
    );
  }

  /**
   * Ajusta lo que se puede y deja marcado lo que hay que volver a contar.
   *
   * La toma se cierra sola solo si ya está todo: contado, ajustado y sin nada
   * para volver a contar. Si no, sigue abierta: se puede contar por tandas
   * (hoy una estantería, mañana otra) y confirmar cada vez. Para terminar sin
   * contar todo está `cerrar`. Lo que no se contó no se toca.
   */
  async confirmar(tomaId: string, usuarioId: string | null): Promise<ResultadoConfirmacion> {
    const toma = await this.traer(tomaId);
    validarQueEstaAbierta(toma, 'confirmar');
    const renglones = await this.repo.renglones(tomaId);
    if (!renglones.some((r) => r.contado !== null && r.resultado !== 'AJUSTADO')) {
      throw new ErrorDatosInvalidos('Todavía no se contó nada para confirmar.');
    }

    let ajustados = 0;
    let sinDiferencia = 0;
    let recontar = 0;
    const errores: ResultadoConfirmacion['errores'] = [];

    for (const r of renglones) {
      const seMovio =
        r.contadoEn !== null && (await this.repo.seMovioDespues(r.materialId, r.contadoEn));
      const decision = decidir(r, r.stockActual, seMovio);

      if (decision.tipo === 'AJUSTAR') {
        try {
          const movimiento = await this.movimientos.crear(
            {
              materialId: r.materialId,
              tipo: 'AJUSTE',
              motivo: 'AJUSTE',
              cantidad: decision.cantidad,
              notas:
                `Toma de inventario ${toma.numero}: se contaron ${numero(decision.cantidad)} ` +
                `${r.unidad}, figuraban ${numero(r.stockActual)}.`,
            },
            usuarioId ?? undefined,
          );
          await this.repo.actualizarRenglon(r.id, {
            resultado: 'AJUSTADO',
            movimientoId: movimiento.id,
          });
          ajustados += 1;
        } catch (error) {
          // Un material que salió de circulación no frena los demás: se avisa
          // y queda pendiente, con la toma abierta.
          if (!(error instanceof ErrorDominio)) throw error;
          errores.push({ materialNombre: r.materialNombre, motivo: error.message });
        }
      } else if (decision.tipo === 'SIN_DIFERENCIA') {
        await this.repo.actualizarRenglon(r.id, { resultado: 'SIN_DIFERENCIA' });
        sinDiferencia += 1;
      } else if (decision.tipo === 'RECONTAR') {
        await this.repo.actualizarRenglon(r.id, { resultado: 'RECONTAR' });
        recontar += 1;
      }
    }

    const faltaContar = renglones.some((r) => r.contado === null);
    const quedaAlgo = recontar > 0 || errores.length > 0 || faltaContar;
    if (!quedaAlgo) {
      await this.repo.actualizar(tomaId, {
        estado: 'CERRADA',
        cerradaEn: this.reloj.ahora(),
        cerradaPorId: usuarioId,
      });
    }
    return { ...(await this.detalle(tomaId)), ajustados, sinDiferencia, recontar, errores };
  }

  /** Da por terminada la toma; lo que no se contó queda como estaba. */
  async cerrar(tomaId: string, usuarioId: string | null): Promise<TomaConRelaciones> {
    const toma = await this.traer(tomaId);
    validarCierre(toma, await this.repo.renglones(tomaId));
    return this.repo.actualizar(tomaId, {
      estado: 'CERRADA',
      cerradaEn: this.reloj.ahora(),
      cerradaPorId: usuarioId,
    });
  }

  async anular(tomaId: string, motivo: string): Promise<TomaConRelaciones> {
    const toma = await this.traer(tomaId);
    const renglones = await this.repo.renglones(tomaId);
    const texto = validarAnulable(toma, renglones, motivo);
    return this.repo.actualizar(tomaId, {
      estado: 'ANULADA',
      motivoAnulacion: texto,
      cerradaEn: this.reloj.ahora(),
    });
  }
}
