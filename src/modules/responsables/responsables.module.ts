import { Module } from '@nestjs/common';
import { ResponsablesController, ResponsablesService } from './responsables.controller';

@Module({
  controllers: [ResponsablesController],
  providers: [ResponsablesService],
  exports: [ResponsablesService],
})
export class ResponsablesModule {}
