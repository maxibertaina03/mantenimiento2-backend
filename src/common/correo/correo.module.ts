import { Global, Module } from '@nestjs/common';
import { CorreoController } from './correo.controller';
import { CorreoService } from './correo.service';

@Global()
@Module({
  controllers: [CorreoController],
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
