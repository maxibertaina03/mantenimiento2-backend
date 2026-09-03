/** Lo que el aviso necesita para salir, sin que el caso de uso sepa de SMTP. */
export interface EnviadorDeAvisos {
  estaConfigurado(): boolean;
  enviar(destinatarios: string[], asunto: string, cuerpo: string): Promise<void>;
}

export const ENVIADOR_AVISOS = Symbol('EnviadorDeAvisos');
