-- Contexto de Equipos de planta: fase 1, la ficha.
--
-- Solo agrega tablas y una relación opcional hacia proveedores. NO toca ninguna
-- tabla existente ni ningún dato: materiales, movimientos, órdenes y equipos IT
-- quedan exactamente igual.

CREATE TABLE "ubicaciones_equipo" (
    "id"            TEXT NOT NULL,
    "nombre"        TEXT NOT NULL,
    "orden"         INTEGER NOT NULL DEFAULT 0,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ubicaciones_equipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ubicaciones_equipo_nombre_key" ON "ubicaciones_equipo"("nombre");

CREATE TABLE "tipos_equipo_planta" (
    "id"            TEXT NOT NULL,
    "nombre"        TEXT NOT NULL,
    "orden"         INTEGER NOT NULL DEFAULT 0,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tipos_equipo_planta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_equipo_planta_nombre_key" ON "tipos_equipo_planta"("nombre");

CREATE TABLE "equipos" (
    "id"            TEXT NOT NULL,
    "codigoInterno" TEXT,
    "nombre"        TEXT NOT NULL,
    "descripcion"   TEXT,
    "marca"         TEXT,
    "modelo"        TEXT,
    "numeroSerie"   TEXT,
    "ubicacionId"   TEXT,
    "tipoId"        TEXT,
    -- Texto y no enum de Postgres: agregar un estado a un enum obliga a migrar,
    -- y las transiciones válidas las controla el dominio, no la base.
    "estado"        TEXT NOT NULL DEFAULT 'OPERATIVO',
    "criticidad"    TEXT NOT NULL DEFAULT 'MEDIA',
    "fotoUrl"       TEXT,
    "proveedorId"   TEXT,
    "horasUso"      DECIMAL(12,1),
    "fechaAlta"     TIMESTAMP(3),
    "garantiaHasta" TIMESTAMP(3),
    "creadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- Único cuando está, pero opcional: las fotos de la planta traen nombres y no
-- códigos, así que exigirlo frenaría la importación de la fase 2.
CREATE UNIQUE INDEX "equipos_codigoInterno_key" ON "equipos"("codigoInterno");
CREATE INDEX "equipos_ubicacionId_idx"  ON "equipos"("ubicacionId");
CREATE INDEX "equipos_tipoId_idx"       ON "equipos"("tipoId");
CREATE INDEX "equipos_estado_idx"       ON "equipos"("estado");
CREATE INDEX "equipos_criticidad_idx"   ON "equipos"("criticidad");

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_ubicacionId_fkey"
    FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones_equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_tipoId_fkey"
    FOREIGN KEY ("tipoId") REFERENCES "tipos_equipo_planta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
