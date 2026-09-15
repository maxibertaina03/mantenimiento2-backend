-- Los roles que pidió el usuario, y la tabla que dice qué puede hacer cada uno.
--
-- Escrita a mano: Prisma no genera sola el renombrado de un valor de enum, y lo
-- que ofrece en su lugar es borrar el tipo y volver a crearlo, que se lleva
-- puesto el rol de todos los usuarios.
--
-- `OPERARIO` no se borra ni se reemplaza: se RENOMBRA. Los tres usuarios que lo
-- tienen quedan como MANTENIMIENTO sin que haya que tocar una sola fila, y el
-- valor por defecto de la columna sigue apuntando al mismo lugar porque
-- Postgres arrastra el renombre.
ALTER TYPE "RolUsuario" RENAME VALUE 'OPERARIO' TO 'MANTENIMIENTO';

ALTER TYPE "RolUsuario" ADD VALUE 'GERENCIA';
ALTER TYPE "RolUsuario" ADD VALUE 'ADMINISTRATIVO';

-- Qué permisos tiene cada rol. Una fila por permiso concedido.
--
-- Arranca vacía a propósito. La siembra la hace la aplicación al arrancar
-- (`SiembraPermisos`), y no esta migración, por dos razones: Postgres no deja
-- usar un valor de enum recién agregado dentro de la misma transacción que lo
-- agregó, y sembrar desde el código permite que un permiso nuevo llegue a los
-- roles que ya existen sin escribir otra migración.
CREATE TABLE "permisos_rol" (
    "rol" "RolUsuario" NOT NULL,
    "permiso" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_rol_pkey" PRIMARY KEY ("rol","permiso")
);

CREATE INDEX "permisos_rol_rol_idx" ON "permisos_rol"("rol");
