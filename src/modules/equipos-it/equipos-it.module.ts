import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EquiposItController } from './equipos-it.controller';
import { EquiposItRepository } from './equipos-it.repository';
import { EquiposItService } from './equipos-it.service';
import { ImportarEquiposService } from './importacion/importar-equipos.service';

@Module({
  imports: [UsuariosModule], // para validar el usuario al asignar
  controllers: [EquiposItController],
  providers: [EquiposItService, EquiposItRepository, ImportarEquiposService],
  exports: [EquiposItService],
})
export class EquiposItModule {}
