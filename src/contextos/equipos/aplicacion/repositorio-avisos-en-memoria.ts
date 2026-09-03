import { AvisoEnviado, RepositorioAvisos, claveAviso } from '../puertos/repositorio-avisos';

/** Registro de avisos en memoria, para probar sin base de datos. */
export class RepositorioAvisosEnMemoria implements RepositorioAvisos {
  private readonly registrados = new Map<string, AvisoEnviado>();

  async yaAvisados(claves: { planId: string; fechaService: Date }[]): Promise<Set<string>> {
    const encontradas = new Set<string>();
    for (const c of claves) {
      const clave = claveAviso(c.planId, c.fechaService);
      if (this.registrados.has(clave)) encontradas.add(clave);
    }
    return encontradas;
  }

  async registrar(avisos: AvisoEnviado[]): Promise<void> {
    for (const a of avisos) {
      // Igual que el índice único de la base: el mismo par no se guarda dos veces.
      this.registrados.set(claveAviso(a.planId, a.fechaService), a);
    }
  }

  todos(): AvisoEnviado[] {
    return [...this.registrados.values()];
  }
}
