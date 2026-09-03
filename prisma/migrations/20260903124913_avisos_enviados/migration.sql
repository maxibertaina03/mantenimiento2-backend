-- CreateTable
CREATE TABLE "avisos_enviados" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fechaService" TIMESTAMP(3) NOT NULL,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinatarios" TEXT NOT NULL,

    CONSTRAINT "avisos_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avisos_enviados_enviadoEn_idx" ON "avisos_enviados"("enviadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "avisos_enviados_planId_fechaService_key" ON "avisos_enviados"("planId", "fechaService");

-- AddForeignKey
ALTER TABLE "avisos_enviados" ADD CONSTRAINT "avisos_enviados_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes_mantenimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
