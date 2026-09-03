import { DestinatariosAvisos } from '../puertos/destinatarios-avisos';

export class DestinatariosEnMemoria implements DestinatariosAvisos {
  constructor(private readonly direcciones: string[]) {}

  async obtener(): Promise<string[]> {
    return this.direcciones;
  }
}
