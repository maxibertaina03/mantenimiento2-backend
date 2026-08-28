import { Module } from '@nestjs/common';
import { UnidadesMedidaController } from './unidades-medida.controller';
import { UnidadesMedidaRepository } from './unidades-medida.repository';
import { UnidadesMedidaService } from './unidades-medida.service';

@Module({
  controllers: [UnidadesMedidaController],
  providers: [UnidadesMedidaService, UnidadesMedidaRepository],
  exports: [UnidadesMedidaService, UnidadesMedidaRepository],
})
export class UnidadesMedidaModule {}
