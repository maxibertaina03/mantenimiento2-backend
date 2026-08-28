import { Module } from '@nestjs/common';
import { TiposEquipoController } from './tipos-equipo.controller';
import { TiposEquipoRepository } from './tipos-equipo.repository';
import { TiposEquipoService } from './tipos-equipo.service';

@Module({
  controllers: [TiposEquipoController],
  providers: [TiposEquipoService, TiposEquipoRepository],
  exports: [TiposEquipoService, TiposEquipoRepository],
})
export class TiposEquipoModule {}
