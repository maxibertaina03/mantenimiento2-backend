import { Module } from '@nestjs/common';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresRepository } from './proveedores.repository';

@Module({
  controllers: [ProveedoresController],
  providers: [ProveedoresService, ProveedoresRepository],
  exports: [ProveedoresService],
})
export class ProveedoresModule {}
