import { Provider } from '@nestjs/common';
import { ConsultarCalendario } from '../aplicacion/consultar-calendario';
import { ConsultarOrdenesTrabajo } from '../aplicacion/consultar-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from '../aplicacion/gestionar-ordenes-trabajo';
import { GestionarTareas } from '../aplicacion/gestionar-tareas';
import { RegistrarTrabajoDePlan } from '../aplicacion/registrar-trabajo-de-plan';
import { RegistrarTrabajoHecho } from '../aplicacion/registrar-trabajo-hecho';
import { UsarMateriales } from '../aplicacion/usar-materiales';
import { CONSULTA_EQUIPOS, ConsultaEquipos } from '../puertos/consulta-equipos';
import { CONSULTA_EQUIPOS_IT, ConsultaEquiposIt } from '../puertos/consulta-equipos-it';
import { CONSULTA_USUARIOS, ConsultaUsuarios } from '../puertos/consulta-usuarios';
import { PLANES_DE_MANTENIMIENTO, PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';
import { RELOJ_TRABAJOS, Reloj } from '../puertos/reloj';
import {
  REPOSITORIO_ORDENES_TRABAJO,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';
import { REPOSITORIO_TAREAS, RepositorioTareas } from '../puertos/repositorio-tareas';
import { STOCK, Stock } from '../puertos/stock';

/**
 * Cómo se arma cada caso de uso de trabajos: con qué puertos.
 *
 * Es el único lugar donde se hace. Los controladores reciben el caso de uso
 * ya armado y solo traducen HTTP. Las órdenes que se cierran desde la pantalla
 * de órdenes y las que se cierran desde el calendario usan la misma instancia,
 * así que pasan por las mismas reglas: entre ellas, `RegistrarTrabajoDePlan`.
 */
export const casosDeUsoTrabajos: Provider[] = [
  {
    provide: RegistrarTrabajoDePlan,
    useFactory: (planes: PlanesDeMantenimiento, tareas: RepositorioTareas) =>
      new RegistrarTrabajoDePlan(planes, tareas),
    inject: [PLANES_DE_MANTENIMIENTO, REPOSITORIO_TAREAS],
  },
  {
    provide: GestionarOrdenesTrabajo,
    useFactory: (
      ordenes: RepositorioOrdenesTrabajo,
      equipos: ConsultaEquipos,
      equiposIt: ConsultaEquiposIt,
      usuarios: ConsultaUsuarios,
      planes: PlanesDeMantenimiento,
      reloj: Reloj,
      trabajoDePlan: RegistrarTrabajoDePlan,
    ) =>
      new GestionarOrdenesTrabajo(
        ordenes,
        equipos,
        equiposIt,
        usuarios,
        planes,
        reloj,
        trabajoDePlan,
      ),
    inject: [
      REPOSITORIO_ORDENES_TRABAJO,
      CONSULTA_EQUIPOS,
      CONSULTA_EQUIPOS_IT,
      CONSULTA_USUARIOS,
      PLANES_DE_MANTENIMIENTO,
      RELOJ_TRABAJOS,
      RegistrarTrabajoDePlan,
    ],
  },
  {
    provide: UsarMateriales,
    useFactory: (ordenes: RepositorioOrdenesTrabajo, stock: Stock) =>
      new UsarMateriales(ordenes, stock),
    inject: [REPOSITORIO_ORDENES_TRABAJO, STOCK],
  },
  {
    provide: ConsultarOrdenesTrabajo,
    useFactory: (ordenes: RepositorioOrdenesTrabajo, equipos: ConsultaEquipos) =>
      new ConsultarOrdenesTrabajo(ordenes, equipos),
    inject: [REPOSITORIO_ORDENES_TRABAJO, CONSULTA_EQUIPOS],
  },
  {
    provide: RegistrarTrabajoHecho,
    useFactory: (gestionar: GestionarOrdenesTrabajo, materiales: UsarMateriales) =>
      new RegistrarTrabajoHecho(gestionar, materiales),
    inject: [GestionarOrdenesTrabajo, UsarMateriales],
  },
  {
    provide: ConsultarCalendario,
    useFactory: (tareas: RepositorioTareas, planes: PlanesDeMantenimiento, reloj: Reloj) =>
      new ConsultarCalendario(tareas, planes, reloj),
    inject: [REPOSITORIO_TAREAS, PLANES_DE_MANTENIMIENTO, RELOJ_TRABAJOS],
  },
  {
    provide: GestionarTareas,
    useFactory: (
      tareas: RepositorioTareas,
      equipos: ConsultaEquipos,
      equiposIt: ConsultaEquiposIt,
      usuarios: ConsultaUsuarios,
      trabajos: RegistrarTrabajoHecho,
      reloj: Reloj,
    ) => new GestionarTareas(tareas, equipos, equiposIt, usuarios, trabajos, reloj),
    inject: [
      REPOSITORIO_TAREAS,
      CONSULTA_EQUIPOS,
      CONSULTA_EQUIPOS_IT,
      CONSULTA_USUARIOS,
      RegistrarTrabajoHecho,
      RELOJ_TRABAJOS,
    ],
  },
];
