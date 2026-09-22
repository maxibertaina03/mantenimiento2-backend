import { DatosNuevaOrdenTrabajo } from '../dominio/orden-trabajo';
import { OrdenTrabajoConRelaciones } from '../puertos/repositorio-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from './gestionar-ordenes-trabajo';
import { DatosMaterialUsado, UsarMateriales } from './usar-materiales';

export interface DatosTrabajoHecho extends DatosNuevaOrdenTrabajo {
  /** Lo que se usó. Sale del pañol igual que en una orden abierta. */
  materiales?: DatosMaterialUsado[];
}

/**
 * Registrar de una un trabajo que ya se hizo, con lo que se usó.
 *
 * Es el camino desde la ficha de una máquina: alguien arregló algo, gastó dos
 * retenes y quiere dejarlo anotado. Obligarlo a abrir la orden, cargar los
 * materiales y después cerrarla serían tres pasos para un hecho consumado, y
 * eso termina en que no se anota.
 *
 * Por dentro son esos tres pasos igual, porque las reglas no se saltean: los
 * materiales solo entran en una orden abierta, y cerrarla exige contar qué se
 * hizo. Lo que cambia es que los da el sistema y no la persona.
 */
export class RegistrarTrabajoHecho {
  constructor(
    private readonly gestionar: GestionarOrdenesTrabajo,
    private readonly materiales: UsarMateriales,
  ) {}

  async ejecutar(
    datos: DatosTrabajoHecho,
    usuarioId: string | null,
  ): Promise<OrdenTrabajoConRelaciones> {
    const { materiales = [], resolucion, ...resto } = datos;

    // Sin materiales, el dominio la crea cerrada de una: un paso, una escritura.
    if (materiales.length === 0) {
      return this.gestionar.crear({ ...resto, resolucion });
    }

    // Con materiales hay que pasar por abierta, porque una orden cerrada no
    // acepta que le carguen nada, y esa regla existe para que el costo de un
    // trabajo terminado sea firme.
    const orden = await this.gestionar.crear(resto);

    for (const material of materiales) {
      // Si uno falla —no alcanza el stock— la orden queda ABIERTA con lo que
      // alcanzó a cargarse, y el error sube. Es a propósito: una orden abierta
      // que se puede corregir es mejor que perder lo que ya se registró.
      await this.materiales.agregar(orden.id, material, usuarioId);
    }

    if (!resolucion) return this.gestionar.editar(orden.id, {}, usuarioId);
    return this.gestionar.cerrar(orden.id, resolucion, usuarioId);
  }
}
