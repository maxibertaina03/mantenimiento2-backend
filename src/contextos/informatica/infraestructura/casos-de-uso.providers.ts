import { Provider } from '@nestjs/common';
import { GestionarCredenciales } from '../aplicacion/gestionar-credenciales';
import { GestionarEquiposIt } from '../aplicacion/gestionar-equipos-it';
import { COFRE, Cofre } from '../puertos/cofre';
import { CONSULTA_EQUIPOS_IT_BAUL, ConsultaEquiposIt } from '../puertos/consulta-equipos-it';
import { CONSULTA_RESPONSABLES, ConsultaResponsables } from '../puertos/consulta-responsables';
import { RELOJ_INFORMATICA, Reloj } from '../puertos/reloj';
import {
  REPOSITORIO_CREDENCIALES,
  RepositorioCredenciales,
} from '../puertos/repositorio-credenciales';
import { REPOSITORIO_EQUIPOS_IT, RepositorioEquiposIt } from '../puertos/repositorio-equipos-it';

/**
 * Cómo se arma cada caso de uso de informática: con qué puertos. Los
 * controladores los reciben armados y solo traducen HTTP.
 */
export const casosDeUsoInformatica: Provider[] = [
  {
    provide: GestionarEquiposIt,
    useFactory: (equipos: RepositorioEquiposIt, responsables: ConsultaResponsables, reloj: Reloj) =>
      new GestionarEquiposIt(equipos, responsables, reloj),
    inject: [REPOSITORIO_EQUIPOS_IT, CONSULTA_RESPONSABLES, RELOJ_INFORMATICA],
  },
  {
    provide: GestionarCredenciales,
    useFactory: (
      credenciales: RepositorioCredenciales,
      cofre: Cofre,
      equipos: ConsultaEquiposIt,
      reloj: Reloj,
    ) => new GestionarCredenciales(credenciales, cofre, equipos, reloj),
    inject: [REPOSITORIO_CREDENCIALES, COFRE, CONSULTA_EQUIPOS_IT_BAUL, RELOJ_INFORMATICA],
  },
];
