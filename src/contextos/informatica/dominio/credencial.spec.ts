import {
  aplicarCambios,
  crearCredencial,
  validarNombreLibre,
  validarQueNoTraeSecreto,
  validarQuePuedeVerla,
  validarSecretoNuevo,
} from './credencial';

/**
 * Las reglas del baul, sin framework y sin base.
 *
 * Corren en milisegundos porque no levantan nada: es la senial de que el
 * dominio quedo de verdad separado. Si alguna vez para probar esto hiciera
 * falta un modulo de Nest o un Prisma, es que una regla se fue de lugar.
 */
const AHORA = new Date('2026-09-25T10:00:00.000Z');

describe('guardar una credencial', () => {
  it('normaliza el nombre y deja los datos listos', () => {
    const c = crearCredencial({ nombre: '  Camara   del  pasillo ', secreto: 'Clave1!' }, AHORA);

    expect(c.nombre).toBe('Camara del pasillo');
    expect(c.activo).toBe(true);
    expect(c.rotadaEn).toEqual(AHORA);
  });

  it('sin nombre no se guarda', () => {
    expect(() => crearCredencial({ nombre: '   ', secreto: 'Clave1!' }, AHORA)).toThrow(
      /necesita un nombre/i,
    );
  });

  it('sin contrasenia tampoco', () => {
    expect(() => crearCredencial({ nombre: 'Algo', secreto: '  ' }, AHORA)).toThrow(/contrase/i);
  });

  it('sin rotacion configurada no hay proxima fecha', () => {
    // No todo acceso necesita cambiarse cada tanto, y ponerle fecha a todo
    // convierte los avisos en ruido que nadie mira.
    const c = crearCredencial({ nombre: 'Sin rotacion', secreto: 'Clave1!' }, AHORA);
    expect(c.proximaRotacion).toBeNull();
  });

  it('con rotacion cada 90 dias, la proxima cae a los 90', () => {
    const c = crearCredencial(
      { nombre: 'Con rotacion', secreto: 'Clave1!', rotarCadaDias: 90 },
      AHORA,
    );
    expect(c.proximaRotacion).toEqual(new Date('2026-12-24T10:00:00.000Z'));
  });

  it('rotar cada cero dias no es una rotacion valida', () => {
    expect(() =>
      crearCredencial({ nombre: 'Mal', secreto: 'Clave1!', rotarCadaDias: 0 }, AHORA),
    ).toThrow(/numero de dias|número de días/i);
  });

  it('los campos de texto vacios quedan en null, no en cadena vacia', () => {
    const c = crearCredencial({ nombre: 'Limpia', secreto: 'Clave1!', usuario: '  ' }, AHORA);
    expect(c.usuario).toBeNull();
  });
});

describe('el nombre no se puede repetir', () => {
  const EXISTENTES = [{ id: 'c1', nombre: 'PC de recepcion' }];

  it('REGRESION: rechaza un nombre que ya esta', () => {
    // Dos credenciales con el mismo nombre son indistinguibles en la pantalla,
    // y en un baul eso lleva a probar la contrasenia equivocada en el lugar
    // equivocado.
    expect(() => validarNombreLibre('PC de recepcion', EXISTENTES)).toThrow(/ya hay/i);
  });

  it('REGRESION: no se compara letra por letra', () => {
    // "pc de RECEPCION" es el mismo nombre para una persona.
    expect(() => validarNombreLibre('pc de RECEPCION', EXISTENTES)).toThrow(/ya hay/i);
  });

  it('al editar, no choca consigo misma', () => {
    expect(() => validarNombreLibre('PC de recepcion', EXISTENTES, 'c1')).not.toThrow();
  });

  it('un nombre libre pasa', () => {
    expect(() => validarNombreLibre('Grabadora', EXISTENTES)).not.toThrow();
  });
});

describe('cambiar la contrasenia', () => {
  it('REGRESION: no se acepta una que ya se uso', () => {
    // Rotar hacia una clave vieja deja el sistema diciendo que se roto cuando
    // en la practica no cambio nada.
    expect(() => validarSecretoNuevo(true)).toThrow(/ya se us/i);
  });

  it('una nueva pasa', () => {
    expect(() => validarSecretoNuevo(false)).not.toThrow();
  });

  it('REGRESION: la contrasenia no se puede cambiar editando', () => {
    // Si se pudiera, habria un camino para cambiarla sin que quede registro, y
    // el historial dejaria de contar la verdad.
    expect(() => validarQueNoTraeSecreto({ secreto: 'colada' })).toThrow(/se rota/i);
  });

  it('editar otros campos no molesta', () => {
    expect(() => validarQueNoTraeSecreto({ notas: 'esta arriba' })).not.toThrow();
  });
});

describe('ver la contrasenia', () => {
  it('REGRESION: sin saber quien la pide, no se entrega', () => {
    // La unica proteccion real del baul, ademas del cifrado, es poder decir
    // despues quien miro que. Entregarla sin poder anotarlo da una seguridad
    // que no existe.
    expect(() => validarQuePuedeVerla(null)).toThrow(/quién|quien/i);
    expect(() => validarQuePuedeVerla(undefined)).toThrow();
    expect(() => validarQuePuedeVerla('')).toThrow();
  });

  it('con usuario, se entrega', () => {
    expect(() => validarQuePuedeVerla('u1')).not.toThrow();
  });
});

describe('editar la ficha', () => {
  it('solo devuelve lo que se mando', () => {
    // Si devolviera todo, editar las notas pisaria el resto con undefined.
    expect(aplicarCambios({ notas: 'nueva nota' })).toEqual({ notas: 'nueva nota' });
  });

  it('normaliza el nombre igual que al crear', () => {
    expect(aplicarCambios({ nombre: '  Camara   1 ' }).nombre).toBe('Camara 1');
  });

  it('dejar el nombre vacio es un error, no un nombre vacio', () => {
    expect(() => aplicarCambios({ nombre: '   ' })).toThrow(/necesita un nombre/i);
  });

  it('se puede desatar de un equipo mandando null', () => {
    // Sin esto se podia atar una credencial a una maquina pero nunca
    // despegarla, y el dia que esa clave deja de ser de esa PC queda
    // apuntando a algo que ya no es cierto.
    expect(aplicarCambios({ equipoItId: null })).toEqual({ equipoItId: null });
  });

  it('desactivarla es un cambio como cualquier otro', () => {
    expect(aplicarCambios({ activo: false })).toEqual({ activo: false });
  });
});
