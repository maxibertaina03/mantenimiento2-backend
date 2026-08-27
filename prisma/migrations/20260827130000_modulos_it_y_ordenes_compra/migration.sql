-- CreateEnum
CREATE TYPE "TipoEquipoIT" AS ENUM ('PC', 'NOTEBOOK', 'SERVIDOR', 'CELULAR', 'CAMARA_SEGURIDAD', 'TABLET', 'IMPRESORA', 'MONITOR', 'EQUIPO_RED', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEquipoIT" AS ENUM ('EN_USO', 'EN_DEPOSITO', 'EN_REPARACION', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "TipoDisco" AS ENUM ('HDD', 'SSD', 'NVME', 'EMMC');

-- CreateEnum
CREATE TYPE "TipoAccesoRemoto" AS ENUM ('NINGUNO', 'ANYDESK', 'TEAMVIEWER', 'RDP', 'VNC', 'SSH', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'EMITIDA', 'RECIBIDA', 'ANULADA');

-- CreateTable
CREATE TABLE "equipos_it" (
    "id" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "tipo" "TipoEquipoIT" NOT NULL,
    "estado" "EstadoEquipoIT" NOT NULL DEFAULT 'EN_DEPOSITO',
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "procesador" TEXT,
    "memoriaRamGb" INTEGER,
    "discoTipo" "TipoDisco",
    "discoCapacidadGb" INTEGER,
    "sistemaOperativo" TEXT,
    "direccionIp" TEXT,
    "direccionMac" TEXT,
    "nombreEnRed" TEXT,
    "accesoRemoto" "TipoAccesoRemoto" NOT NULL DEFAULT 'NINGUNO',
    "accesoRemotoId" TEXT,
    "ubicacion" TEXT,
    "proveedorId" TEXT,
    "fechaCompra" TIMESTAMP(3),
    "garantiaHasta" TIMESTAMP(3),
    "notas" TEXT,
    "asignadoAId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_it_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_equipo_it" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "registradoPorId" TEXT,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "motivo" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_equipo_it_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "proveedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntregaEstimada" TIMESTAMP(3),
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "emitidaEn" TIMESTAMP(3),
    "recibidaEn" TIMESTAMP(3),
    "recibidaPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renglones_orden_compra" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,2),
    "notas" TEXT,
    "movimientoId" TEXT,

    CONSTRAINT "renglones_orden_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_documento" (
    "clave" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contadores_documento_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipos_it_codigoInterno_key" ON "equipos_it"("codigoInterno");

-- CreateIndex
CREATE INDEX "equipos_it_tipo_idx" ON "equipos_it"("tipo");

-- CreateIndex
CREATE INDEX "equipos_it_estado_idx" ON "equipos_it"("estado");

-- CreateIndex
CREATE INDEX "equipos_it_asignadoAId_idx" ON "equipos_it"("asignadoAId");

-- CreateIndex
CREATE INDEX "asignaciones_equipo_it_equipoId_idx" ON "asignaciones_equipo_it"("equipoId");

-- CreateIndex
CREATE INDEX "asignaciones_equipo_it_usuarioId_idx" ON "asignaciones_equipo_it"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "ordenes_compra_proveedorId_idx" ON "ordenes_compra"("proveedorId");

-- CreateIndex
CREATE INDEX "ordenes_compra_fecha_idx" ON "ordenes_compra"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "renglones_orden_compra_movimientoId_key" ON "renglones_orden_compra"("movimientoId");

-- CreateIndex
CREATE INDEX "renglones_orden_compra_ordenId_idx" ON "renglones_orden_compra"("ordenId");

-- CreateIndex
CREATE INDEX "renglones_orden_compra_materialId_idx" ON "renglones_orden_compra"("materialId");

-- AddForeignKey
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos_it" ADD CONSTRAINT "equipos_it_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_equipo_it" ADD CONSTRAINT "asignaciones_equipo_it_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos_it"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_equipo_it" ADD CONSTRAINT "asignaciones_equipo_it_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_equipo_it" ADD CONSTRAINT "asignaciones_equipo_it_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_recibidaPorId_fkey" FOREIGN KEY ("recibidaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_orden_compra" ADD CONSTRAINT "renglones_orden_compra_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_orden_compra" ADD CONSTRAINT "renglones_orden_compra_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renglones_orden_compra" ADD CONSTRAINT "renglones_orden_compra_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

