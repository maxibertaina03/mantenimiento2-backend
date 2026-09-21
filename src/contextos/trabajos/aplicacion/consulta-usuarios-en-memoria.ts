import { ConsultaUsuarios, UsuarioAsignable } from '../puertos/consulta-usuarios';

/** El padrón de los tests: quiénes existen y quiénes pueden trabajar. */
export class ConsultaUsuariosEnMemoria implements ConsultaUsuarios {
  constructor(private readonly usuarios: UsuarioAsignable[] = []) {}

  async buscarPorId(id: string): Promise<UsuarioAsignable | null> {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }

  async listarAsignables(): Promise<UsuarioAsignable[]> {
    return this.usuarios.filter((u) => u.puedeTrabajar);
  }
}
