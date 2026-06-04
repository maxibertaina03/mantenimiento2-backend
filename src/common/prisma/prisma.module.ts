import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Módulo global: expone PrismaService a toda la app sin reimportarlo en cada módulo.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
