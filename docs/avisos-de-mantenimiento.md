# Los avisos de mantenimiento

Un correo diario con los services que vencen dentro de una semana, y con los que
ya vencieron y nadie hizo.

## Cómo funciona

1. **GitHub Actions** dispara el envío todos los días a las 07:00 de Argentina
   (`.github/workflows/avisos-mantenimiento.yml`).
2. Llama a `POST /api/avisos/procesar` con el header `x-token-avisos`.
3. El sistema busca los planes activos que vencen dentro de los próximos 7 días
   —incluidos los ya vencidos— de equipos operativos o en reparación.
4. Descarta los que ya se avisaron y, si queda alguno nuevo, manda **un solo
   correo** con la lista completa.

### Por qué el cron está en GitHub y no en la aplicación

El plan gratuito de Render **apaga el servidor cuando nadie lo usa**. Un `@Cron`
de Nest programado a las 7 de la mañana simplemente no se ejecutaría, porque a
esa hora no hay proceso corriendo. La llamada HTTP desde afuera, además,
despierta al servidor; por eso el workflow reintenta hasta seis veces con veinte
segundos de espera.

### Por qué no se repite el aviso

Cada envío queda registrado en `avisos_enviados` con la clave
`(planId, fechaService)`. Si un service vencido sigue sin hacerse, el correo
**no** se vuelve a mandar al día siguiente: se manda de nuevo recién cuando
aparece algo nuevo que avisar, o cuando el plan avanza al ciclo siguiente (que
pasa solo, al registrar el trabajo).

Sin esto, un service olvidado generaría un correo idéntico cada mañana y a la
semana alguien armaría una regla de bandeja que los archiva sin leer. Ahí el
módulo entero deja de servir.

El correo, eso sí, lista **todo** lo pendiente, no solo lo nuevo: quien lo abre
tiene que ver el panorama.

## A quién le llega

- La casilla fija de `MAIL_AVISOS` (se pueden poner varias separadas por coma).
- Todos los usuarios con rol **ADMIN**, que son los que ven el módulo Equipos.

Se descartan las direcciones `@sin-acceso.local`: las inventó la importación de
equipos IT para personas sin login y mandarles correo rebota. Los rebotes queman
la reputación del remitente y terminan mandando a spam los correos que sí
importan.

## Puesta en marcha

### 1. Generar el token

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Cargarlo en Render

En el servicio del backend → **Environment**:

| Variable       | Valor                                 |
| -------------- | ------------------------------------- |
| `TOKEN_AVISOS` | el token generado                     |
| `MAIL_AVISOS`  | `mantenimiento@lacteoslastres.com.ar` |

Sin `TOKEN_AVISOS` el endpoint queda **cerrado** y no se manda ningún aviso. Es
a propósito: es público (una máquina no tiene sesión de Clerk), y sin token
cualquiera podría disparar correos a toda la empresa desde internet.

### 3. Cargar los secrets en GitHub

En el repositorio → **Settings → Secrets and variables → Actions → New
repository secret**:

| Secret         | Valor                                         |
| -------------- | --------------------------------------------- |
| `TOKEN_AVISOS` | **el mismo** valor que cargaste en Render     |
| `URL_API`      | `https://mantenimiento2-backend.onrender.com` |

`URL_API` va **sin** barra al final y **sin** `/api`: el workflow lo agrega.

### 4. Probarlo

En la pestaña **Actions** → _Avisos de mantenimiento_ → **Run workflow**. Se
puede cambiar el adelanto en días para forzar que encuentre algo.

La salida muestra la respuesta del servidor:

```json
{ "serviciosEnPlazo": 3, "nuevos": 3, "enviado": true, "destinatarios": ["..."] }
```

Si `enviado` es `false`, el campo `motivo` dice por qué.

## Cuando alguien pregunta "¿por qué no me llegó?"

1. **Actions** → última corrida del workflow: ahí está el código HTTP y la
   respuesta.
2. Si `enviado` es `false`, mirá `motivo`.
3. Si es `true`, la tabla `avisos_enviados` guarda en `destinatarios` a quiénes
   se les mandó, así no hay que adivinar.
4. Los logs de Render tienen la misma línea, más el detalle del envío.

## Cambiar el horario

En el `cron` del workflow. Está en **UTC**: Argentina es UTC−3, así que las
07:00 locales son las `0 10 * * *`.
