import { Module } from '@nestjs/common';
import { CategoriasMaterialModule } from '../categorias-material/categorias-material.module';
import { UnidadesMedidaModule } from '../unidades-medida/unidades-medida.module';
import { MaterialesController } from './materiales.controller';
import { MaterialesService } from './materiales.service';
import { MaterialesRepository } from './materiales.repository';

@Module({
  // Para validar categoría y unidad al crear/actualizar con un error claro.
  imports: [CategoriasMaterialModule, UnidadesMedidaModule],
  controllers: [MaterialesController],
  providers: [MaterialesService, MaterialesRepository],
  exports: [MaterialesService, MaterialesRepository],
})
export class MaterialesModule {}
