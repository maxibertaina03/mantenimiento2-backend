-- Historial de intervenciones sobre equipos de planta.
--
-- Solo agrega una tabla. NO toca ninguna existente ni ningún dato.

CREATE TABLE "intervenciones" (
    "id"              TEXT NOT NULL,
    "equipoId"        TEXT NOT NULL,
    -- PREVENTIVO | CORRECTIVO | MEJORA. Texto y no enum: agregar un tipo a un
    -- enum obliga a migrar, y los válidos los controla el dominio.
    "tipo"            TEXT NOT NULL,
    "fecha"           TIMESTAMP(3) NOT NULL,
    -- INTERNO | EXTERNO, con las dos relaciones. Un texto libre haría imposible
    -- preguntar cuánto se gastó con cada proveedor.
    "ejecutor"        TEXT NOT NULL,
    "usuarioId"       TEXT,
    "proveedorId"     TEXT,
    "descripcion"     TEXT NOT NULL,
    "costoManoObra"   DECIMAL(14,2),
    "horasParada"     DECIMAL(8,2),
    "documentoUrl"    TEXT,
    "registradoPorId" TEXT,
    "creadoEn"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intervenciones_pkey" PRIMARY KEY ("id")
);

-- El índice compuesto cubre exactamente la consulta del historial de un equipo.
CREATE INDEX "intervenciones_equipoId_fecha_idx" ON "intervenciones"("equipoId", "fecha");
CREATE INDEX "intervenciones_tipo_idx"           ON "intervenciones"("tipo");
CREATE INDEX "intervenciones_proveedorId_idx"    ON "intervenciones"("proveedorId");

-- Cascade solo desde el equipo: si se borra el equipo, su historial deja de
-- tener sentido. Un usuario o un proveedor borrado NO se lleva la intervención:
-- el registro de que el trabajo se hizo tiene que sobrevivir.
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_equipoId_fkey"
    FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_registradoPorId_fkey"
    FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
