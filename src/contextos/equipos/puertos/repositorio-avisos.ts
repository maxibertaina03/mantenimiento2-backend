export interface AvisoEnviado {
  planId: string;
  fechaService: Date;
  enviadoEn: Date;
  destinatarios: string;
}

/**
 * Registro de qué se avisó y cuándo.
 *
 * Es lo que hace idempotente al envío. Sin esto, si el disparador falla un día
 * y corre dos veces al siguiente, llegan dos correos iguales; y peor, un
 * service vencido que nadie atiende generaría un aviso todos los días hasta que
 * alguien lo silencie con una regla de bandeja.
 */
export interface RepositorioAvisos {
  /**
   * De los pares (plan, fecha) que se le pasan, cuáles ya se avisaron.
   *
   * En una consulta y no una por plan: el disparador corre todos los días y no
   * hay razón para gastar veinte viajes a la base en algo que se resuelve con
   * uno.
   */
  yaAvisados(claves: { planId: string; fechaService: Date }[]): Promise<Set<string>>;
  registrar(avisos: AvisoEnviado[]): Promise<void>;
}

export const REPOSITORIO_AVISOS = Symbol('RepositorioAvisos');

/** La clave que identifica un aviso. Se arma igual acá y en el repositorio. */
export function claveAviso(planId: string, fechaService: Date): string {
  return `${planId}|${fechaService.toISOString().slice(0, 10)}`;
}
