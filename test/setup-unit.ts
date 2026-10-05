/**
 * Entorno de los tests UNITARIOS, antes de importar cualquier módulo.
 *
 * Existe porque el test de arranque (src/app.arranque.spec.ts) arma la
 * aplicación entera, y la validación de entorno exige una base. En la PC de
 * desarrollo la sacaba del .env local y pasaba; en el CI no hay .env y fallaba.
 *
 * Son valores de juguete A PROPÓSITO, y pisan a los del .env: un test unitario
 * nunca tiene que ver la dirección de una base real, ni siquiera la local.
 * Las variables que ya existen en process.env tienen prioridad sobre el .env
 * en ConfigModule, así que esto alcanza.
 */
process.env.DATABASE_URL = 'postgresql://unit/unit';
process.env.DIRECT_URL = 'postgresql://unit/unit';
process.env.AUTH_DISABLED = 'true';
