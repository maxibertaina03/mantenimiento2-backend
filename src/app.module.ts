import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { validarEntorno } from './config/env.validation';
import { ResponsablesModule } from './modules/responsables/responsables.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { CategoriasMaterialModule } from './modules/categorias-material/categorias-material.module';
import { EstanteriasMaterialModule } from './modules/estanterias-material/estanterias-material.module';
import { InformaticaModule } from './contextos/informatica';
import { CorreoModule } from './common/correo/correo.module';
import { EquiposModule } from './contextos/equipos';
import { TrabajosModule } from './contextos/trabajos';
import { TiposEquipoModule } from './modules/tipos-equipo/tipos-equipo.module';
import { UnidadesMedidaModule } from './modules/unidades-medida/unidades-medida.module';
import { PanolModule } from './contextos/panol';
import { ComprasModule } from './contextos/compras';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    // Configuración global por entorno (.env) con validación fail-fast.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    PrismaModule,
    AuthModule, // guard global de autenticación (Clerk)
    // Módulos de dominio
    ProveedoresModule,
    CategoriasMaterialModule,
    EstanteriasMaterialModule,
    PanolModule, // materiales y movimientos de stock
    ComprasModule, // ordenes de compra, comprobantes y envio
    InformaticaModule,
    ResponsablesModule,
    CorreoModule,
    EquiposModule,
    TrabajosModule,
    TiposEquipoModule,
    UnidadesMedidaModule,
    UsuariosModule,
  ],
})
export class AppModule {}
