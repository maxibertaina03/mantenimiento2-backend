import { Module } from '@nestjs/common';
import { CategoriasMaterialController } from './categorias-material.controller';
import { CategoriasMaterialService } from './categorias-material.service';
import { CategoriasMaterialRepository } from './categorias-material.repository';

@Module({
  controllers: [CategoriasMaterialController],
  providers: [CategoriasMaterialService, CategoriasMaterialRepository],
  exports: [CategoriasMaterialService],
})
export class CategoriasMaterialModule {}
