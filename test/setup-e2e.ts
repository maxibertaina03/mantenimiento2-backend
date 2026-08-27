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
