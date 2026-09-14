import { Module } from '@nestjs/common';
import { TiposEquipoModule } from '../tipos-equipo/tipos-equipo.module';
import { ResponsablesModule } from '../responsables/responsables.module';
import { EquiposItController } from './equipos-it.controller';
import { EquiposItRepository } from './equipos-it.repository';
import { EquiposItService } from './equipos-it.service';
import { ImportarEquiposService } from './importacion/importar-equipos.service';

@Module({
  // ResponsablesModule: valida a quien se le asigna. TiposEquipoModule: el
  // importador resuelve el tipo contra el catalogo.
  imports: [ResponsablesModule, TiposEquipoModule],
  controllers: [EquiposItController],
  providers: [EquiposItService, EquiposItRepository, ImportarEquiposService],
  exports: [EquiposItService],
})
export class EquiposItModule {}
