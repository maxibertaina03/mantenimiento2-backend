/**
 * Lo que compras necesita de los demás: si existe el proveedor, y qué opina el
 * pañol de lo que se va a comprar y recibir.
 *
 * Proveedores sigue siendo un módulo aparte: es un catálogo. El pañol es otro
 * contexto, con sus propias reglas: compras le pregunta, no decide por él. Si
 * el pañol rechaza —un material desactivado, una fecha por detrás de un
 * ajuste— el rechazo es suyo y llega tal cual, con sus palabras.
 */

export interface ConsultaProveedores {
  existe(proveedorId: string): Promise<boolean>;
}

export interface PanolParaCompras {
  /** Lanza si el material no existe o está desactivado. */
  verificarEnUso(materialId: string): Promise<void>;
  /** Lanza si la fecha cae por detrás del último ajuste del material. */
  verificarFechaContraAjustes(
    materialId: string,
    fecha: Date,
    nombreDelMaterial?: string,
  ): Promise<void>;
}
