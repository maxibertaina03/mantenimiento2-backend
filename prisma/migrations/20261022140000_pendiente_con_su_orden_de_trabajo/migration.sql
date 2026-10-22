-- El pendiente guarda la orden de trabajo que se registró al hacerlo, si era
-- sobre una máquina. Solo agrega una columna vacía y su clave foránea: no toca
-- ningún dato. Si se borra la orden, el pendiente queda sin ella (SET NULL).

-- AlterTable
ALTER TABLE "pendientes" ADD COLUMN     "ordenTrabajoId" TEXT;

-- AddForeignKey
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_ordenTrabajoId_fkey" FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
