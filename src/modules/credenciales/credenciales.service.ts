import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoCredencial, Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { buscarNombreRepetido, normalizarNombre } from '../../common/dominio/nombres';
import { CofreService } from './cofre.service';
import { CredencialesRepository } from './credenciales.repository';
import {
  ActualizarCredencialDto,
  CredencialRespuestaDto,
  CrearCredencialDto,
  HistorialCredencialDto,
  ListarCredencialesDto,
  RotarCredencialDto,
  SecretoReveladoDto,
} from './dto/credencial.dto';
import { DIAS_DE_AVISO, calcularProximaRotacion } from './rotacion';

/**
 * El baúl de credenciales.
 *
 * Tres reglas lo definen, y ninguna es opcional:
 *
 * 1. La contraseña se guarda cifrada con una clave que vive fuera de la base.
 * 2. La contraseña nunca sale en un listado. Verla es un pedido aparte, y ese
 *    pedido queda anotado con quién y cuándo.
 * 3. Una contraseña que ya se usó no se puede volver a usar. Del historial se
 *    guarda la huella, nunca el valor: si algo se filtrara alguna vez, se
 *    pierde la clave vigente y no todas las que se usaron.
 */
@Injectable()
export class CredencialesService {
  constructor(
    private readonly repo: CredencialesRepository,
    private readonly cofre: CofreService,
  ) {}

  /**
   * Comprueba que el equipo de IT exista antes de atarle la credencial.
   *
   * Sin esto, un id equivocado llega hasta Postgres y vuelve como una violación
   * de clave foránea: un 500 con un texto que no le dice nada a nadie. Acá se
   * convierte en un mensaje que se entiende.
   */
  private async equipoValido(equipoItId: string | null | undefined): Promise<string | null> {
    if (!equipoItId) return null;
    const existe = await this.repo.existeEquipoIt(equipoItId);
    if (!existe) {
      throw new NotFoundException(`No existe el equipo de informática con id ${equipoItId}`);
    }
    return equipoItId;
  }

  /** Se pasa como parámetro para poder probar "faltan tres días" sin esperar. */
  private ahora(): Date {
    return new Date();
  }

  /**
   * Dos credenciales con el mismo nombre son indistinguibles en la pantalla, y
   * en un baúl eso lleva a probar la contraseña equivocada en el lugar
   * equivocado.
   */
  private async verificarNombreLibre(nombre: string, exceptoId?: string): Promise<void> {
    const choque = buscarNombreRepetido(await this.repo.listarNombres(), nombre, exceptoId);
    if (choque) {
      throw new BadRequestException(
        `Ya hay una credencial llamada "${choque.nombre}". Usá esa, o ponele un nombre que las distinga.`,
      );
    }
  }

  async listar(query: ListarCredencialesDto): Promise<RespuestaPaginada<CredencialRespuestaDto>> {
    const hoy = this.ahora();
    const where: Prisma.CredencialWhereInput = {};

    if (query.mostrar !== 'todas') where.activo = true;
    if (query.tipo) where.tipo = query.tipo;
    if (query.equipoItId) where.equipoItId = query.equipoItId;

    if (query.buscar) {
      // `contains` y no comparación de identidad: acá se busca, no se decide si
      // dos nombres son el mismo. Ver `common/dominio/nombres`.
      where.OR = [
        { nombre: { contains: query.buscar, mode: 'insensitive' } },
        { usuario: { contains: query.buscar, mode: 'insensitive' } },
        { notas: { contains: query.buscar, mode: 'insensitive' } },
      ];
    }

    if (query.rotacion) {
      const enUnaSemana = new Date(hoy);
      enUnaSemana.setUTCDate(enUnaSemana.getUTCDate() + DIAS_DE_AVISO);

      if (query.rotacion === 'vencida') where.proximaRotacion = { lt: hoy };
      else if (query.rotacion === 'por-vencer')
        where.proximaRotacion = { gte: hoy, lte: enUnaSemana };
      // `pendiente` es la suma de las dos: lo que hay que atender ahora.
      else if (query.rotacion === 'pendiente') where.proximaRotacion = { lte: enUnaSemana };
    }

    const [filas, total] = await Promise.all([
      this.repo.buscarTodas(where, query.skip, query.limite),
      this.repo.contar(where),
    ]);

    return {
      datos: filas.map((f) => CredencialRespuestaDto.desde(f, hoy)),
      total,
      pagina: query.pagina,
      limite: query.limite,
    };
  }

  async obtener(id: string): Promise<CredencialRespuestaDto> {
    const fila = await this.repo.buscarPorId(id);
    if (!fila) throw new NotFoundException(`No existe la credencial con id ${id}`);
    return CredencialRespuestaDto.desde(fila, this.ahora());
  }

  async crear(dto: CrearCredencialDto): Promise<CredencialRespuestaDto> {
    const nombre = normalizarNombre(dto.nombre);
    await this.verificarNombreLibre(nombre);

    const rotadaEn = this.ahora();
    const fila = await this.repo.crear({
      nombre,
      tipo: dto.tipo ?? TipoCredencial.OTRO,
      usuario: dto.usuario?.trim() || null,
      secretoCifrado: this.cofre.cifrar(dto.secreto),
      huella: this.cofre.huella(dto.secreto),
      url: dto.url?.trim() || null,
      notas: dto.notas?.trim() || null,
      equipoItId: await this.equipoValido(dto.equipoItId),
      rotarCadaDias: dto.rotarCadaDias ?? null,
      rotadaEn,
      proximaRotacion: calcularProximaRotacion(rotadaEn, dto.rotarCadaDias),
    });
    return CredencialRespuestaDto.desde(fila, rotadaEn);
  }

  /**
   * Edita lo de alrededor: nombre, usuario, dónde se usa, cada cuánto rotar.
   *
   * La contraseña NO se cambia por acá. Cambiarla es rotar, y rotar deja
   * registro. Si se pudiera editar como un campo más, el historial diría que la
   * clave tiene dos años cuando en realidad se cambió ayer.
   */
  async actualizar(id: string, dto: ActualizarCredencialDto): Promise<CredencialRespuestaDto> {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new NotFoundException(`No existe la credencial con id ${id}`);

    const nombre = dto.nombre !== undefined ? normalizarNombre(dto.nombre) : undefined;
    if (nombre) await this.verificarNombreLibre(nombre, id);

    // Si cambia cada cuántos días, la próxima fecha se recalcula desde la
    // última rotación real, no desde hoy: pasar de 90 a 30 días tiene que poder
    // dejar una credencial vencida, que es justamente lo que se quiere saber.
    const rotarCadaDias = dto.rotarCadaDias !== undefined ? dto.rotarCadaDias : undefined;

    const fila = await this.repo.actualizar(id, {
      nombre,
      tipo: dto.tipo,
      usuario: dto.usuario !== undefined ? dto.usuario.trim() || null : undefined,
      url: dto.url !== undefined ? dto.url.trim() || null : undefined,
      notas: dto.notas !== undefined ? dto.notas.trim() || null : undefined,
      // `undefined` es "no lo toques"; `null` es "desatala". Los dos casos
      // tienen que poder expresarse, y son distintos.
      equipoItId:
        dto.equipoItId === undefined ? undefined : await this.equipoValido(dto.equipoItId),
      rotarCadaDias,
      activo: dto.activo,
      ...(rotarCadaDias !== undefined
        ? { proximaRotacion: calcularProximaRotacion(actual.rotadaEn, rotarCadaDias) }
        : {}),
    });
    return CredencialRespuestaDto.desde(fila, this.ahora());
  }

  /**
   * Cambia la contraseña.
   *
   * Rechaza una que ya se haya usado en esta credencial. No es una molestia
   * gratuita: rotar hacia una clave vieja deja el sistema diciendo que se rotó
   * cuando en la práctica no cambió nada.
   */
  async rotar(
    id: string,
    dto: RotarCredencialDto,
    quien?: Usuario,
  ): Promise<CredencialRespuestaDto> {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) throw new NotFoundException(`No existe la credencial con id ${id}`);

    const secreto = await this.repo.buscarSecreto(id);
    if (!secreto) throw new NotFoundException(`No existe la credencial con id ${id}`);

    const usadas = await this.repo.huellasUsadas(id);
    if (usadas.some((h) => this.cofre.coincideConLaHuella(dto.secreto, h))) {
      throw new BadRequestException(
        'Esa contraseña ya se usó en esta credencial. Poné una que no hayas usado antes: ' +
          'volver a una vieja deja el registro diciendo que rotaste cuando en realidad no cambió nada.',
      );
    }

    const rotadaEn = this.ahora();
    const fila = await this.repo.rotar({
      id,
      secretoCifrado: this.cofre.cifrar(dto.secreto),
      huella: this.cofre.huella(dto.secreto),
      huellaAnterior: secreto.huella,
      rotadaEn,
      proximaRotacion: calcularProximaRotacion(rotadaEn, actual.rotarCadaDias),
      rotadaPorId: quien?.id ?? null,
      motivo: dto.motivo?.trim() || null,
    });
    return CredencialRespuestaDto.desde(fila, rotadaEn);
  }

  /**
   * Devuelve la contraseña en claro y anota quién la pidió.
   *
   * El registro se escribe ANTES de devolver nada. Si se escribiera después y
   * algo fallara en el medio, el secreto ya habría salido y la anotación no
   * existiría, que es la única forma en que este registro serviría de poco.
   */
  async revelar(id: string, quien?: Usuario): Promise<SecretoReveladoDto> {
    if (!quien) {
      // La única protección real de este baúl, además del cifrado, es poder
      // decir después quién miró qué. Entregar la contraseña sin poder anotar
      // quién la pidió convierte el registro en una lista incompleta, que es
      // peor que no tener registro: da una seguridad que no existe.
      throw new ForbiddenException(
        'El baúl necesita saber quién está pidiendo la contraseña, y este servidor tiene la ' +
          'autenticación desactivada (AUTH_DISABLED). Entrá con tu usuario para poder verla.',
      );
    }

    const fila = await this.repo.buscarPorId(id);
    if (!fila) throw new NotFoundException(`No existe la credencial con id ${id}`);

    const guardado = await this.repo.buscarSecreto(id);
    if (!guardado) throw new NotFoundException(`No existe la credencial con id ${id}`);

    const vista = await this.repo.registrarVista(id, quien.id);

    return {
      id: fila.id,
      nombre: fila.nombre,
      usuario: fila.usuario,
      secreto: this.cofre.descifrar(guardado.secretoCifrado),
      vistaEn: vista.vistaEn,
    };
  }

  async historial(id: string): Promise<HistorialCredencialDto> {
    await this.obtener(id);
    const [rotaciones, vistas] = await this.repo.historial(id);

    return {
      rotaciones: rotaciones.map((r) => ({
        id: r.id,
        rotadaEn: r.rotadaEn,
        rotadaPor: r.rotadaPor?.nombre ?? null,
        motivo: r.motivo,
      })),
      vistas: vistas.map((v) => ({
        id: v.id,
        vistaEn: v.vistaEn,
        usuario: v.usuario.nombre,
      })),
    };
  }

  /**
   * Borra la credencial y todo su historial.
   *
   * Para "ya no la uso más" está desactivarla, que la saca de la vista pero
   * conserva el registro de quién vio qué. Borrar es para lo que se cargó por
   * error.
   */
  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    await this.repo.eliminar(id);
  }
}
