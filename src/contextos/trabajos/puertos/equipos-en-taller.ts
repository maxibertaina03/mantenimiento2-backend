/**
 * Avisarle a equipos que una máquina salió a un taller de afuera, o volvió.
 *
 * Trabajos sabe cuándo pasa —se abre, se cierra o se anula una orden
 * externa—; qué estado le corresponde a la máquina lo decide equipos, que es
 * dueño de su máquina de estados (un equipo dado de baja, por ejemplo, no
 * cambia).
 */
export interface EquiposEnTaller {
  salioAlTaller(equipoId: string): Promise<void>;
  volvioDelTaller(equipoId: string): Promise<void>;
}

export const EQUIPOS_EN_TALLER = Symbol('EquiposEnTaller');
