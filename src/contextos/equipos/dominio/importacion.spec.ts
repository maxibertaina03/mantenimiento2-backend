import { CARPETAS_EXCLUIDAS_POR_DEFECTO, detectarEquipos } from './importacion';

/**
 * Detección de equipos desde la carpeta de fotos de la planta.
 *
 * Los casos están tomados de los archivos reales: 522 archivos en 19 sectores,
 * con herramientas, manuales y equipos de IT mezclados entre las máquinas.
 */
const ruta = (r: string) => ({ ruta: r });
const nombres = (rutas: string[]) => detectarEquipos(rutas.map(ruta)).equipos.map((e) => e.nombre);

describe('detectarEquipos', () => {
  it('la carpeta es la ubicacion y el archivo es el equipo', () => {
    const { equipos } = detectarEquipos([ruta('Caldera/Bomba caldera 1.jpg')]);
    expect(equipos).toEqual([
      expect.objectContaining({ nombre: 'Bomba caldera 1', ubicacion: 'Caldera' }),
    ]);
  });

  it('sirve con la carpeta raiz que agrega el navegador', () => {
    // Al elegir un directorio, el navegador antepone su nombre a cada ruta.
    const { equipos } = detectarEquipos([ruta('FOTOS HERRAMIENTAS LLT/Tinas/Tina 1.jpg')]);
    expect(equipos[0]).toMatchObject({ nombre: 'Tina 1', ubicacion: 'Tinas' });
  });

  it('junta las ubicaciones encontradas, ordenadas y sin repetir', () => {
    const { ubicaciones } = detectarEquipos([
      ruta('Tinas/Tina 1.jpg'),
      ruta('Caldera/Caldera.jpg'),
      ruta('Tinas/Tina 2.jpg'),
    ]);
    expect(ubicaciones).toEqual(['Caldera', 'Tinas']);
  });

  it('REGRESION: Taller queda afuera — son herramientas, no equipos', () => {
    // Sus 103 archivos son alicates, amoladoras y calibres. Van a su propio
    // modulo; mezclarlos ensuciaria el inventario de maquinas.
    const { equipos, descartados } = detectarEquipos([
      ruta('Taller/Amoladora 1.jpg'),
      ruta('Caldera/Compresor 1.jpg'),
    ]);
    expect(equipos.map((e) => e.nombre)).toEqual(['Compresor 1']);
    expect(descartados[0]).toEqual({ ruta: 'Taller/Amoladora 1.jpg', motivo: 'carpeta_excluida' });
  });

  it('los manuales tampoco: son PDF, no equipos', () => {
    const { equipos } = detectarEquipos([ruta('manuales/DESNATADORA.pdf')]);
    expect(equipos).toHaveLength(0);
  });

  it('se puede cambiar que carpetas se excluyen', () => {
    // Si algun dia quieren importar Taller igual, no hace falta tocar el codigo.
    const { equipos } = detectarEquipos([ruta('Taller/Amoladora 1.jpg')], []);
    expect(equipos.map((e) => e.nombre)).toEqual(['Amoladora 1']);
  });

  it('descarta lo que no es imagen', () => {
    const { descartados } = detectarEquipos([
      ruta('Caldera/inventario.xlsx'),
      ruta('Caldera/video.mp4'),
    ]);
    expect(descartados.map((d) => d.motivo)).toEqual(['no_es_imagen', 'no_es_imagen']);
  });

  it('descarta los archivos sueltos en la raiz, sin sector', () => {
    const { descartados } = detectarEquipos([ruta('Extractor camara de cremoso.jpg')]);
    expect(descartados[0].motivo).toBe('sin_carpeta');
  });

  it('normaliza el nombre: recorta y colapsa espacios', () => {
    expect(nombres(['Caldera/  Bomba   caldera  1 .jpg'])).toEqual(['Bomba caldera 1']);
  });

  it('acepta mayusculas en la extension', () => {
    expect(nombres(['Tinas/Tina 1.JPG'])).toEqual(['Tina 1']);
  });
});

describe('detectarEquipos — advertencias', () => {
  const advertenciasDe = (r: string) => detectarEquipos([ruta(r)]).equipos[0].advertencias;

  it('REGRESION: marca los que ya estan en Equipos IT', () => {
    // Router, rack y PC aparecen en las fotos de planta y ya estan cargados en
    // el otro modulo: importarlos los duplicaria.
    expect(advertenciasDe('Caldera/Router caldera 1.jpg')).toContain('posible_equipo_it');
    expect(advertenciasDe('Tinas/Rack 3.jpg')).toContain('posible_equipo_it');
    expect(advertenciasDe('Tinas/PCF4.jpg')).toContain('posible_equipo_it');
    expect(advertenciasDe('Oficina/Extensor WiFi 2.jpg')).toContain('posible_equipo_it');
  });

  it('REGRESION: "Tablero" no se confunde con equipo de IT', () => {
    // Un tablero electrico es una maquina de planta. Sin limite de palabra, un
    // match por subcadena lo descartaria mal.
    expect(advertenciasDe('Tinas/Tablero tina 2.jpg')).toEqual([]);
  });

  it('REGRESION: una serie numerada NO es duplicado', () => {
    // En una planta "Compresor 1" y "Compresor 2" son dos compresores reales.
    // Marcarlos daba 200 advertencias sobre 389 equipos contra la carpeta real,
    // y una advertencia que sale en la mitad de las filas no la lee nadie.
    const { equipos } = detectarEquipos([
      ruta('Caldera/Compresor 1.jpg'),
      ruta('Caldera/Compresor 2.jpg'),
    ]);
    for (const e of equipos) expect(e.advertencias).not.toContain('posible_duplicado');
  });

  it('pero el nombre sin numero MAS variantes numeradas si lo es', () => {
    // "Extractor" + "Extractor 1" + "Extractor 2" son casi seguro tres fotos
    // del mismo equipo.
    const { equipos } = detectarEquipos([
      ruta('Envase/Extractor.jpg'),
      ruta('Envase/Extractor 1.jpg'),
      ruta('Envase/Extractor 2.jpg'),
    ]);
    for (const e of equipos) expect(e.advertencias).toContain('posible_duplicado');
  });

  it('REGRESION: marca los nombres que puso la camara o WhatsApp', () => {
    // Aparecieron en la carpeta real entre los nombres buenos. Importarlos
    // crearia equipos llamados "IMG-20251212-WA0031", que despues nadie
    // encuentra buscando.
    for (const n of ['IMG-20251212-WA0031', 'WhatsApp Image 2026-01-02 at 08.28.45', 'DSC 0042']) {
      const { equipos } = detectarEquipos([ruta(`Caldera/${n}.jpg`)]);
      expect(equipos[0].advertencias).toContain('nombre_automatico');
    }
  });

  it('un nombre puesto por una persona no se marca', () => {
    const { equipos } = detectarEquipos([ruta('Caldera/Ablandador de agua.jpg')]);
    expect(equipos[0].advertencias).toEqual([]);
  });

  it('un nombre unico no se marca como duplicado', () => {
    const { equipos } = detectarEquipos([
      ruta('Caldera/Ablandador de agua.jpg'),
      ruta('Caldera/Caudalimetro caldera 1.jpg'),
    ]);
    expect(equipos.every((e) => !e.advertencias.includes('posible_duplicado'))).toBe(true);
  });

  it('REGRESION: el mismo nombre en sectores distintos NO es duplicado', () => {
    // "Tablero 1" en Caldera y "Tablero 1" en Tinas son dos tableros reales.
    const { equipos } = detectarEquipos([
      ruta('Caldera/Tablero 1.jpg'),
      ruta('Tinas/Tablero 1.jpg'),
    ]);
    for (const e of equipos) expect(e.advertencias).not.toContain('posible_duplicado');
  });

  it('no descarta nada por si solo: solo advierte', () => {
    // Quien importa decide. Descartar en silencio dejaria equipos afuera sin
    // que nadie se entere.
    const { equipos } = detectarEquipos([ruta('Caldera/Router caldera 1.jpg')]);
    expect(equipos).toHaveLength(1);
  });
});

describe('las carpetas excluidas por defecto', () => {
  it('son taller y manuales', () => {
    expect(CARPETAS_EXCLUIDAS_POR_DEFECTO).toEqual(['taller', 'manuales']);
  });

  it('la comparacion no distingue mayusculas', () => {
    const { equipos } = detectarEquipos([ruta('TALLER/Amoladora.jpg'), ruta('Manuales/x.jpg')]);
    expect(equipos).toHaveLength(0);
  });
});
