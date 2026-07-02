/**
 * Importación masiva de materiales (solo nombre).
 * Se asignan a la categoría "Sin categoría" con unidad vacía; la unidad y la
 * categoría real se cargan después editando cada material.
 *
 * Ejecutar:  npx ts-node prisma/importar-materiales.ts
 * Es idempotente: no vuelve a insertar los que ya existan con ese nombre.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOMBRES = `
ANGULO INOX. 31 x 3 mm
CINTA PTFE EXPANDIDOO AUTOADHESIVO 25 mm x 6 mm x 5 mts - $/m (J01-9PT2011754M)
Controlador de Tº Full Gauge NtC/Pt100 MT543 Ri Plus 24Vca
Interruptor termomagnetico tetrapolar Linea MDWP-C63
LEDBULB 10W E27 6400K 230V A60 840LM 160º DAP220010
T543E PLUS VER.05 115/230VAC FULLGAUGE - CONTROL. DE 4 RELE C/BUZZER
GUIA APM PERIMETRAL PARA PLACA DE PRENSADO – CANTIDAD: PERIMETRO COMPLETO DE DRENOPRENSA SEMI - AUTOMATICA STANDARD MODELO MDS 5.000 FM
3029 02 - GENEBRE Esferica paso total - 1/4" Bronce
500050 - Lubricantes - Multiuso PTFE 288g (wd40)
6580-8 - Fitting rápido Union TT - tubo 08
75590 - Cuchilla
abrazadera 26-32
ABRAZADERA 32-50 MM
ABRAZADERA 40-60
abrazadera 56-64
abrazadera acero perfecto 26-32
abrazadera banda 12.7 57 a 76mm
ABRAZADERA SUPER PRESION  SP-110-118
ABRAZADERA SUPER PRESION  SP-62-70
acc. arandela bombe chapa 1/4v26
acc. arandela neoprene 1/4v26
ACCE P/SOLDAR-C.C CODO 90º R.L.S 1.1/2"
ACCE P/SOLDAR-C.C CODO 90º R.L.S 3"
ACCE P/SOLDAR-C.C CODO 90º R.L.S 3/4"
aceite extra vida xv300x20lts
aceite hidraulico BP68 B20lts
ACOPLE RAPIDO RECTO ROSCA 3/8" TUBO Ø12 MM
acrílicos para plafones
agropol
Alicate Corte Diagonal 6 1/2  Crossmaster
angulo 1/8x1"
Angulo ACX 1x1/8 (25.4x3.17 mm)
angulo de 1/4x2" acx
Anillo de Seguridad 471-16A
anillos 40fort (compresor)
ANTEOJOS DELTAPLUS BRAV2FU TRANSP.ANTIRRAYA
Anteojos Deltaplus Kilimgrim Transp. Antirraya
ARAND.PLANAS ZN X Kg. 3/16
ARANDELA ACX GROWER 5/16
Arandela acx plana 3/8
ARANDELA ACX PLANA 5/16
Arandela Grower 3/8
ARANDELA GROWER ACERO INOX. 1/2"
ARANDELA GROWER ACERO INOX. 1/4"
ARANDELA GROWER ACERO INOX. 5/16"
arandela plana 3/8
ARANDELA PLANA ACERO INOX. 1/2"
ARANDELA PLANA ACERO INOX. 5/16"
Arandela plana ZN x Kg 1/4
Arandelas 1/2
arandelas acx 1/4 plana
arandelas planas zincada 3/16
arandella plana acero inox. 1/4"
arena fina x bolsa
ARENA GRUEZA X METRO
ARENA GRUEZA X METRO en bolson
arena x bolsa
arena x metro
aros 4 3/4" 80 max/40fort (compresor)
Autoperforante madera negros 6x1 5/8
B.MOD MODELO GP-50 DE ANCHO 400MM Y D:3000MM
BANDA DE TRACCION 1704MM X 60MM UNION
banda y piñon
bandeja de pintor grande
Bandeja perf. 3M x 100mm  0.7mm
bandeja perforada 3M de 50mm
BANDEJA PORTA CABLE 25 MM
Bandeja portacable ACX 50mm x 3 mts.
BANDEJA RECOLECTORA DE SUERO
bastidor
BATEA PARA AMASADORA DISCONTINUA A VAPOR DIRECTO MODELO MJV 430.
bateria
Batería 12V 7A
bateria 9V tester
BG-1705USPower 51111
biela maestra 40fort/60max (compresor)
Bisagra camara superp chica c/rampa
Bisagra camara superp chica c/rampa Der
bisagra con municion 4"x3"
bisagra p/soldar 100x33
Bisagras 40-64 (3000-5)
block 13x19x39
bobina 4808-220v
bobina solenoid G73 Camozzi 24v dc
BOLSA CEMENTO X 25 KG
bolsa de cemento
Bomba 1405
bomba 3hp-380v ricota
BOMBA CENTRIFUGA INOXIDABLE SANITARIA. Código 340 - Modelo SAN-C4-DDR-A150-63x51-N
bomba Z2 czerweny 220v
Boquillas 75 mm Fusion Herram. Acc
BOTONERA DOBLE RASANTE DIAMETRO 22.5MM
BOTONERA GOLPE DE PUÑO Ø 40MM CON 1 MICRO NC
Brida roscada con agujero
Brida SORF A 105 S-150 1 Pulgada
Brida SORF A 105 S-150 3 Pulgada
buje reduccion 3/4 a 1/2
BUJE REDUCCION BRONCE 1/2 A 3/8 "
BUJE REDUCCION DE  3/4 a 1/2
BULON ACX 5/16" X 1 1/4"
Bulon acx cab. hexagonal 1/4 x 1 1/2
BULON CAB. EXAG. 1/4" X 1 1/2" ACERO INOX
bulon cab. exag. 5/16x2
BULON CABEZA EXAGONAL 5/16" X 1 1/2" ACERO INOX.
BULON CABEZA EXAGONAL ACERO INOX 1/2" X 1 1/2"
Bulon G5 USS 1/4 x 1
Bulon G5 USS 3/8 x 1 1/2
Bulon G5 USS 3/8 x 2
BURLETE ENVASADORA 7 MM
burlete envasadora 8mm
C 21,0 32,18 32,18 able de conexión con conector hembra 5m MPPE M12 acodado IFM
cabezal compresor schultz 10hp
Cabezal Compresor Schulz 10 Hp MSW-40FORT
Cabezal inferior de encintadora reparado
Cabezal superior de encintadora reparado
cable 1x1 unipolar
CABLE ACONDICIONAMIENTO REPL - 175067
cable canal de 10x20
Cable canal ranurado 40 x 40
cable de conexión con conector hembra 5m MPPE M12 acodado IFM
cable TPR 2x1mm
CABLE TPR 3 X1.5 MM
cable TPR 3x4mm
CABLE TPR 4X 2.50 MM
CADENA A RODILLO 3/8 X 450MM C UNION
CAJA 147X182X109 TAPA TRANSP.
caja de conexion de 115x165x65
caja de derivacion de 9x9x5
CAJA DE HERRAMIENTAS PLASTICA
caja de inspeccion chica para jabalina 15x15
CAJA ESTANCA 1 PERF.22MM.GRIS
caja estanca plástica 115x115x65
CAJA ESTANCA PLASTICA 165X210X80 BLANCA IP65
caja rect 10x5 p/ bastidor universal
cajas de derivacion 115x115x65mm
CALOVENTOR 0/2000W FX-810 "EVEREST"
Canal de tension 5T con Termica
CANALETA DESAGUE GALVANIZADA.
Caño acx (25,4 x 1,5) - 1x1,5mm
caño acx 60x60mm
CAÑO ESTRUCTURAL    30X30X1,6 MM X 6 MTS
CAÑO ESTRUCTURAL  50X50X1,6 MM X  6MT
CAÑO GALVANIZADO 1.1/2"
caño galvanizado 1/2
CAÑO GALVANIZADO 2"
CAÑO NEGRO ASTM SCH-40 1"
CAÑO NEGRO ASTM SCH-40 1.1/2"
CAÑO NEGRO ASTM SCH-40 3/4"
Cano negro de 3" bomba cloacal x 940 cm
Caño PN10 75 mm x 4 m FF IPS
caño PVC 20mm
caños de 7/8 de PVC
CAPACITOR 2,5 MICROFARADIO X 400VCA
capacitor de 16uf x 400v
capillo de acero con mango
Carcaza Caracol
CARCAZA FILTRO BIG BLUE
CARGA GAS ARCAL(ARGON)
CARTUCHO FILTRANTE LMBBB. 20.010.
CB-51112-CBR (crapodina)
CB-6002 2RS C3-NTN-T (RODAMIENTO)
cemento
cemento x25kg
Centrifugo RB 200 T 0.33/4 SASE DM4
CEPILLO ACERO AMOLADORA
cepillo acero amoladora 115
cepillo acero manual
CH SIN CINC 0.5 X 2000
CH SIN CINC 0.5 X 3000
CH SIN CINC 0.5 X 4000
CH SIN CINC 0.5 X 5000
CH SIN CINC 0.5 X 5500
Chapa Cinc N°25 0.5 mm x6500 Largo
Chapa Cinc N°25 0.5 mm x7000 Largo
Chapa Cinc N°25 0.5mm x10000 Largo
Chapa Gris N° 25 (0.5 mm) Largo 1500
chaveta espina elastica (mulas)
Chaveta Partida 5.00x60
Chaveta Partida 7.00x80
chavetas partidas de 4,5mm X 40mm
cigueñal 15hp 5cil (compresor)
CILINDRO NEUMATICO JORVIC DIAMETRO 141.3 MM       1132 RECORRIDO
Cinta - AISI 302 - 109x71x22xØ3
cinta aisl vinilo x20 super 33+
CINTA AISLADORA
cinta autosoldable
Cinta de Teflon 3/4 x 10
cinta metrica de 5Mts
cinta pasacable con alma de acero x 10 metros
Cinturon Porta Herramientas Total
clavos punta paris  1 1/2
cobertura pesada 1.50 ancho (lona para zorras)
Codo 2" HH 90 Galvanizado
Codo 2" HM 90 Galvanizado
codo H.H 90° 1/2
codos de PVC de 20mm
COLA LARGA TORCHA WP
CONECTOR RAPIDO NEUMATICO TUBO Ø 6MM
CONECTOR RAPIDO NEUMATICO TUBO Ø 8 MM a Ø 6 MM
CONECTOR RECTO M-M 1/8" BRONCE
conector tripolar 8w ip65
Conek Union Reductora Tubo 8 - Tubo 6
CONTACTOR 3P 12A 1NA+1NC 220VCA 50/60HZ
CONTACTOR 3P 12A 1NA+1NC 24VCA 50/60HZ
CONTACTOR 3P-18A-220VCA
CONTACTOR 3P-18A-24VCA
contactor 9A bob 220v
contactor 9A bob 380v
contactor sch 18A bob 220v
CONTROL DE CAUDAL EX8606
CONTROLADOR DE TEMP. MT 543RIL PLUS/04
CONTROLADOR DE TEMP. MT53RI PLUS 24VCA
controlador de temp. ntc/PT100 220v
controlador de temperatura 24v
Corona MX2.90 Z29 SF47
Corona SA37 i=13.5
cortadora de caños import 1/8 a 1 y 1/8
Corte Chapa acx con material (Fleje drenoprensa)
corte chapa acx p/filtro turbina regenerativa
CORTE LASER
crapodina 51111
crapodina 51112
crapodina 51205
CROS Tubo Hex (E 1/4) 8 mm
Cros- Llave Ajustable 12"
Cros-Crique (E3/8) x215 mm Curva
cupla 1/2
cupla 32"
CUPLA ACERO INOX 1/2"
CUPLA ACERO INOX 1/4"
Cupla de 32X1" fusion rosca hembra
curva acx pulida exterior 90° (25,4) - 1
Curva de cobre 90º 1/2 pulg
Curva de cobre 90º 5/8 pulg
Curva de cobre 90º 7/8 pulg
curva plana perf. smarttray a 90° de 50 mm
D.TYROLIT SECUR C.D.114X4.8
Danfoss Tobera N°4 (1.5 T- R12 2.3-R22)
Danfoss valv term tex2 h4.5t R22 C/C
DBH-1176 reten DBH 0x52x7 tipo A378
DBH-9308 Reten DBH 30 X 60 X 7 Tipo: L
DBH-9454-Reten DBH 45 X 75 X 8 Tipo: Lx
DECAPAX 33 (GEL DEC.) x 1.25 KG (Pote) (DU0033-1.25)
DESTORNILLADOR PHILLIPS 5 X150 MM
DESTORNILLADOR PLANO 5 X 150 MM
diafragma valvula AA // MY25
DICROICA LED  6W 12VCA
Diferencia por carga de precio en dolares
diodo alternador
DISCO CORTE 125 X 1,2 METAL
disco corte sinpar recto 115x1.2x22.2
Disco de corte 125 x 1,2
Disco de Corte 180 mm DA1816
disco de desbaste 115mm
DISCO DIAMANTADO SEGMENTADO 115 MM
disco flap rottweiler oxido aluminio 115 G80
disco flap tyrolit 115mm
disco para madera dw115
DISCO REFORZADO DE GOMA ROTULAR  (D 100 )
Disco SSD 256GB para notebook
Disco Tyrolit Flap Basic 115 G80
discos de corte amoladora 125mm
Disyuntor 25 amperes
disyuntor 4x63A
DOGO-VARILLA A/INOX.ER308L 1.60 X 1MT
E-6/4 - NTH Tubo poliuretano - ØExt 06 x ØInt 4
E-8/5.5 - NTH Tubo poliuretano - ØExt 08 x ØInt 5.5
eje aisi antiespuma 3hp/3hp
Eje hueco KA37/FA37/SA47 D30
Elect. Centrif. Inox BBO 100 M
ELECT. GOLD PLUS Ø 1,6 X 175MM (tungsteno)
electro bomba dosivac (clorinador)
ELECTRO VALVULA JEFERSONN 3/4 " PARA VAPOR
ELECTRO VALVULA P/ VAPOR JEFF. 3/4"
ELECTRODO 2.5 MM
Electrodo 3.25 (hierro negro)
ELECTRODO CONARCO 13 A - 2.50
ELECTRODO IND 90 2.4 (X 5KG)
ELECTRODOS 2,5mm (hierro negro)
ELECTRODOS ACERO
ELECTROVALVULA 150870A Burkert 5282 R 1/2" / DAM1010 / 40870 / DAM0220 - ID134430 CC
Electrovalvula 150870A Burket 5282 R 1/2" / DAM1010 / 40870 /DAM0220 - ID134430 CC
electrovalvula 4010- 1 1/2"
electroválvula camozzi 358-015-02
Electrovalvula Camozzi s - 3/4 - 1 Sol. Retorno - 3/2 NC - 1/8
ELECTROVALVULA DE ACLARADO 150883A/40882/120883/70868B/DAM0227/GVP0226/GVP1026 Burkert 6281 R 1/2" - ID221844 CC
ELECTROVALVULA DE ACLARADO 150883A/40882/120883/70868B/DAM1018/DAM0227/ Burkert 6281 R 1/2" - ID221844 CC
ELECTROVALVULA JEFFERSON 3/4" PARA VAPOR 2036BT06 24vca
ELECTROVALVULA VUVG-L18-  B52-G14-1P3
ELECTTRO VALVULA JEFFERSON 1342-3/4"-2/2 NORMAL CERRADA 24 vca
empaque carter 40/60/72 (compresor)
Equipo electrobomba sumergible cloacal inoxidable WQ-2,2B 3HP 380V BO
Equipo electrobomba sumergible de drenaje plastica DSP 750PD 1HP 220V
esmalte sintetico blanco brillante x 1lts
Esparragos ASTM A194-37 c/2 TCAS 2h 1/2x100
Esparragos ASTM A194-37 c/2 TCAS 2h 5/8x100
espatula de 7cm
espatula pintor laminada 80mm
espinas elasticas 5 x 40
Espuma Fischer PU 1/175
ESTRUCTURAL INOX.   40X 40 X 1,5 MM
Exhibidor para cajas plásticas. Medidas: 1.80 m de alto x 1.10 m de ancho sin gavetas
Extensor WiFi Tplink
extractor de chavetas esp.elast.
FC Cupla HH 75 mm F-F IPS
FCU Codo 90° HH 75 mm F-F IPS
ferrite
Ficha Electrovalvula Camozzi - mediana
FICHA HEMBRA BIUSO BLANCA KH
ficha hembra de 10A
FICHA MACHO 3 PERNOS CHATOS BLANCA K3
FICHA P/CIRC. IMP. HEMBRA PF2
fichas macho 10A
FIJADOR X 20 LTS (SELLADOR FIJADOR)
FILTRO ACEITE
FILTRO ACEITE 004125/l
FILTRO ACEITE ML-5513520
FILTRO AIRE SEGURIDAD V-725/S (CF 800)
FILTRO AIRE SEGURIDAD VP-2778/S
FILTRO AIRE V-725  (c-17225/3)
FILTRO AIRE VP-2778 (P781039)
FILTRO COMBUSTIBLE    004060/l
FILTRO COMBUSTIBLE ML551423G
FILTRO DE ACEITE ENVASADORA(PH09)
FILTRO DE AIRE LATERAL -HITACHI UX
filtro de aire MR126
FILTRO DE AIRE POSTERIOR
FILTRO DE RETORNO DE GUTTER-SOLVENTE (MINI FILTER PARTS) CON SOPORTE
FILTRO DE RETORNO DEL GUTTER
FILTRO DE TINTA PRINCIPAL RX / RX2 / UX (FILTER CAPSULE PARTS)
FILTRO PRE CAÑON DE TINTA
FILTRO PRE VMS/CIRCULACION DE SOLVENTE
filtro regulador 1/2"alt
FILTRO REGULADOR DE AIRE CAMOZZI MC202-D00 FRL
FILTRO Y PARA VAPOR Ø 3/4" INOX
final de carrera FKP-1002
final de carrera. microinterruptor serie Z ACC INDIRECTO C/EJE Y RODILLO
Fiting Rapido Recto TR Spring - Tubo 6 Rosca 1/4
Fiting Rapido Recto TR Spring - Tubo 8 Rosca 1/4
Fiting Rapido T - Tubo 6
Fiting Rapido T - Tubo 8
fitting rapido union tt-tubo 08
flete
Flete de envio
Flete Sunchales a Deposito
flotante (control de nivel)
FORZADOR 500 mm MONOFÁSICO SOPLANTE
FORZADOR DE 500MM MONOFÁSICO ASPIRANTE
FORZADOR ROT EXTERNO 400 BLUESTAR
FOTOCELULA BRAMA FC8
FOTOCONTROL PARA ILUMINACION
FUELLE TINAS JORVIC BC 4048 B
FUNDA RULEMAN SUPERIOR DESNATADORA 2191
fusibles 1A
gabinete ip65 376x455x200
gancho techo solo 6x50
gancho techo solo 6x60
GARRAFA R22 X 13.6 KG NECTON/FREON
GARRAFA R22 X 13.6 KG.
Garrafa R22 x 13kg necton/freon
garrafa R410 x 650 G LATA
gas flamal O2 smartop mt
Gases ARCAL x 2 metros
Gases Nitrogeno N4
GASOIL
GDO CODOS M.H 90° 1 1/2"
GDO CODOS M.H 90° 2"
Genebre Purgador p/vapor BSP - Tipo Boya 1" 4.5 Bar
GENEBRE trampas termodinamicas 1" sin filtro
GENÉRICO FLETES Y ACARREOS
GLC Bandeja fina liviana 2U x400m
GLC organizador de cable 1U con tapa
GLC organizador de cable 2U con tapa
GOMA P/MANGUERA CARGA REFRIG
Goma Silicona 15 mm x 21 mm
GRAMPA RAPIDA RIGIDA 3/4" (20MM) IP40
grampas
Grasa grado alimenticio SKF LGFG 2/1
GUANTE TACTIL - POLI 21-103 TALLE 08
GUANTE TACTIL - POLI 21-103 TALLE 10
GUANTE TACTIL PU T9
GUANTE TEJIDO PU DPS ESPUMADO NEGRO T8
guantes de trabajo
Guantes DPS n° 9
guantes tactil talle 08
guantes tactil talle 09
guantes tactil talle 10
guardamotor 1-1,6A
guarnición de nylon (higienizadora)
GUARNICION NYLON 60307 (REDA)
GUARNICION TOROIDAL 60306 (REDA)
hercal
hierro de 4,2
hierro de 8mm
hierro del 10
hierro del 8
HORQUILLA VIBRANTE SALIDA PNP (VEGA)
Instant On AP 22 R4W02A
interruptor final de carrera
interruptor flotante
jabalina acero/cobre 1/2"x1,5m
jabalina acero/cobre 1/2"x1.5"  IRAM 2369 (L14)
JACK RJ45 CAT6 GLC
jefferson electrovalvula 2036-3/4-2/2 normal cerrad. p/vapor
JUEGO PUNTAS P/TESTER AISLADAS REFORZADAS
JUNTA 60314 (REDA)
JUNTA 60316 (REDA)
JUNTA 60329 (REDA)
JUNTA 60331(REDA)
JUNTA 61013 (REDA)
JUNTA 61032 (REDA)
JUNTA 61033 (REDA)
JUNTA 61035
Junta de expansion metalica fuelle inoxidable
JUNTA DESNATADORA 11426
JUNTA DESNATADORA 11598
junta epoxi
JUNTA MAS P/2"
junta msw 40 fort (compresor)
JUNTA P/VALVULA ACRILO NITRILO (38,1) - 1 1/2
JUNTA P/VALVULA ACRILO NITRILO (50,8) - 2
JUNTA P/VALVULA MECANIZADA 38 SILICONA D
Junta P7Valvula Acrilo Nitrilo (38.1) - 1 1/2
Junta tapa elíptica (silos)
Junta Troquelada TEADIT NA-1002 S150 1 Pulgada x 20 cm
Junta Troquelada TEADIT NA-1002 S150 3 pulgadas x 20 cm
JUNTA U/D DANESA Ø 51MM
JUNTA U/D DANESA Ø 63 MM
JUNTA VALV. MARIP MEC. SILICONA 2 "
juntamas pp multiuso para agua 1/2"
kit resortes valv 40foret (compresor)
KITS DE JUNTAS PISTON TECHO Ø 141.3 JORVIC
KITS JUNTAS PISTON TRABAS Ø 60.3 MM JORVIC
KOT-A01A 030N ANILLOS DE SEGURIDAD DIN 471 30 A
ladrillo block de 20
ladrillo de 13
ladrillo portante de 18
LAPIZ CARPINTERO
Lapiz Carpintero Harden Neg
LAPIZ CARPINTERO profesional
lija medera norton G 120-A257 80033
LIMITE DE CARRERA NEUMANN MOD:FKP 1001 + 1000
LLAVE AJUSTABLE 6" (PULSIANA)
llave combinada 14mm
lubricante multiuso
LYP-7204 BEP-SKF-RODAMIENTOS SKF - APLICACION GENERAL
Malla Sima r 131 5x15x25x24x6m
manguera cristal 12x16
MANGUERA NEGRA DE  POLIETILENO
Manguito de desgaste inox
Manifold importado multigases
Manija exterior
Manija Picaporte Blanca
Mano de obra
Manometro Beyca diam 40 14kg
Manometro Beyca diam 63 14kg
MANOMETRO MM40-35-10BEYCA
mecanizado y material
MECHA ACERO RAPIDO 4.5 MM
MECHA ACERO RAPIDO 7 MM
Mecha diámetro 13 mm
MECHA EZETA AR CIL.4MM
MECHA EZETA AR CIL.5MM
MECHA EZETA AR CIL.6MM
MECHA EZETA AR CIL.7MM
MECHA EZETA AR CIL.8MM
Mecha HSS Revestida 13.00 mm
Mecha HSS Revestida 3.50 mm
Mecha HSS Revestida 4.00 mm
Mecha HSS Revestida 6.00 mm
Mecha HSS Revestida 6.50 mm
Mecha HSS Revestida 7.50 mm
Mecha HSS Revestida 8.00 mm
mecha widia 10mm
mecha widia 6mm
mecha widia 8mm
Mecha Widia N° 10
Mecha Widia N° 6
media caña de tergopol 2"x 38mm de espesor, densidad 20kg
MEDIA UNION CADENA 3/8
Medio niple acx (19,8) - 3/4 procesado
Medio Niple ACX 50.8 - 2 Procesado
medio niple de 1 1/4"
medio niple de 2"
mensulas p/bandeja de 150mm
mensulas p/bandejas de 50mm
METRO CAÑO RIGIDO 3/4" (20MM) (DOBLADO EN FRIO)
METRO HELICOIDAL 1" NEGRA Ø 24MM
METRO HELICOIDAL 1/2" NEGRA Ø 12MM
MICRO CONTACTO 1NA (VERDE)
MICRO CONTACTO 1NC (ROJO)
micro switch
MICROSWITCH TS 064  9.5 MM
mini rodillo con funda n11
mini rodillo de 8cm
mini rodillo forrado de 8cm
modulo ciego
modulo con paleta GP-50
modulo toma 10A
MONITOR PHILIPS 19
mordaza para jabalina
MORDAZA PARA JABALINA 1/2" (T2) NORMALIZADO
MOTOREDUCTOR ROLO DELANTERO COD: SAF77DRS90M4BE2HF
MS 04-2RS
MS02-2RS rod 6202
MS03-2RS rod 6203
MT SPAGUETI TERMOCONTRAIBLE 3 MM
MT SPAGUETI TERMOCONTRAIBLE 6 MM
N1040i USB RE (novus)
Niple acx (19,1) - 3/4 procesado
Niple ACX 76.2 - 3 x 65 Imp Procesado
NIPLE INOX Ø 3/4 X 60 MM
Niple Rosca 1 1/2 Galvanizado
Niple Rosca 2" Galvanizado
NTH Tubo de poliuretano Øext 06 x Øint 04
NTH Tubo de poliuretano Øext 08 Øint 5.5
O'RING 60308 (REDA)
O'RING 60317 (REDA)
o'ring 60322
O'RING 60322 (REDA)
o'ring 60324
O'RING 60324 (REDA)
oring 60322
oring 60324
Patch Cord CAT6 1,5MTS
Patch Cord CAT6 1MTS
Patch panel 48Port CAT6 P KRONE/110
PC TRENDIT INTEL CORE I3 12100 8GB 240SSD
pegamento para porcelanato
PEGAMENTO PORCELANATO HOLCIM
Pendrive
Perfil C Galvanizado 2x100x40x15x12000
Perfil C Galvanizado 2x120x50x15x12000
perilla de potenciometro
PESTAÑA DE VALVULA EXPANCION COBRE
PICAPORTE SELFIX M2 BLANCO ECON 101BL 430078
piedra en bolson x metro
piedra x bolsa
piedra x metro
pincel #10
pincel #15
pincel #20
pincel silver n15
Piñón MN1.00 Z22 L16 D10
PIÑON RDZ. 10
PINZA DE FUERZA AJUSTABLE INGCO CR-V
PINZA DE FUERZA INGCO
Pinza Impacto Proskit Cp-3141
Pinza pelacables automatico
Pista ceramica 30.6 x 17.8 x 6.2 r2,25
placas de durlock de 15mm
Planchuela ACX 19.1 x 3.2 - 3/4 x 1/8 H
Planchuela ACX 25 X 3 mmm x 6 mts
planchuela de acero 1"x3mm
PLEGADOS INOX. PUERTAS CALORIFICO
PM1605 - Sensor de presión con membrana aflorante
poliuretano de 500ml
POLIURETANO EXPANDIBLE AEROSOL 750 CM3
portabastidor exterior
portaelectrodo tig de 2,4
poximix interior/exterior 500g ST00126
PP 175 x 50
PP|200X50 C/A (ruedas)
Precinto 4.8 x 300 mm
PRECINTOS ALT 1(100MM X 2.5MM)
precintos de 4,7x300mm
prensacable plast 1 1/4
PRENSACABLE PVC.PG-13.5 Ø 6-12MM 7/8
PRENSACABLES PVC PG11
presostato danfoss RT116 1-10AT
PROYECTOR LED SMD 100W
PULMON NEUMATICO ST866 (SUSPENTECH)
PULSADOR DOBLE VERDE/ROJO PLASTICO
PUNTA PH2 X 50Mm MLK
punta philips para taladro
punzon recto de 5mm
Rack
Racor a soldar para sensores de proceso G1 316L IFM
reductor de tornillo sinfin SAF77 AD2
REJILLA SALIDA MECAN. 125X125MM
REL-2V-NFI (RELEE)
rele term 12-18A
rele termico sch 9-13A
rele termico siemens sirius 3R 7-10A
REMACHE
REMACHE 4 X 16
REMACHE 5 X 20
REMACHE 6 X 16
remaches pop 4,8x12mm
reparacion de barrales
REPARACION INTEGRAL
repuesto de rodillo grande
REPUESTO TRINCHETA (CUCHILLA)
RESISTENCIA PARA QUEMADORES A BIOMASA
resistencias
resorte de campana
RETEN 5414
RETEN 5425
reten 5427 (35x47x7)
Reten 7212
reten 9118
reten 9118 (30x47x7)
Reten DBH 35 X 62 X 7 Tipo: Lx (8194)
reten de grasa-lz-tapa
RI-6206-2RSR   -C3-FAG RODAM RIGIDOS DE BOLA
riel din 1m
Robinete tuerca loca 1 1/4 x 3/4FM
Robinete tuerca loca 1 1/4 x 5/8F
Rod. axial de bolas 25x47x15
rodamiento 6001
rodamiento 6002
rodamiento 6007
Rodamiento 6204
rodamiento 6204 SKF
rodamiento 6205
rodamiento 6206
rodamiento 6304
rodamiento 6305
RODAMIENTO 6305 2RS
Rodamiento 6308 2RS
RODAMIENTO 6908 2RS
RODAMIENTO 6908 2RS (desmigador)
Rodamiento a bolas blindado SKF 6302 (15x42x13)
RODAMIENTO AXIAL (CRAPODINA) 51112
Rodamiento NTN 6202
Rodamiento Rigido a bolas 6908
Rodamiento Rigido Bolas 6007
Rodamiento Rigido Bolas 6304
RODAMIENTO SUC 206 ( D 30 )
Rodillo H.PU 80x70 mm Rul 4821 - 500 Kg
RODILLOS NYLON 70x80 (mula)
RODOM-2353 Oring ie Nitrilo Ø INT.126.37 Ø EXT 137.03 Cueria 5.3
Rofe motor c/rodamiento af 400
rollo de 50mm x 80 micrones x 10 mts con adhesivo siliconado
ROLLO POLIETILENO 2 K6
ROTOR DE CAUCHO  B-80
Rotuladora Brother PT-H110
RSF-6009 2RS C3-SKF- RODAMIENTOS A BOLAS RODAMIENTO A BOLAS 45X75X16 BLINDADO_
RSF-6206 2RS C3-SKF RODAMIENTOS A BOLAS RODAMIENTO A BOLAS 30x62x16 BLINDADO
Rueda 2 MN1.00 Z58 D16 A46
Rueda Canal H 80 mm Rul 5307 - 150 Kg
Rueda polipropileno 200x50 c/aloj.
S6510-6-1/4 - Fitting rápido Recto TR Sprint - tubo 06 - rosca 1/4
S6510-8-1/4 - Fitting rápido Recto TR Sprint - tubo 08 - rosca 1/4
selectora palanca 0-1
Sello (Tipo J) eje 20 mm
sello 10096
sello 10162
Sello 11002 (Tipo F) Luigi 2 Hp eje 16
SELLO 11096 EJE 25 (Czerweny)-empaquetadura/sello
Sello 11096 eje 25 Czereny
Sello BCS
Sello completo Meitar VIII eje 25
Sello Completo STD de 0.25 a 3 Hp para B.C.S.
sello mecánico AF X 25 (sello de estiercol.)
Sello Modelo 425 N° 2
sello slr2-lk.car.epdm-ce (b.lobular)
SELLO SUDAMERIS 425
Sello tipo beltrando eje 17 mm c/pista 31x18x6
sensor cilindro neumatico bag in box
sensor de nivel higienizadora
sensor PT100 c/vaina acero inox. 6.35x50 c/rosca 1/2" BSP y cabezal
Sensor Tº PT100 c/vaina acero inox. 6.35x50 c/rosca 1/2" BSP y cabezal
service
Service envasadoras
servicio tecnico
Servicio técnico y cambio de Válvula neumática
Servicios y/o reparaciones tercerizadas
sierra copa 65mm
sierra copa bimetal 27mm
sika 2-caja c/12 doy pack x1kg
silicona mapei neutra mapesil nm 280ml blanca
Silicona Multiprop Transparente x 280 gr
SILICONA MULTIPROPOSITO TRANSPARENTE
SKF 6001- 2RSH
Soldador 60 W Punta cerámica
SOLENOIDE CAMOSSI 24 VCA
solenoide Camozzi-solenoide 24DC
soporte de rodillo
soporte mensula 130mm #18
Switch Aruba 1930 40G 4SFP+POE 379W JL686A
switch-SG108M gigabit 8p
TAPA DEFLECTORA P/MOTOR C100 (CUBREVENTOLA)
Tapa Deflectora para motor C.90 sin grasera W22
TAPA PVC 160 MM
TAPA VALVLA 60325 (REDA)
tapa valvula 60325
tapa y rolado para bomba
Tapiz Barrera para Drenoprensa Semiautomatica Standard Modelo MDS 5.000 FM
Tapiz de Desuerado para Drenoprensa Semiautomatica Standard Modelo MDS 5.000 FM
TAPIZ P/BARRERA 1640X430-  ST4106-AMBAS CARAS CON RESINA- IK240
TAPIZ P/PRENSA 1625X8500- ST4106-AMBAS CARAS C/ RESINA-IK240
tarugo fischer sx 6
Tarugo Fisher SX 10
Tarugo Fisher SX 6
Tarugo Fisher SX 8
tarugo NY multiuso crecchio c/tope
Tarugo p/ ladrillo hueco N°10
Tarugo sx 10 fischer
TARUGOS 8MM
teflon 3/4 alta temperatura
TEFLON Ø 3/4 X 10 (KLOSS)
tela plastica (cinta moldeadora)
tela plastica dieseño DCFM con costura sin fin y bordes reforzados de medidas: 820x6039mm
TELA PLASTICA MOLD. DCFM C/COSTURA S/FIN D6019xA820 PARA CINTA DESUERADORA DE BLANDOS (no es medida original)
TERMINAL 1.5MM PLACA REDONDA 3MM
TERMINAL 1.5MM PLACA REDONDA 4MM.
TERMINAL 1.5MM PLACA REDONDA 5MM.
TERMINAL 1.5MM PLACA REDONDA 6MM
TERMINAL 2.6MM PLACA REDONDA 3MM
TERMINAL 2.6MM PLACA REDONDA 4MM
TERMINAL 2.6MM PLACA REDONDA 5MM
TERMINAL 2.6MM PLACA REDONDA 6MM
terminal 6.6mm pala H.cubierto c17 (envasadora)
TERMINAL 6.6MM PLACA REDONDA 3MM. C1
TERMINAL 6.6MM PLACA REDONDA 4MM.
TERMINAL 6.6MM PLACA REDONDA 5MM.
TERMINAL 6.6MM PLACA REDONDA 6M
TERMINAL 6.6MM PLACA REDONDA 8MM.
termofusora 800w
termomagnetica 3x10A
termomagnetica 4x25A
thinner standar x1lt PET
tiraf.acex 1/4 x 1
Tirafondo 1/4 x 2
Tirafondo 5/16 x 2 1/2" acx
tirafondo acx cab. hexag. 1/4x2"
Tirafondos 1/4 x 2 1/2
TIRAFONDOS ACX 1/4 X 31/2
tomacorriente capsulado con toma de 10A
Torn. Autop. met-t1 PH C/M 8 X 1/2
Tornillo ACX all c/fre
tornillo ACX cab. fres (6.4x25.4)-1/4x1
TORNILLO ALLEN CAB. FREZADA INOX 1/4" X 1 1/2"
TORNILLO ALLEN CABEZA FRESADA 1 1/4"  X  1 1/2"
Tornillo Autop MET -T Aguja 8 x 1/2
tornillo autop. madera 6 x 1 1/2
Tornillo Autoperforante -madera 6 x 1 5/8
Tornillo Autoperforante -madera 8 x 1 1/2
Tornillo Cabeza Tanque 5/16 x 1 1/2
Tornillo Cabeza Tanque 5/16 x 1/2
tornillo p/madera "fixer" dorado -6x120
tornillos autop 14x2 (chapa)
tornillos autop madera 6 x 1 1/2
Tornillos Cab frezada 1/4 x 1,5
tornillos con tuerca 1/4x1" acero
TORNILLOS DRYWALT 8X2
TOTAL -Multis 2 (4Kg) - ROLEXA
TRANSFORMADOR DE 380 V A 24 V (ALIMENTACION PLAQUETA ENVASADORAS)
TRASMISOR DE PRESION DE 0-10 BAR
Tubo ACX 40x40x1.5 mm
tubo acx 50x50x1.5mm cortado
TUBO EST. REDONDO 76.20 X 1.6 - 6 TRAMOS X 0.30MTS
TUBO ESTRUCTURAL 2 X 40 X 40
TUBO RECIBIDOR COMER 5.6 LT 1/2X1/2
tubos led
Tuerca 1/4
Tuerca 3/4
Tuerca 7/8
TUERCA ACERO INOX. 1/2"
TUERCA ACERO INOX. 5/16"
tuerca acx 1/4
TUERCA ACX 5/16"
Tuerca acx 5/8
Tuerca acx mariposa 1/4
Tuerca acx mariposa 3/8
Tuerca autofrenante ACX 3/16
TUERCA AUTOFRENANTE INOX 1/4"
TUERCA G.8 5 X 0.80
Tuerca G5 USS 1/4
TUERCA G5 USS 1/4"
tuerca uss zn. 1/4
Tuercas 1/2
tungsteno(electrodo gold plus 2,4x175mm)
tungsteno(electrodo gold plus 2,4x175mm) tig
TURBINA 4"220V RULEMAN 12X12X38C
turbina antiespuma 2hp/3hp
turbina fundición bba cloacal
Turbina fundicion bomba cloacal
TURCA ACERO INOX. 1/4"
tuvo tecalan 8mm
TV 32 SMART MOTOROLA HD ANDROID MT3200
UNA MANGA DE MALLA TELA SINTERIZADA 40 MIC Ø181X500 AISI 304L
Unifix RP 100 x 200 gr
UNION CADENA 3/8
Unión Doble 1 1/2 Galvanizado
Union Doble acx danesa (25,4) - 1
UNION DOBLE CONICA 3/4"INOX.
union doble conica de 1/2
union doble HH de 3/4
UPS 3KVA EATON 4IRAM + BORNERA
Valv. Camozzi Manual s/1-3-4 - tirador biest. 5/2 - 1/8
valv. Camozzi Manual s/1-3-4 -tirador biest. 5/2 - 1/8
Valvula ACX Esferica 2 Cuerpos Serie 150 (31.7) - 1 1/4
Valvula acx esferica 2 cuerpos serie 150 (6.35) - 1/4
Valvula ACX Esferica 3 Cuerpos Serie 150 (19.1) - 3/4
VALVULA ASIENTO INCLINADO 3/4" INOX
VALVULA CAMOSSI 3/2-NC-ROSCA 1/8"
VALVULA CAMOZZI MANUAL TIRADOR BIESTABLE 5/2 X 1/8"
Válvula de carga p/sold con chicote
VALVULA ESF. 3 CUERPOS 3/4"
VALVULA ESFERICA 3 CUERPOS 3/4"
valvula esferica de 2 cuerpos
VALVULA NAMUR SERIE 300 5/2
VALVULA REGULADORA SMC ITV2050-012L3 E/P 0-9 Kg/cm2 4-20Ma.
vantronic potenciometro standard 5K
varilla A/Inox (aporte)
Varilla de sold harris (plata)
VARILLA ROSC.MM 5 X 0.80
varilla roscada 1/4 inox
VARILLA ROSCADA 1/4" INOX
VARILLA ROSCADA 5/16" INOX
varilla roscada acx 3/8
Venda Tarlatana 0.10 x 100 m Largo
Ventilador plastico cuerpo 90 eje 24mm
VENTILADOR PLASTICO P/MOTOR W21-C100
Ventilador plastico para motor W21 C.80 y W22/IE3 C.80/90
Ventilador plástico para motor W21 C.90
VENTILADOR PLASTICO TIPO ACEC C.132 -239 * 40
vidrio de masc. soldar
VIDRIO TRANSPARENTE 4MM  0.94 x0.22 CM
VIDRIO TRANSPARENTE 4MM  0.96.5 x 023
VOLTEADOR DE MOLDE 120 QUESOS
WD40
WD40 155 Gr Aerosol
wd40 155gr aer
WD80
white comercial 440M 1/2 molecular
white filtro suc mot quem 7/8
Xv100 BALDE 20 LITROS
zolenoide de 3/4 24v
`;

async function main() {
  console.log('📦 Importando materiales...');

  const categoria = await prisma.categoriaMaterial.upsert({
    where: { nombre: 'Sin categoría' },
    update: {},
    create: { nombre: 'Sin categoría', descripcion: 'Materiales pendientes de clasificar' },
  });

  // Nombres únicos (trim, sin vacíos).
  const nombres = Array.from(
    new Set(
      NOMBRES.split('\n')
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    ),
  );

  // No reinsertar los que ya existan (idempotente).
  const yaExisten = new Set(
    (await prisma.material.findMany({ select: { nombre: true } })).map((m) => m.nombre),
  );
  const aInsertar = nombres.filter((n) => !yaExisten.has(n));

  if (aInsertar.length > 0) {
    await prisma.material.createMany({
      data: aInsertar.map((nombre) => ({
        nombre,
        categoriaId: categoria.id,
        unidad: '',
        stockActual: 0,
        stockMinimo: 0,
      })),
    });
  }

  console.log(`✅ Nombres en la lista: ${nombres.length}`);
  console.log(`✅ Insertados ahora: ${aInsertar.length} (ya existían: ${nombres.length - aInsertar.length})`);
  console.log(`✅ Total de materiales en la DB: ${await prisma.material.count()}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
