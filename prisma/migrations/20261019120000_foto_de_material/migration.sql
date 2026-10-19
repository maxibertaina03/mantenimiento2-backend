-- La foto de un material, para reconocerlo en el estante. Solo agrega una
-- columna vacía: no toca ningún dato.

-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "fotoUrl" TEXT;
