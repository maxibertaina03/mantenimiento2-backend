/**
 * Se ejecuta ANTES de importar cualquier modulo del test.
 *
 * Es necesario: `ConfigModule.forRoot()` se evalua al importar AppModule y
 * captura el entorno en ese momento, asi que setear process.env dentro de un
 * beforeAll llega tarde.
 */
process.env.DATABASE_URL = 'postgresql://test/test';
process.env.DIRECT_URL = 'postgresql://test/test';
process.env.AUTH_DISABLED = 'true';
process.env.CLERK_SECRET_KEY = '';

// El baul de credenciales necesita su clave para cifrar. Sin ella queda
// deshabilitado y sus endpoints contestan 503, asi que no se podria probar.
// Es una clave de juguete, valida solo para los tests: 32 bytes en base64.
process.env.CLAVE_SECRETOS = Buffer.alloc(32, 7).toString('base64');

// Con AUTH_DISABLED la API queda abierta pero SIN usuario, y las reglas que
// preguntan quien sos —revelar una contrasenia, cerrar una tarea— responden
// 403. Con esto el guard entra como el usuario sembrado en el Prisma en
// memoria, y se puede probar el camino normal y no solo el rechazo.
process.env.USUARIO_DEV = 'tester@e2e.local';
