-- CreateTable
CREATE TABLE "fotos_equipo" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "descripcion" TEXT,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPorId" TEXT,

    CONSTRAINT "fotos_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fotos_equipo_equipoId_idx" ON "fotos_equipo"("equipoId");

-- AddForeignKey
ALTER TABLE "fotos_equipo" ADD CONSTRAINT "fotos_equipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_equipo" ADD CONSTRAINT "fotos_equipo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

