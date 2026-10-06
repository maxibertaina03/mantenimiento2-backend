/**
 * La puerta pública de equipos: lo único que otro contexto puede usar.
 *
 * Trabajos le avisa por acá que un service se hizo (`GestionarPlanes`), sin
 * copiar la cuenta de cuándo toca el próximo. Entrar a sus carpetas internas
 * lo prohíbe la regla de límites de .eslintrc.cjs.
 */
export { EquiposModule } from './infraestructura/equipos.module';
export { GestionarPlanes } from './aplicacion/gestionar-planes';
