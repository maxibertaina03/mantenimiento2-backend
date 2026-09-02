-- Se saca la criticidad de los equipos.
--
-- Por qué: ALTA/MEDIA/BAJA es demasiado subjetivo. Si se le pregunta a dos
-- personas si un compresor es de criticidad alta o media, contestan distinto, y
-- un campo que cada uno completa con su criterio produce un dato que no sirve
-- para ordenar nada. En la práctica quedaban todos en el valor por defecto.
--
-- Al momento de escribir esto, los 326 equipos de producción tenían MEDIA: no
-- hay ni un valor cargado a mano, así que no se pierde ningún dato.
--
-- Si más adelante hace falta priorizar, la pregunta que sí tiene una respuesta
-- objetiva es "¿si este equipo se para, para la producción?", que es un
-- booleano y se agrega cuando la pantalla que lo use exista.

ALTER TABLE "equipos" DROP COLUMN IF EXISTS "criticidad";
