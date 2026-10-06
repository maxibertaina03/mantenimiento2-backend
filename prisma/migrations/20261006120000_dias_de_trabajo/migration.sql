-- AlterTable
ALTER TABLE "planes_mantenimiento" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- AlterTable
ALTER TABLE "rutinas_tarea" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

