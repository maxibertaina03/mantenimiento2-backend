--  El anotador de pendientes de mantenimiento. Solo agrega una tabla
--  nueva: no toca ningún dato existente.

-- CreateTable
CREATE TABLE "pendientes" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "asignadoAId" TEXT,
    "equipoId" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "hechaEn" TIMESTAMP(3),
    "hechaPorId" TEXT,

    CONSTRAINT "pendientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pendientes_hechaEn_idx" ON "pendientes"("hechaEn");

-- CreateIndex
CREATE INDEX "pendientes_asignadoAId_idx" ON "pendientes"("asignadoAId");

-- AddForeignKey
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendientes" ADD CONSTRAINT "pendientes_hechaPorId_fkey" FOREIGN KEY ("hechaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

