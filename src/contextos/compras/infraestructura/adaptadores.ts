import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorreoService, explicarErrorSmtp } from '../../../common/correo/correo.service';
import { ProveedoresService } from '../../../modules/proveedores/proveedores.service';
import { MaterialesService, MovimientosStockService } from '../../panol';
import { Casillas, Correo, CorreoSaliente } from '../puertos/envio';
import { ConsultaProveedores, PanolParaCompras } from '../puertos/otros-contextos';

/**
 * Los adaptadores de compras hacia afuera.
 *
 * Cada uno es una capa finita sobre un service que ya existía. Hablan con el
 * pañol y con proveedores por su puerta pública, no por su base: las reglas
 * siguen siendo de ellos.
 */

/** Proveedores es un catálogo: se le pregunta si existe. */
export class ProveedoresDelCatalogo implements ConsultaProveedores {
  constructor(private readonly proveedores: ProveedoresService) {}

  async existe(proveedorId: string): Promise<boolean> {
    try {
      await this.proveedores.obtener(proveedorId);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) return false;
      throw error;
    }
  }
}

/**
 * El pañol, visto desde compras.
 *
 * Sus rechazos viajan tal cual: "el material está desactivado" o "la fecha es
 * anterior al último ajuste" son palabras del pañol, y así las tiene que leer
 * quien carga la orden.
 */
export class PanolPorSusServicios implements PanolParaCompras {
  constructor(
    private readonly materiales: MaterialesService,
    private readonly movimientos: MovimientosStockService,
  ) {}

  async verificarEnUso(materialId: string): Promise<void> {
    await this.materiales.obtenerEnUso(materialId);
  }

  verificarFechaContraAjustes(
    materialId: string,
    fecha: Date,
    nombreDelMaterial?: string,
  ): Promise<void> {
    return this.movimientos.verificarFechaContraAjustes(materialId, fecha, { nombreDelMaterial });
  }
}

/** La casilla de la empresa. */
export class CorreoDelSistema implements Correo {
  constructor(private readonly correo: CorreoService) {}

  estaConfigurado(): boolean {
    return this.correo.estaConfigurado();
  }

  enviar(correo: CorreoSaliente): Promise<void> {
    return this.correo.enviar(correo);
  }

  explicarError(error: unknown): string {
    return explicarErrorSmtp(error);
  }
}

/**
 * Los datos de administración, desde la configuración del servidor.
 *
 * Sin valor por defecto escrito en el código: si lo hubiera, borrar la
 * variable en el panel no apagaría nada y los correos seguirían saliendo a
 * una casilla que ya nadie quiso.
 */
export class CasillasDeLaConfiguracion implements Casillas {
  constructor(private readonly config: ConfigService) {}

  mailAdministracion(): string | null {
    return this.config.get<string>('MAIL_ADMINISTRACION')?.trim() || null;
  }

  whatsappAdministracion(): string | null {
    return this.config.get<string>('WHATSAPP_ADMINISTRACION') ?? null;
  }
}
