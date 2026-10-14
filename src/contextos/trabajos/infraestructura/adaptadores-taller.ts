import { Injectable, NotFoundException } from '@nestjs/common';
import { CorreoService, explicarErrorSmtp } from '../../../common/correo/correo.service';
import { ProveedoresService } from '../../../modules/proveedores/proveedores.service';
import { EstadoPorTaller } from '../../equipos';
import {
  ContactoDelTaller,
  ContactosDeTalleres,
  CorreoAlTaller,
  CorreoTrabajos,
} from '../puertos/envio';
import { EquiposEnTaller } from '../puertos/equipos-en-taller';

/**
 * Los adaptadores de lo que hace falta para mandar un equipo afuera.
 *
 * Capas finitas sobre lo que ya existía: el estado de la máquina lo decide
 * equipos, el contacto es del catálogo de proveedores y la casilla es la de
 * la empresa.
 */

@Injectable()
export class EquiposEnTallerPorEstado implements EquiposEnTaller {
  constructor(private readonly estado: EstadoPorTaller) {}

  salioAlTaller(equipoId: string): Promise<void> {
    return this.estado.salio(equipoId);
  }

  volvioDelTaller(equipoId: string): Promise<void> {
    return this.estado.volvio(equipoId);
  }
}

@Injectable()
export class CorreoDeTrabajos implements CorreoTrabajos {
  constructor(private readonly correo: CorreoService) {}

  estaConfigurado(): boolean {
    return this.correo.estaConfigurado();
  }

  enviar(correo: CorreoAlTaller): Promise<void> {
    return this.correo.enviar(correo);
  }

  explicarError(error: unknown): string {
    return explicarErrorSmtp(error);
  }
}

@Injectable()
export class ContactosPorProveedores implements ContactosDeTalleres {
  constructor(private readonly proveedores: ProveedoresService) {}

  async contacto(proveedorId: string): Promise<ContactoDelTaller | null> {
    try {
      const p = await this.proveedores.obtener(proveedorId);
      return { nombre: p.nombre, email: p.email, telefono: p.telefono };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
