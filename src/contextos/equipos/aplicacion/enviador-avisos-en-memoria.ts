import { EnviadorDeAvisos } from '../puertos/enviador-avisos';

export interface CorreoCapturado {
  destinatarios: string[];
  asunto: string;
  cuerpo: string;
}

/** Guarda los correos en vez de mandarlos, para poder mirarlos en las pruebas. */
export class EnviadorAvisosEnMemoria implements EnviadorDeAvisos {
  readonly enviados: CorreoCapturado[] = [];

  constructor(
    private readonly configurado = true,
    /** Para probar qué pasa cuando el envío falla de verdad. */
    private readonly falla = false,
  ) {}

  estaConfigurado(): boolean {
    return this.configurado;
  }

  async enviar(destinatarios: string[], asunto: string, cuerpo: string): Promise<void> {
    if (this.falla) throw new Error('Brevo respondió 500');
    this.enviados.push({ destinatarios, asunto, cuerpo });
  }
}
