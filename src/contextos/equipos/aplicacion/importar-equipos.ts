import { Equipo, crearEquipo, normalizarTexto } from '../dominio/equipo';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';
import { RepositorioUbicaciones } from '../puertos/repositorio-ubicaciones';

/** Una fila confirmada por quien importa, ya revisada en la pantalla. */
export interface EquipoAImportar {
  nombre: string;
  ubicacion: string;
  descripcion?: string | null;
}

export interface ResultadoImportacion {
  creados: number;
  yaExistian: number;
  ubicacionesCreadas: string[];
  /** Los que no se pudieron crear, con el motivo. Uno malo no frena el resto. */
  fallidos: { nombre: string; motivo: string }[];
}

/**
 * Carga masiva de equipos desde la carpeta de fotos.
 *
 * **Trabaja en lotes, y eso no es una optimización prematura.** La primera
 * versión hacía dos consultas por fila: con las 341 filas reales fueron 682
 * viajes a la base, que está en otro continente, y el proceso se cayó a los 129
 * equipos. Ahora son unas veinte consultas en total: se resuelven las
 * ubicaciones, se traen de una vez los equipos que ya existen en ellas, y se
 * crean los que faltan en tandas.
 *
 * Es **idempotente**: un equipo que ya existe con el mismo nombre en la misma
 * ubicación no se duplica. Eso es lo que permitió que la caída de aquella vez
 * no dejara nada roto — se vuelve a correr y sigue donde estaba.
 */
export class ImportarEquipos {
  /** Cuántos equipos se insertan por tanda. */
  private static readonly TAMANO_TANDA = 100;

  constructor(
    private readonly equipos: RepositorioEquipos,
    private readonly ubicaciones: RepositorioUbicaciones,
  ) {}

  /** Identidad de un equipo importado: su nombre dentro de su ubicación. */
  private clave(nombre: string, ubicacionId: string): string {
    return `${ubicacionId}|${nombre.trim().toLowerCase()}`;
  }

  async ejecutar(filas: EquipoAImportar[]): Promise<ResultadoImportacion> {
    const resultado: ResultadoImportacion = {
      creados: 0,
      yaExistian: 0,
      ubicacionesCreadas: [],
      fallidos: [],
    };
    if (filas.length === 0) return resultado;

    // ── 1. Las ubicaciones, una consulta por sector distinto ──────────────
    const idsPorUbicacion = new Map<string, string>();
    for (const nombreUbicacion of new Set(filas.map((f) => f.ubicacion.trim()))) {
      const clave = nombreUbicacion.toLowerCase();
      if (idsPorUbicacion.has(clave)) continue;

      const existente = await this.ubicaciones.buscarPorNombre(nombreUbicacion);
      if (existente) {
        idsPorUbicacion.set(clave, existente.id);
      } else {
        const creada = await this.ubicaciones.crear(
          nombreUbicacion,
          (idsPorUbicacion.size + 1) * 10,
        );
        idsPorUbicacion.set(clave, creada.id);
        resultado.ubicacionesCreadas.push(creada.nombre);
      }
    }

    // ── 2. Lo que ya existe, en UNA consulta ──────────────────────────────
    const yaExisten = new Set(
      (await this.equipos.listarNombresPorUbicaciones([...idsPorUbicacion.values()])).map((e) =>
        this.clave(e.nombre, e.ubicacionId),
      ),
    );

    // ── 3. Qué hay que crear ──────────────────────────────────────────────
    const aCrear: Omit<Equipo, 'id'>[] = [];

    for (const fila of filas) {
      try {
        const ubicacionId = idsPorUbicacion.get(fila.ubicacion.trim().toLowerCase());
        if (ubicacionId === undefined) {
          throw new Error(`No se pudo resolver la ubicación "${fila.ubicacion}".`);
        }

        // El nombre se normaliza igual que en un alta manual: la importación no
        // es una puerta trasera que se saltea el dominio.
        const nombre = normalizarTexto(fila.nombre);
        const clave = this.clave(nombre ?? '', ubicacionId);

        // El Set se va llenando con lo que se va a crear, así dos filas
        // repetidas dentro del mismo archivo tampoco entran dos veces.
        if (nombre !== null && yaExisten.has(clave)) {
          resultado.yaExistian++;
          continue;
        }

        aCrear.push(
          crearEquipo({ nombre: fila.nombre, ubicacionId, descripcion: fila.descripcion }),
        );
        yaExisten.add(clave);
      } catch (error) {
        resultado.fallidos.push({
          nombre: fila.nombre,
          motivo: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ── 4. Crear en tandas ────────────────────────────────────────────────
    // Si una tanda falla, se reintenta fila por fila para no perder las 99 que
    // estaban bien por culpa de una.
    for (let i = 0; i < aCrear.length; i += ImportarEquipos.TAMANO_TANDA) {
      const tanda = aCrear.slice(i, i + ImportarEquipos.TAMANO_TANDA);
      try {
        resultado.creados += await this.equipos.crearVarios(tanda);
      } catch {
        for (const equipo of tanda) {
          try {
            await this.equipos.crear(equipo);
            resultado.creados++;
          } catch (error) {
            resultado.fallidos.push({
              nombre: equipo.nombre,
              motivo: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    return resultado;
  }
}
