-- AlterTable
ALTER TABLE "planes_mantenimiento" ADD COLUMN     "modoProxima" TEXT NOT NULL DEFAULT 'DESDE_TRABAJO',
ADD COLUMN     "postergadoDesde" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tareas_programadas" ADD COLUMN     "fechaOriginal" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "postergaciones_tarea" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postergaciones_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "postergaciones_tarea_tareaId_idx" ON "postergaciones_tarea"("tareaId");

-- AddForeignKey
ALTER TABLE "postergaciones_tarea" ADD CONSTRAINT "postergaciones_tarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas_programadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postergaciones_tarea" ADD CONSTRAINT "postergaciones_tarea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

