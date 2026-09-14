import { Module } from '@nestjs/common';
import { CofreService } from './cofre.service';
import { CredencialesController } from './credenciales.controller';
import { CredencialesRepository } from './credenciales.repository';
import { CredencialesService } from './credenciales.service';

@Module({
  controllers: [CredencialesController],
  providers: [CredencialesService, CredencialesRepository, CofreService],
  exports: [CredencialesService],
})
export class CredencialesModule {}
