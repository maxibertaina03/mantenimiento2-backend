import { Module } from '@nestjs/common';
import { CategoriasMaterialModule } from '../categorias-material/categorias-material.module';
import { MaterialesController } from './materiales.controller';
import { MaterialesService } from './materiales.service';
import { MaterialesRepository } from './materiales.repository';

@Module({
  imports: [CategoriasMaterialModule], // para validar la categoría al crear/actualizar
  controllers: [MaterialesController],
  providers: [MaterialesService, MaterialesRepository],
  exports: [MaterialesService, MaterialesRepository],
})
export class MaterialesModule {}
