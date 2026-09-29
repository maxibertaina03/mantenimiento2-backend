import { Decimal, aDecimal, aNumero } from '../../../common/dominio/decimal';
import { ErrorNoEncontrado } from '../dominio/errores';
import { validarAdmiteMovimientos } from '../dominio/material';
import {
  MotivoMovimiento,
  QuienEdita,
  TipoMovimiento,
  calcularNuevoStock,
  validarCantidad,
  validarQuePuedeEditar,
  validarStockRecalculado,
  validarTipoYMotivo,
} from '../dominio/movimiento';
import { verificarNoQuedaDetrasDeUnAjuste } from '../dominio/regla-fecha-ajuste';
import { Reloj, relojDelSistema } from '../puertos/reloj';
import {
  EdicionConUsuario,
  FiltroMovimientos,
  MovimientoConRelaciones,
  RepositorioMovimientos,
} from '../puertos/repositorio-movimientos';

/** Lo que se pide al registrar un movimiento. */
export interface DatosAltaMovimiento {
  materialId: string;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number | string | Decimal;
  fecha?: Date;
  proveedorId?: string;
  usuarioId?: string;
  referenciaTrabajo?: string;
  notas?: string;
}

/** Lo que se puede corregir de un movimiento. `undefined` es "queda como estaba". */
export interface DatosEdicionMovimiento {
  tipo?: TipoMovimiento;
  motivo?: MotivoMovimiento;
  cantidad?: number;
  fecha?: Date;
  proveedorId?: string | null;
  referenciaTrabajo?: string | null;
  notas?: string | null;
  motivoEdicion: string;
}

/**
 * Los movimientos del pañol: lo único que mueve el stock.
 *
 * Las reglas son del dominio. La transacción y el lock de la fila del material
 * son del repositorio: este caso de uso le pasa la regla y el repositorio la
 * aplica con el stock ya bloqueado, así dos salidas simultáneas no se pisan.
 */
export class RegistrarMovimientos {
  constructor(
    private readonly repo: RepositorioMovimientos,
    private readonly reloj: Reloj = relojDelSistema,
  ) {}

  /**
   * Comprueba que la fecha no caiga por detras del ultimo ajuste del material.
   *
   * Es publico porque la recepcion de una orden de compra genera movimientos de
   * ENTRADA por su cuenta, con la fecha de recepcion que carga el usuario: es la
   * misma puerta al mismo problema, y la regla tiene que valer en las dos.
   */
  async verificarFechaContraAjustes(
    materialId: string,
    fecha: Date,
    opciones: { excluirMovimientoId?: string; nombreDelMaterial?: string } = {},
  ): Promise<void> {
    const ultimoAjuste = await this.repo.fechaDelUltimoAjuste(
      materialId,
      opciones.excluirMovimientoId,
    );
    verificarNoQuedaDetrasDeUnAjuste(fecha, ultimoAjuste, opciones.nombreDelMaterial);
  }

  async crear(
    datos: DatosAltaMovimiento,
    usuarioIdActual?: string,
  ): Promise<MovimientoConRelaciones> {
    const cantidad = aDecimal(datos.cantidad);

    validarCantidad(datos.tipo, cantidad);
    validarTipoYMotivo(datos.tipo, datos.motivo);

    const material = await this.repo.datosDelMaterial(datos.materialId);
    if (!material) {
      throw new ErrorNoEncontrado(`No existe el material con id ${datos.materialId}`);
    }
    // Editar un movimiento viejo de un material jubilado sigue permitido: eso
    // es corregir historia. Lo que no se puede es seguir cargando movimientos
    // nuevos, que es justamente de lo que se lo saco.
    validarAdmiteMovimientos(material);

    // Vale tambien para un AJUSTE nuevo: retrofechado por detras de otro ajuste
    // arrastra el mismo desacuerdo entre el stock guardado y el recalculo.
    const fechaDelMovimiento = datos.fecha ?? this.reloj.ahora();
    await this.verificarFechaContraAjustes(datos.materialId, fechaDelMovimiento, {
      nombreDelMaterial: material.nombre,
    });

    return this.repo.crearConActualizacionDeStock(
      {
        materialId: datos.materialId,
        tipo: datos.tipo,
        motivo: datos.motivo,
        cantidad,
        // Sin fecha la pone la base: es la hora en que se guardó.
        fecha: datos.fecha ? fechaDelMovimiento : undefined,
        proveedorId: datos.proveedorId,
        usuarioId: usuarioIdActual ?? datos.usuarioId,
        referenciaTrabajo: datos.referenciaTrabajo,
        notas: datos.notas,
      },
      (stockActual) => calcularNuevoStock(datos.tipo, stockActual, cantidad),
    );
  }

  async listar(
    filtro: FiltroMovimientos,
    skip: number,
    limite: number,
  ): Promise<{ items: MovimientoConRelaciones[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, skip, limite),
      this.repo.contar(filtro),
    ]);
    return { items, total };
  }

  async obtener(id: string): Promise<MovimientoConRelaciones> {
    const movimiento = await this.repo.buscarPorId(id);
    if (!movimiento) throw new ErrorNoEncontrado(`No existe el movimiento con id ${id}`);
    return movimiento;
  }

  /**
   * Edita un movimiento (corrección). Solo lo puede hacer quien lo creó o un ADMIN.
   * Exige un motivo de edición, recalcula el stock del material y deja auditoría.
   */
  async editar(
    id: string,
    datos: DatosEdicionMovimiento,
    quien?: QuienEdita,
  ): Promise<MovimientoConRelaciones> {
    const actual = await this.obtener(id);

    validarQuePuedeEditar(actual.usuarioId, quien);

    // Valores nuevos = lo enviado sobre lo actual.
    const tipo = datos.tipo ?? actual.tipo;
    const motivo = datos.motivo ?? actual.motivo;
    const cantidad = aDecimal(datos.cantidad ?? actual.cantidad);
    const fecha = datos.fecha ?? actual.fecha;
    const proveedorId = datos.proveedorId !== undefined ? datos.proveedorId : actual.proveedorId;
    const referenciaTrabajo =
      datos.referenciaTrabajo !== undefined ? datos.referenciaTrabajo : actual.referenciaTrabajo;
    const notas = datos.notas !== undefined ? datos.notas : actual.notas;

    // Validaciones de negocio (mismas reglas que al crear).
    validarCantidad(tipo, cantidad);
    validarTipoYMotivo(tipo, motivo);

    // El movimiento no se compara contra si mismo: si no, ninguna edicion de un
    // ajuste seria posible. Una edicion que lo retrofechara por detras de OTRO
    // ajuste movería el stock sola, que es justo la sorpresa que se evita.
    await this.verificarFechaContraAjustes(actual.materialId, fecha, {
      excluirMovimientoId: id,
    });

    // Snapshot antes/después (valores serializables para la auditoría).
    const antes = {
      tipo: actual.tipo,
      motivo: actual.motivo,
      cantidad: aNumero(actual.cantidad),
      fecha: actual.fecha.toISOString(),
      proveedorId: actual.proveedorId,
      referenciaTrabajo: actual.referenciaTrabajo,
      notas: actual.notas,
    };
    const despues = {
      tipo,
      motivo,
      cantidad: aNumero(cantidad),
      fecha: fecha.toISOString(),
      proveedorId,
      referenciaTrabajo,
      notas,
    };

    return this.repo.editarConAuditoria({
      id,
      materialId: actual.materialId,
      datos: { tipo, motivo, cantidad, fecha, proveedorId, referenciaTrabajo, notas },
      edicion: {
        usuarioId: quien?.id ?? null,
        motivo: datos.motivoEdicion,
        cambios: { antes, despues },
      },
      // Si falla, la transacción se revierte entera: ni la edición ni la
      // auditoría quedan guardadas.
      validarStock: validarStockRecalculado,
    });
  }

  async listarEdiciones(id: string): Promise<EdicionConUsuario[]> {
    await this.obtener(id); // valida que el movimiento exista
    return this.repo.listarEdiciones(id);
  }
}
