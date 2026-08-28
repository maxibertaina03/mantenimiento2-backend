import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { validarEntorno } from './config/env.validation';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { CategoriasMaterialModule } from './modules/categorias-material/categorias-material.module';
import { EquiposItModule } from './modules/equipos-it/equipos-it.module';
import { CorreoModule } from './common/correo/correo.module';
import { TiposEquipoModule } from './modules/tipos-equipo/tipos-equipo.module';
import { UnidadesMedidaModule } from './modules/unidades-medida/unidades-medida.module';
import { MaterialesModule } from './modules/materiales/materiales.module';
import { MovimientosStockModule } from './modules/movimientos-stock/movimientos-stock.module';
import { OrdenesCompraModule } from './modules/ordenes-compra/ordenes-compra.module';
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
    MaterialesModule,
    MovimientosStockModule,
    OrdenesCompraModule,
    EquiposItModule,
    CorreoModule,
    TiposEquipoModule,
    UnidadesMedidaModule,
    UsuariosModule,
  ],
})
export class AppModule {}
