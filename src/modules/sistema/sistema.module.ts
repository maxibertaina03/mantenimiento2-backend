import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';

/** Lo que es del sistema en sí y no de un área: por ahora, su versión. */
@Module({ controllers: [VersionController] })
export class SistemaModule {}
