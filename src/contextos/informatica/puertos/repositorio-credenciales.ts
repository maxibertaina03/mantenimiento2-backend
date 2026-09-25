import { CambiosCredencial, Credencial, TipoCredencial } from '../dominio/credencial';

/**
 * La credencial con los nombres ya resueltos, lista para la pantalla.
 *
 * **Nunca incluye el secreto, ni cifrado.** Si lo incluyera, el secreto
 * viajaría por toda la aplicación en cada listado y bastaría un `console.log`
 * de una fila para dejarlo escrito en los registros del servidor. Se pide
 * aparte, con `buscarSecreto`, y solo cuando hace falta.
 */
export interface CredencialConRelaciones extends Credencial {
  equipoItCodigo: string | null;
  equipoItNombre: string | null;
  /** Cuántas veces se rotó y cuántas se miró, para la ficha. */
  vecesRotada: number;
  vecesVista: number;
}

/** Lo que se guarda de la contraseña: el valor cifrado y su huella. */
export interface SecretoGuardado {
  secretoCifrado: string;
  huella: string;
}

export interface FiltroCredenciales {
  buscar?: string;
  tipo?: TipoCredencial;
  equipoItId?: string;
  /** Por defecto solo las activas. */
  incluirInactivas?: boolean;
  /** Solo las que hay que cambiar pronto o ya vencieron. */
  soloPorVencer?: boolean;
}

/** Una rotación, sin la contraseña vieja: solo el hecho de que se rotó. */
export interface RotacionRegistrada {
  id: string;
  rotadaEn: Date;
  motivo: string | null;
  rotadaPorNombre: string | null;
}

export interface VistaRegistrada {
  id: string;
  vistaEn: Date;
  usuarioNombre: string | null;
}

/** Todo lo que cambia al rotar, junto: o entra completo o no entra. */
export interface DatosRotacion {
  id: string;
  secretoCifrado: string;
  huella: string;
  /** La huella de la que se va, que es lo único que queda de ella. */
  huellaAnterior: string;
  rotadaEn: Date;
  proximaRotacion: Date | null;
  rotadaPorId: string | null;
  motivo: string | null;
}

export interface RepositorioCredenciales {
  listar(
    filtro: FiltroCredenciales,
    skip: number,
    take: number,
    hoy: Date,
  ): Promise<CredencialConRelaciones[]>;
  contar(filtro: FiltroCredenciales, hoy: Date): Promise<number>;

  buscarPorId(id: string): Promise<CredencialConRelaciones | null>;

  /** Solo los nombres, para ver si el que se quiere usar está libre. */
  listarNombres(): Promise<{ id: string; nombre: string }[]>;

  /** El secreto guardado. Se pide aparte justamente para que no viaje de más. */
  buscarSecreto(id: string): Promise<SecretoGuardado | null>;

  /** Las huellas de todas las contraseñas que esta credencial ya usó. */
  huellasUsadas(id: string): Promise<string[]>;

  crear(
    credencial: Omit<Credencial, 'id' | 'creadoEn'> & SecretoGuardado,
  ): Promise<CredencialConRelaciones>;

  actualizar(id: string, cambios: CambiosCredencial): Promise<CredencialConRelaciones>;

  /** Guarda la contraseña nueva y anota la rotación, en una sola transacción. */
  rotar(datos: DatosRotacion): Promise<CredencialConRelaciones>;

  /** Deja constancia de que alguien miró la contraseña. */
  registrarVista(credencialId: string, usuarioId: string): Promise<{ vistaEn: Date }>;

  historial(id: string): Promise<{ rotaciones: RotacionRegistrada[]; vistas: VistaRegistrada[] }>;

  eliminar(id: string): Promise<void>;
}

export const REPOSITORIO_CREDENCIALES = Symbol('RepositorioCredenciales');
