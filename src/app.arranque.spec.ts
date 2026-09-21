import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';

/**
 * Que la aplicación pueda armarse entera.
 *
 * Existe por un error real: el módulo de órdenes de trabajo inyectaba
 * `PermisosService` sin importar el módulo que lo provee. TypeScript no dice
 * nada —el tipo está bien— y los 847 tests pasaban, porque ninguno armaba la
 * aplicación completa. El fallo aparecía recién al arrancar en producción, que
 * es el peor lugar y el más tarde posible.
 *
 * `compile()` resuelve el grafo de dependencias sin conectarse a nada: no llama
 * a `onModuleInit`, así que no toca la base ni siembra permisos. Es exactamente
 * la parte que falla cuando a un módulo le falta un `import`.
 */
describe('la aplicación se arma', () => {
  it('REGRESION: todos los modulos resuelven sus dependencias', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      // La base no hace falta para armar el grafo, y pedirla apuntaría a la de
      // producción, que es lo último que tiene que hacer un test.
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => {}, $disconnect: async () => {} })
      .compile();

    expect(modulo).toBeDefined();
    await modulo.close();
  });
});
