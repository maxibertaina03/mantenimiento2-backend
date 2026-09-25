import {
  CambiosCredencial,
  DatosNuevaCredencial,
  aplicarCambios,
  crearCredencial,
  validarNombreLibre,
  validarQuePuedeVerla,
  validarSecretoNuevo,
} from '../dominio/credencial';
import { ErrorNoEncontrado } from '../dominio/errores';
import { calcularProximaRotacion } from '../dominio/rotacion';
import { Cofre } from '../puertos/cofre';
import { ConsultaEquiposIt } from '../puertos/consulta-equipos-it';
import { Reloj } from '../puertos/reloj';
import {
  CredencialConRelaciones,
  FiltroCredenciales,
  RepositorioCredenciales,
} from '../puertos/repositorio-credenciales';

/** Lo que devuelve revelar: la contraseña en claro y cuándo se la miró. */
export interface SecretoRevelado {
  id: string;
  nombre: string;
  usuario: string | null;
  secreto: string;
  vistaEn: Date;
}

/**
 * Guardar, cambiar y mirar credenciales.
 *
 * Las decisiones las toma el dominio; este caso de uso le acerca lo que
 * necesita saber —los nombres que ya existen, si la contraseña nueva ya se
 * usó— y guarda lo que el dominio devuelve. No conoce Nest, ni Prisma, ni HTTP.
 */
export class GestionarCredenciales {
  constructor(
    private readonly repo: RepositorioCredenciales,
    private readonly cofre: Cofre,
    private readonly equipos: ConsultaEquiposIt,
    private readonly reloj: Reloj,
  ) {}

  private async traer(id: string): Promise<CredencialConRelaciones> {
    const cred = await this.repo.buscarPorId(id);
    if (!cred) throw new ErrorNoEncontrado(`No existe la credencial con id ${id}`);
    return cred;
  }

  /** Que el equipo exista antes de atarle la credencial. */
  private async validarEquipo(equipoItId: string | null | undefined): Promise<void> {
    if (!equipoItId) return;
    if (!(await this.equipos.existe(equipoItId))) {
      throw new ErrorNoEncontrado(`No existe el equipo de informática con id ${equipoItId}`);
    }
  }

  async listar(
    filtro: FiltroCredenciales,
    pagina: number,
    limite: number,
  ): Promise<{ datos: CredencialConRelaciones[]; total: number; pagina: number; limite: number }> {
    const hoy = this.reloj.ahora();
    const [datos, total] = await Promise.all([
      this.repo.listar(filtro, (pagina - 1) * limite, limite, hoy),
      this.repo.contar(filtro, hoy),
    ]);
    return { datos, total, pagina, limite };
  }

  obtener(id: string): Promise<CredencialConRelaciones> {
    return this.traer(id);
  }

  async crear(datos: DatosNuevaCredencial): Promise<CredencialConRelaciones> {
    await this.validarEquipo(datos.equipoItId);
    validarNombreLibre(datos.nombre, await this.repo.listarNombres());

    const credencial = crearCredencial(datos, this.reloj.ahora());

    // El cifrado pasa acá y no en el dominio: el dominio decide qué es válido,
    // no cómo se guarda.
    return this.repo.crear({
      ...credencial,
      secretoCifrado: this.cofre.cifrar(datos.secreto),
      huella: this.cofre.huella(datos.secreto),
    });
  }

  async actualizar(id: string, cambios: CambiosCredencial): Promise<CredencialConRelaciones> {
    await this.traer(id);
    await this.validarEquipo(cambios.equipoItId);

    if (cambios.nombre !== undefined) {
      validarNombreLibre(cambios.nombre, await this.repo.listarNombres(), id);
    }

    return this.repo.actualizar(id, aplicarCambios(cambios));
  }

  /**
   * Cambia la contraseña.
   *
   * Rechaza una que ya se haya usado en esta credencial. La comparación la
   * hace el cofre —es él quien sabe de huellas— y la regla la pone el dominio.
   */
  async rotar(
    id: string,
    secreto: string,
    motivo: string | null,
    usuarioId: string | null,
  ): Promise<CredencialConRelaciones> {
    const actual = await this.traer(id);

    const guardado = await this.repo.buscarSecreto(id);
    if (!guardado) throw new ErrorNoEncontrado(`No existe la credencial con id ${id}`);

    const usadas = await this.repo.huellasUsadas(id);
    validarSecretoNuevo(usadas.some((h) => this.cofre.coincideConLaHuella(secreto, h)));

    const rotadaEn = this.reloj.ahora();
    return this.repo.rotar({
      id,
      secretoCifrado: this.cofre.cifrar(secreto),
      huella: this.cofre.huella(secreto),
      huellaAnterior: guardado.huella,
      rotadaEn,
      proximaRotacion: calcularProximaRotacion(rotadaEn, actual.rotarCadaDias),
      rotadaPorId: usuarioId,
      motivo: motivo?.trim() || null,
    });
  }

  /**
   * Devuelve la contraseña en claro y anota quién la pidió.
   *
   * El registro se escribe ANTES de devolver nada. Si se escribiera después y
   * algo fallara en el medio, el secreto ya habría salido y la anotación no
   * existiría, que es la única forma en que este registro serviría de poco.
   */
  async revelar(id: string, usuarioId: string | null): Promise<SecretoRevelado> {
    validarQuePuedeVerla(usuarioId);

    const cred = await this.traer(id);
    const guardado = await this.repo.buscarSecreto(id);
    if (!guardado) throw new ErrorNoEncontrado(`No existe la credencial con id ${id}`);

    const vista = await this.repo.registrarVista(id, usuarioId);

    return {
      id: cred.id,
      nombre: cred.nombre,
      usuario: cred.usuario,
      secreto: this.cofre.descifrar(guardado.secretoCifrado),
      vistaEn: vista.vistaEn,
    };
  }

  async historial(id: string) {
    await this.traer(id);
    return this.repo.historial(id);
  }

  async eliminar(id: string): Promise<void> {
    await this.traer(id);
    await this.repo.eliminar(id);
  }
}
