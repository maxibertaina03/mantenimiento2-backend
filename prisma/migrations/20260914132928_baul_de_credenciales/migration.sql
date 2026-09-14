-- CreateEnum
CREATE TYPE "TipoCredencial" AS ENUM ('CORREO', 'ACCESO_REMOTO', 'EQUIPO', 'SERVICIO', 'RED', 'OTRO');

-- CreateTable
CREATE TABLE "credenciales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCredencial" NOT NULL DEFAULT 'OTRO',
    "usuario" TEXT,
    "secretoCifrado" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "url" TEXT,
    "notas" TEXT,
    "equipoItId" TEXT,
    "rotarCadaDias" INTEGER,
    "rotadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximaRotacion" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotaciones_credencial" (
    "id" TEXT NOT NULL,
    "credencialId" TEXT NOT NULL,
    "rotadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotadaPorId" TEXT,
    "huellaAnterior" TEXT NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "rotaciones_credencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vistas_credencial" (
    "id" TEXT NOT NULL,
    "credencialId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vistaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vistas_credencial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credenciales_tipo_idx" ON "credenciales"("tipo");

-- CreateIndex
CREATE INDEX "credenciales_equipoItId_idx" ON "credenciales"("equipoItId");

-- CreateIndex
CREATE INDEX "credenciales_proximaRotacion_idx" ON "credenciales"("proximaRotacion");

-- CreateIndex
CREATE INDEX "rotaciones_credencial_credencialId_rotadaEn_idx" ON "rotaciones_credencial"("credencialId", "rotadaEn");

-- CreateIndex
CREATE INDEX "vistas_credencial_credencialId_vistaEn_idx" ON "vistas_credencial"("credencialId", "vistaEn");

-- CreateIndex
CREATE INDEX "vistas_credencial_usuarioId_vistaEn_idx" ON "vistas_credencial"("usuarioId", "vistaEn");

-- AddForeignKey
ALTER TABLE "credenciales" ADD CONSTRAINT "credenciales_equipoItId_fkey" FOREIGN KEY ("equipoItId") REFERENCES "equipos_it"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotaciones_credencial" ADD CONSTRAINT "rotaciones_credencial_credencialId_fkey" FOREIGN KEY ("credencialId") REFERENCES "credenciales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotaciones_credencial" ADD CONSTRAINT "rotaciones_credencial_rotadaPorId_fkey" FOREIGN KEY ("rotadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vistas_credencial" ADD CONSTRAINT "vistas_credencial_credencialId_fkey" FOREIGN KEY ("credencialId") REFERENCES "credenciales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vistas_credencial" ADD CONSTRAINT "vistas_credencial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
