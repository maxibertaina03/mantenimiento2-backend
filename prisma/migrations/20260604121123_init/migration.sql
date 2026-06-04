-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MotivoMovimiento" AS ENUM ('COMPRA', 'TRABAJO', 'AJUSTE', 'DEVOLUCION', 'OTRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERARIO');

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "categorias_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockActual" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "motivo" "MotivoMovimiento" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorId" TEXT,
    "usuarioId" TEXT,
    "referenciaTrabajo" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "idExterno" TEXT,
    "rol" "RolUsuario" NOT NULL DEFAULT 'OPERARIO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_cuit_key" ON "proveedores"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_material_nombre_key" ON "categorias_material"("nombre");

-- CreateIndex
CREATE INDEX "materiales_categoriaId_idx" ON "materiales"("categoriaId");

-- CreateIndex
CREATE INDEX "movimientos_stock_materialId_idx" ON "movimientos_stock"("materialId");

-- CreateIndex
CREATE INDEX "movimientos_stock_tipo_idx" ON "movimientos_stock"("tipo");

-- CreateIndex
CREATE INDEX "movimientos_stock_motivo_idx" ON "movimientos_stock"("motivo");

-- CreateIndex
CREATE INDEX "movimientos_stock_fecha_idx" ON "movimientos_stock"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_idExterno_key" ON "usuarios"("idExterno");

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
