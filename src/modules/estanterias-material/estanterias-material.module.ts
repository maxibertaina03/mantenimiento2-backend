import { Module } from '@nestjs/common';
import {
  EstanteriasMaterialController,
  EstanteriasMaterialService,
} from './estanterias-material.controller';

@Module({
  controllers: [EstanteriasMaterialController],
  providers: [EstanteriasMaterialService],
  exports: [EstanteriasMaterialService],
})
export class EstanteriasMaterialModule {}
