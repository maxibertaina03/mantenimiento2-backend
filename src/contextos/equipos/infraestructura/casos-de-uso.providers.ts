import { Provider } from '@nestjs/common';
import { ActualizarEquipo } from '../aplicacion/actualizar-equipo';
import { CambiarFotoEquipo } from '../aplicacion/cambiar-foto-equipo';
import { ConsultarEquipos } from '../aplicacion/consultar-equipos';
import { ConsultarHistorial } from '../aplicacion/consultar-historial';
import { CrearEquipo } from '../aplicacion/crear-equipo';
import { GestionarFotos } from '../aplicacion/gestionar-fotos';
import { GestionarManuales } from '../aplicacion/gestionar-manuales';
import { GestionarMontajes } from '../aplicacion/gestionar-montajes';
import { GestionarPlanes } from '../aplicacion/gestionar-planes';
import { GestionarRepuestos } from '../aplicacion/gestionar-repuestos';
import { ImportarEquipos } from '../aplicacion/importar-equipos';
import { ProcesarAvisos } from '../aplicacion/procesar-avisos';
import { RegistrarIntervencion } from '../aplicacion/registrar-intervencion';
import { ALMACEN_IMAGENES, AlmacenImagenes } from '../puertos/almacen-imagenes';
import { DESTINATARIOS_AVISOS, DestinatariosAvisos } from '../puertos/destinatarios-avisos';
import { ENVIADOR_AVISOS, EnviadorDeAvisos } from '../puertos/enviador-avisos';
import { REPOSITORIO_FOTOS, RepositorioFotos } from '../puertos/fotos';
import {
  ALMACEN_MANUALES,
  AlmacenManuales,
  REPOSITORIO_MANUALES,
  RepositorioManuales,
} from '../puertos/manuales';
import { REPOSITORIO_MONTAJES, RepositorioMontajes } from '../puertos/montajes';
import { RELOJ, Reloj } from '../puertos/reloj';
import { REPOSITORIO_AVISOS, RepositorioAvisos } from '../puertos/repositorio-avisos';
import { REPOSITORIO_EQUIPOS, RepositorioEquipos } from '../puertos/repositorio-equipos';
import {
  REPOSITORIO_INTERVENCIONES,
  RepositorioIntervenciones,
} from '../puertos/repositorio-intervenciones';
import { REPOSITORIO_PLANES, RepositorioPlanes } from '../puertos/repositorio-planes';
import {
  REPOSITORIO_UBICACIONES,
  RepositorioUbicaciones,
} from '../puertos/repositorio-ubicaciones';
import { REPOSITORIO_REPUESTOS, RepositorioRepuestos } from '../puertos/repuestos';

/**
 * Cómo se arma cada caso de uso de equipos: con qué puertos.
 *
 * Es el único lugar donde se hace. Los controladores reciben el caso de uso
 * ya armado y solo traducen HTTP; los casos de uso no saben de Nest. Cada
 * fábrica tiene los parámetros tipados a propósito: si un caso de uso cambia
 * el orden o el tipo de lo que recibe, el compilador lo marca acá.
 */
export const casosDeUsoEquipos: Provider[] = [
  {
    provide: CrearEquipo,
    useFactory: (equipos: RepositorioEquipos) => new CrearEquipo(equipos),
    inject: [REPOSITORIO_EQUIPOS],
  },
  {
    provide: ActualizarEquipo,
    // Con los montajes: dar de baja un equipo montado lo desmonta.
    useFactory: (equipos: RepositorioEquipos, montajes: RepositorioMontajes, reloj: Reloj) =>
      new ActualizarEquipo(equipos, montajes, reloj),
    inject: [REPOSITORIO_EQUIPOS, REPOSITORIO_MONTAJES, RELOJ],
  },
  {
    provide: ConsultarEquipos,
    useFactory: (equipos: RepositorioEquipos, reloj: Reloj) => new ConsultarEquipos(equipos, reloj),
    inject: [REPOSITORIO_EQUIPOS, RELOJ],
  },
  {
    provide: ImportarEquipos,
    useFactory: (equipos: RepositorioEquipos, ubicaciones: RepositorioUbicaciones) =>
      new ImportarEquipos(equipos, ubicaciones),
    inject: [REPOSITORIO_EQUIPOS, REPOSITORIO_UBICACIONES],
  },
  {
    provide: CambiarFotoEquipo,
    useFactory: (equipos: RepositorioEquipos, almacen: AlmacenImagenes) =>
      new CambiarFotoEquipo(equipos, almacen),
    inject: [REPOSITORIO_EQUIPOS, ALMACEN_IMAGENES],
  },
  // Se exporta: el contexto de trabajos le avisa que un service se hizo, sin
  // copiar la cuenta de cuándo toca el próximo.
  {
    provide: GestionarPlanes,
    useFactory: (planes: RepositorioPlanes, equipos: RepositorioEquipos, reloj: Reloj) =>
      new GestionarPlanes(planes, equipos, reloj),
    inject: [REPOSITORIO_PLANES, REPOSITORIO_EQUIPOS, RELOJ],
  },
  {
    provide: RegistrarIntervencion,
    useFactory: (
      intervenciones: RepositorioIntervenciones,
      equipos: RepositorioEquipos,
      reloj: Reloj,
      planes: GestionarPlanes,
    ) => new RegistrarIntervencion(intervenciones, equipos, reloj, planes),
    inject: [REPOSITORIO_INTERVENCIONES, REPOSITORIO_EQUIPOS, RELOJ, GestionarPlanes],
  },
  {
    provide: ConsultarHistorial,
    useFactory: (intervenciones: RepositorioIntervenciones, equipos: RepositorioEquipos) =>
      new ConsultarHistorial(intervenciones, equipos),
    inject: [REPOSITORIO_INTERVENCIONES, REPOSITORIO_EQUIPOS],
  },
  {
    provide: ProcesarAvisos,
    useFactory: (
      planes: RepositorioPlanes,
      avisos: RepositorioAvisos,
      destinatarios: DestinatariosAvisos,
      enviador: EnviadorDeAvisos,
      reloj: Reloj,
    ) => new ProcesarAvisos(planes, avisos, destinatarios, enviador, reloj),
    inject: [REPOSITORIO_PLANES, REPOSITORIO_AVISOS, DESTINATARIOS_AVISOS, ENVIADOR_AVISOS, RELOJ],
  },
  {
    provide: GestionarFotos,
    useFactory: (fotos: RepositorioFotos, almacen: AlmacenImagenes, equipos: RepositorioEquipos) =>
      new GestionarFotos(fotos, almacen, equipos),
    inject: [REPOSITORIO_FOTOS, ALMACEN_IMAGENES, REPOSITORIO_EQUIPOS],
  },
  {
    provide: GestionarManuales,
    useFactory: (
      manuales: RepositorioManuales,
      almacen: AlmacenManuales,
      equipos: RepositorioEquipos,
      reloj: Reloj,
    ) => new GestionarManuales(manuales, almacen, equipos, reloj),
    inject: [REPOSITORIO_MANUALES, ALMACEN_MANUALES, REPOSITORIO_EQUIPOS, RELOJ],
  },
  {
    provide: GestionarMontajes,
    useFactory: (montajes: RepositorioMontajes, equipos: RepositorioEquipos, reloj: Reloj) =>
      new GestionarMontajes(montajes, equipos, reloj),
    inject: [REPOSITORIO_MONTAJES, REPOSITORIO_EQUIPOS, RELOJ],
  },
  {
    provide: GestionarRepuestos,
    useFactory: (repuestos: RepositorioRepuestos, equipos: RepositorioEquipos) =>
      new GestionarRepuestos(repuestos, equipos),
    inject: [REPOSITORIO_REPUESTOS, REPOSITORIO_EQUIPOS],
  },
];
