# Cómo se trabaja en este proyecto

## La regla

> **Ningún cambio va a `main` sin haber sido aprobado en `develop`.**

`main` es lo que usa la gente todos los días: Render lo despliega automáticamente
y pega contra la base de Supabase con los datos reales — 870 materiales, 1067
proveedores, 65 equipos IT y el historial de movimientos de stock.

Esto no es una formalidad. El sistema está en uso: un error en `main` no es un
test que falla, es alguien que no puede cargar un movimiento.

## Las ramas

| Rama | Qué es | Base de datos | Se despliega |
|---|---|---|---|
| `main` | Producción | Supabase | Render + Vercel, automático |
| `develop` | Desarrollo y prueba | Neon (o Supabase de prueba) | No, se corre local |

## El flujo

1. **Trabajar en `develop`**, nunca directo en `main`.

   ```bash
   git checkout develop
   ```

2. **Probar en local, contra la base de desarrollo**:

   ```bash
   npm run prueba:api        # backend en :3000 contra .env.prueba
   npm run test:all          # 332 unitarios + 97 e2e
   ```

3. **Que lo apruebe quien lo pidió.** No alcanza con que los tests pasen: los
   tests dicen que el código hace lo que se le pidió, no que lo pedido sea lo
   que hacía falta. Hay que verlo funcionando.

4. **Recién ahí, pasar a `main`**:

   ```bash
   git checkout main
   git merge develop
   git push origin main      # esto despliega a producción
   ```

5. **Volver a `develop`** para lo siguiente.

## Migraciones

Una migración se prueba primero en la base de desarrollo:

```bash
npm run prueba:nueva-migracion    # crea el SQL y lo aplica en desarrollo
```

Si la migración **toca datos que ya existen** (renombrar columnas, cambiar
tipos, backfills), antes de llevarla a `main` hay que ensayarla contra
producción **dentro de una transacción con ROLLBACK**, verificando los conteos
antes y después. Hay ejemplos de eso en `scripts/`.

Render corre `prisma migrate deploy` en el build, así que la migración se aplica
sola al mergear a `main`. Eso significa que **una migración mal probada llega a
producción sin que nadie la revise de nuevo**.

## Lo que nunca se hace

- Correr `prisma migrate dev`, `migrate reset` o `--shadow-database-url` contra
  producción. Ya vació la base una vez. `scripts/guardia-entorno.js` bloquea los
  comandos que pasan por npm, pero **no protege contra un comando escrito a mano
  con la URL pegada**, que es exactamente como pasó.
- Pushear a `main` sin que el cambio haya estado funcionando en `develop`.
- Dejar `AUTH_DISABLED=true` en producción: deja la API completamente abierta.

## Antes de mergear a `main`

- [ ] Los tests pasan (`npm run test:all`)
- [ ] Compila (`npm run build`)
- [ ] Sin errores de lint (`npx eslint "src/**/*.ts" "test/**/*.ts"`)
- [ ] Probado a mano en local contra la base de desarrollo
- [ ] Si hay migración: ensayada, y con ROLLBACK contra producción si toca datos
- [ ] Aprobado por quien pidió el cambio
