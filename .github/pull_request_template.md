## Qué entra

<!-- Lo que cambia para quien usa el sistema, en dos o tres líneas. -->

## Versión

<!-- vX.Y.Z — PARCHE si son solo arreglos, MENOR si hay algo nuevo, MAYOR si obliga a cambiar el otro repo. -->

## Antes de mergear

- [ ] El CI está en verde
- [ ] Probado en local, y en pantalla de celular si cambia algo visible
- [ ] Lo aprobó quien lo pidió
- [ ] `package.json` y `CHANGELOG.md` con la versión nueva
- [ ] Si depende del otro repo, ese cambio ya está en producción (la API va primero)
- [ ] Si hay migración: ensayada contra producción con ROLLBACK y conteos antes y después
