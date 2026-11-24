/**
 * Pantalla de Guía de Uso — Espacios CICTAT.
 *
 * Guía que explica:
 * - Propósito de los espacios del Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT) (Salas 1-6 y Cubículos 7-9).
 * - Perfiles de usuario y niveles de acceso.
 * - Flujo paso a paso para reservar un espacio.
 * - Trámite presencial: el formato impreso se debe llevar al encargado ya firmado por el usuario.
 * - Advertencias operativas y reglas en naranja/rojo (anticipación 24h, colisiones, limpieza +1h).
 * - Preguntas frecuentes y navegación rápida de regreso al catálogo.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

export default function GuiaScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Barra superior de navegación */}
        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver al catálogo"
            style={({ pressed }) => [
              styles.backButton,
              getTerracottaShadow({ border: 'structural', intensity: 0.8 }),
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={cictatColors.carbon} />
            <Text variant="labelLarge" style={styles.backButtonTexto}>
              Volver al Catálogo
            </Text>
          </Pressable>

          <View style={styles.badgeGuia}>
            <MaterialCommunityIcons name="book-open-outline" size={16} color={cictatColors.verde1} />
            <Text variant="labelSmall" style={styles.badgeGuiaTexto}>
              Guía de Uso de Espacios CICTAT
            </Text>
          </View>
        </View>

        {/* Encabezado principal */}
        <View style={styles.header}>
          <BrushTitle
            text="Guía de Uso de Espacios CICTAT"
            highlight="CICTAT"
            size={width >= 600 ? 'xl' : 'lg'}
          />
          <Text variant="bodyLarge" style={styles.subtitulo}>
            Aprende a navegar el catálogo digital, verificar disponibilidad en tiempo real, solicitar
            salas y cubículos de estudio, y tramitar tus formatos oficiales en el CICTAT · UJAT.
          </Text>
        </View>

        {/* 1. ¿Qué es Espacios CICTAT? */}
        <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: cictatColors.verde1Soft }]}>
              <MaterialCommunityIcons name="office-building" size={24} color={cictatColors.verde1} />
            </View>
            <View style={styles.cardTitulos}>
              <Text variant="titleMedium" style={styles.cardTitulo}>
                1. Espacios Gestionados en el CICTAT
              </Text>
              <Text variant="bodySmall" style={styles.cardSub}>
                Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT)
              </Text>
            </View>
          </View>

          <Text variant="bodyMedium" style={styles.parrafo}>
            Esta plataforma gestiona la infraestructura física del{' '}
            <Text style={styles.bold}>
              Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT)
            </Text>
            , adscrito a la UJAT. El sistema administra dos modalidades de espacios:
          </Text>

          <View style={styles.grid2Col}>
            <View style={styles.tipoEspacioCard}>
              <View style={styles.tipoEspacioHeader}>
                <MaterialCommunityIcons
                  name="presentation"
                  size={20}
                  color={cictatColors.verde1}
                />
                <Text variant="labelLarge" style={styles.tipoEspacioTitulo}>
                  Salas CICTAT (1 a 6)
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.tipoEspacioDesc}>
                Diseñadas para defensas de tesis, coloquios, exámenes profesionales, seminarios y reuniones de trabajo. Cuentan con proyector, conectividad y climatización.
              </Text>
            </View>

            <View style={styles.tipoEspacioCard}>
              <View style={styles.tipoEspacioHeader}>
                <MaterialCommunityIcons
                  name="school"
                  size={20}
                  color={cictatColors.verde2}
                />
                <Text variant="labelLarge" style={styles.tipoEspacioTitulo}>
                  Cubículos de Estudio (7 a 9)
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.tipoEspacioDesc}>
                Espacios colaborativos de trabajo para hasta 5 personas, de acceso exclusivo para estudiantes de posgrado e investigadores.
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Perfiles de Usuario y Niveles de Acceso */}
        <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#F4F4F5' }]}>
              <MaterialCommunityIcons name="account-group" size={24} color="#52525B" />
            </View>
            <View style={styles.cardTitulos}>
              <Text variant="titleMedium" style={styles.cardTitulo}>
                2. Perfiles y Niveles de Acceso
              </Text>
              <Text variant="bodySmall" style={styles.cardSub}>
                Requisitos según tu comunidad universitaria
              </Text>
            </View>
          </View>

          <View style={styles.listaPerfiles}>
            <View style={styles.perfilItem}>
              <View style={[styles.perfilBadge, { backgroundColor: cictatColors.verde1 }]}>
                <Text variant="labelSmall" style={styles.textoBlancoBold}>
                  ALUMNO DE POSGRADO
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.perfilDesc}>
                Ingreso con correo o matrícula institucional. Puede reservar Salas 1-6 y tiene acceso exclusivo a los <Text style={styles.bold}>Cubículos 7, 8 y 9</Text>.
              </Text>
            </View>

            <View style={styles.perfilItem}>
              <View style={[styles.perfilBadge, { backgroundColor: cictatColors.verde2 }]}>
                <Text variant="labelSmall" style={styles.textoBlancoBold}>
                  COMUNIDAD UJAT (DOCENTES / ALUMNOS)
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.perfilDesc}>
                Ingreso institucional con correo @ujat.mx o matrícula. Habilitado para consultar y solicitar las <Text style={styles.bold}>Salas 1 a 6</Text>.
              </Text>
            </View>

            <View style={styles.perfilItem}>
              <View style={[styles.perfilBadge, { backgroundColor: '#F4F4F5' }]}>
                <Text variant="labelSmall" style={styles.textoCarbonBold}>
                  PÚBLICO GENERAL / EXTERNO
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.perfilDesc}>
                Acceso rápido mediante nombre y correo de contacto sin contraseña institucional. Puede solicitar Salas para eventos académicos autorizados.
              </Text>
            </View>

            <View style={styles.perfilItem}>
              <View style={[styles.perfilBadge, { backgroundColor: cictatColors.carbon }]}>
                <Text variant="labelSmall" style={styles.textoBlancoBold}>
                  ADMINISTRADOR CICTAT
                </Text>
              </View>
              <Text variant="bodySmall" style={styles.perfilDesc}>
                Coordinación administrativa para dictaminar solicitudes, subir fotografías del espacio, gestionar mantenimiento y resolver colisiones horarias.
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Paso a Paso para Reservar un Espacio */}
        <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: cictatColors.verde1Soft }]}>
              <MaterialCommunityIcons name="format-list-numbered" size={24} color={cictatColors.verde1} />
            </View>
            <View style={styles.cardTitulos}>
              <Text variant="titleMedium" style={styles.cardTitulo}>
                3. Paso a Paso: ¿Cómo Reservar?
              </Text>
              <Text variant="bodySmall" style={styles.cardSub}>
                Procedimiento formal desde el catálogo hasta la entrega física
              </Text>
            </View>
          </View>

          <View style={styles.pasosContenedor}>
            <View style={styles.pasoFila}>
              <View style={styles.pasoNumero}>
                <Text variant="labelLarge" style={styles.pasoNumeroTexto}>1</Text>
              </View>
              <View style={styles.pasoTextos}>
                <Text variant="titleSmall" style={styles.pasoTitulo}>
                  Explora el Catálogo y Filtra
                </Text>
                <Text variant="bodySmall" style={styles.pasoDetalle}>
                  En la pantalla principal filtra por <Text style={styles.bold}>Todos</Text>,{' '}
                  <Text style={styles.bold}>Salas CICTAT</Text> o{' '}
                  <Text style={styles.bold}>Cubículos Posgrado</Text>. Revisa la capacidad, equipamiento y el estado operativo.
                </Text>
              </View>
            </View>

            <View style={styles.pasoFila}>
              <View style={styles.pasoNumero}>
                <Text variant="labelLarge" style={styles.pasoNumeroTexto}>2</Text>
              </View>
              <View style={styles.pasoTextos}>
                <Text variant="titleSmall" style={styles.pasoTitulo}>
                  Consulta la Matriz de Disponibilidad y Galería
                </Text>
                <Text variant="bodySmall" style={styles.pasoDetalle}>
                  Toca la sala deseada para ingresar a su detalle. Ahí podrás ver la galería de fotografías de la sala y visualizar los bloques horarios libres (08:00 a 15:00 hrs) para la fecha seleccionada.
                </Text>
              </View>
            </View>

            <View style={styles.pasoFila}>
              <View style={styles.pasoNumero}>
                <Text variant="labelLarge" style={styles.pasoNumeroTexto}>3</Text>
              </View>
              <View style={styles.pasoTextos}>
                <Text variant="titleSmall" style={styles.pasoTitulo}>
                  Llena los Datos del Evento
                </Text>
                <Text variant="bodySmall" style={styles.pasoDetalle}>
                  Elige la hora de inicio y fin. Escribe el tema del evento, describe el objetivo académico e indica el número estimado de asistentes y equipamiento requerido.
                </Text>
              </View>
            </View>

            <View style={styles.pasoFila}>
              <View style={styles.pasoNumero}>
                <Text variant="labelLarge" style={styles.pasoNumeroTexto}>4</Text>
              </View>
              <View style={styles.pasoTextos}>
                <Text variant="titleSmall" style={styles.pasoTitulo}>
                  Envía y Obtén tu Folio Único
                </Text>
                <Text variant="bodySmall" style={styles.pasoDetalle}>
                  Al confirmar la solicitud, el sistema genera de inmediato tu folio institucional de seguimiento (ej. <Text style={styles.bold}>CICTAT-XXXX</Text>).
                </Text>
              </View>
            </View>

            <View style={styles.pasoFila}>
              <View style={styles.pasoNumero}>
                <Text variant="labelLarge" style={styles.pasoNumeroTexto}>5</Text>
              </View>
              <View style={styles.pasoTextos}>
                <Text variant="titleSmall" style={styles.pasoTitulo}>
                  Descarga el Formato y Llévalo Firmado al Encargado
                </Text>
                <Text variant="bodySmall" style={styles.pasoDetalle}>
                  Desde <Text style={styles.bold}>Mis Solicitudes</Text> revisa el estado del dictamen. Cuando sea aprobada, genera e imprime el formato oficial en PDF. <Text style={styles.boldAviso}>El formato impreso se debe llevar al encargado ya firmado por el usuario</Text> al momento de acudir al CICTAT para la entrega formal de llaves y equipo.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. Normas Operativas y Advertencias Importantes (Naranja y Rojo) */}
        <View style={[styles.cardAlerta, getTerracottaShadow({ border: 'structural', intensity: 1.1 })]}>
          <View style={styles.alertaHeader}>
            <MaterialCommunityIcons name="alert-octagon" size={26} color={cictatColors.warning} />
            <View style={styles.cardTitulos}>
              <Text variant="titleMedium" style={styles.alertaTitulo}>
                4. Normas Operativas y Advertencias
              </Text>
              <Text variant="bodySmall" style={styles.alertaSub}>
                Lineamientos institucionales para la confirmación y uso de espacios
              </Text>
            </View>
          </View>

          <View style={styles.listaAdvertencias}>
            {/* Advertencia 1: 24 horas */}
            <View style={styles.avisoItem}>
              <View style={styles.avisoIconoWrapNaranja}>
                <MaterialCommunityIcons name="clock-alert-outline" size={20} color={cictatColors.warning} />
              </View>
              <View style={styles.avisoCuerpo}>
                <Text variant="labelLarge" style={styles.avisoTituloNaranja}>
                  Anticipación Mínima Obligatoria: 24 Horas
                </Text>
                <Text variant="bodySmall" style={styles.avisoTexto}>
                  Toda solicitud debe enviarse con al menos <Text style={styles.bold}>24 horas hábiles de anticipación</Text>. El sistema bloquea automáticamente solicitudes con menos tiempo para garantizar la preparación del espacio y logística del personal de apoyo.
                </Text>
              </View>
            </View>

            {/* Advertencia 2: Limpieza +1h */}
            <View style={styles.avisoItem}>
              <View style={styles.avisoIconoWrapNaranja}>
                <MaterialCommunityIcons name="broom" size={20} color={cictatColors.warning} />
              </View>
              <View style={styles.avisoCuerpo}>
                <Text variant="labelLarge" style={styles.avisoTituloNaranja}>
                  Bloqueo Preventivo de Limpieza (+1 Hora Posterior)
                </Text>
                <Text variant="bodySmall" style={styles.avisoTexto}>
                  Cada reserva bloquea automáticamente <Text style={styles.bold}>1 hora posterior</Text> para desinfección, ventilación y revisión técnica del mobiliario. No se autorizan eventos continuos sin este intervalo sanitario.
                </Text>
              </View>
            </View>

            {/* Advertencia 3: Horario operativo */}
            <View style={styles.avisoItem}>
              <View style={styles.avisoIconoWrapNaranja}>
                <MaterialCommunityIcons name="store-clock-outline" size={20} color={cictatColors.warning} />
              </View>
              <View style={styles.avisoCuerpo}>
                <Text variant="labelLarge" style={styles.avisoTituloNaranja}>
                  Ventana de Atención: 08:00 a 15:00 Horas
                </Text>
                <Text variant="bodySmall" style={styles.avisoTexto}>
                  El horario regular de operación de los espacios CICTAT comprende de las <Text style={styles.bold}>08:00 a las 15:00 hrs</Text> de lunes a viernes. Fuera de esta ventana, las instalaciones permanecen cerradas.
                </Text>
              </View>
            </View>

            {/* Advertencia 4: Rechazo por colisión (Rojo) */}
            <View style={[styles.avisoItem, styles.avisoItemRojo]}>
              <View style={styles.avisoIconoWrapRojo}>
                <MaterialCommunityIcons name="close-octagon" size={20} color={cictatColors.danger} />
              </View>
              <View style={styles.avisoCuerpo}>
                <Text variant="labelLarge" style={styles.avisoTituloRojo}>
                  Traslapes y Rechazo Automático por Colisión
                </Text>
                <Text variant="bodySmall" style={styles.avisoTextoRojo}>
                  Si existen dos o más solicitudes en un horario traslapado para el mismo espacio, al momento de dictaminarse una favorablemente, el sistema <Text style={styles.boldRojo}>rechazará automáticamente las demás solicitudes en colisión</Text>. En caso de rechazo, el logo y ficha del PDF se presentarán identificados en naranja.
                </Text>
              </View>
            </View>

            {/* Advertencia 5: Entrega del formato firmado (Rojo) */}
            <View style={[styles.avisoItem, styles.avisoItemRojo]}>
              <View style={styles.avisoIconoWrapRojo}>
                <MaterialCommunityIcons name="file-sign" size={20} color={cictatColors.danger} />
              </View>
              <View style={styles.avisoCuerpo}>
                <Text variant="labelLarge" style={styles.avisoTituloRojo}>
                  Entrega Física Obligatoria del Formato Firmado
                </Text>
                <Text variant="bodySmall" style={styles.avisoTextoRojo}>
                  Para el ingreso a la sala, <Text style={styles.boldRojo}>el formato impreso se debe llevar al encargado ya firmado por el usuario</Text>. El solicitante asume la responsabilidad del resguardo de proyectores, equipo de cómputo y mobiliario durante su evento.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Preguntas Frecuentes (FAQ) */}
        <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: '#F4F4F5' }]}>
              <MaterialCommunityIcons name="help-circle-outline" size={24} color="#52525B" />
            </View>
            <View style={styles.cardTitulos}>
              <Text variant="titleMedium" style={styles.cardTitulo}>
                5. Preguntas Frecuentes
              </Text>
              <Text variant="bodySmall" style={styles.cardSub}>
                Respuestas a dudas habituales
              </Text>
            </View>
          </View>

          <View style={styles.faqLista}>
            <View style={styles.faqItem}>
              <Text variant="labelLarge" style={styles.faqPregunta}>
                ¿Puedo reservar un cubículo si soy estudiante de licenciatura?
              </Text>
              <Text variant="bodySmall" style={styles.faqRespuesta}>
                No. Por lineamiento del Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT), los Cubículos 7, 8 y 9 están reservados exclusivamente para maestría, doctorado e investigación de posgrado. Los estudiantes de licenciatura pueden hacer uso de las Salas 1 a 6 para actividades académicas.
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.faqItem}>
              <Text variant="labelLarge" style={styles.faqPregunta}>
                ¿Cómo entrego el formato oficial de reserva?
              </Text>
              <Text variant="bodySmall" style={styles.faqRespuesta}>
                Una vez que tu solicitud aparezca como aprobada en "Mis Solicitudes", descárgala en PDF, imprímela y fírmala. <Text style={styles.bold}>El formato impreso se debe llevar al encargado ya firmado por el usuario</Text> para que te entregue el espacio y el equipamiento asignado.
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.faqItem}>
              <Text variant="labelLarge" style={styles.faqPregunta}>
                ¿Por qué los logos de PDF aparecen en naranja en solicitudes rechazadas?
              </Text>
              <Text variant="bodySmall" style={styles.faqRespuesta}>
                El color naranja alerta visualmente que la solicitud no fue procedente o fue descartada por colisión horaria con otra reserva aprobada previamente, permitiendo descargar el comprobante informativo de descarte.
              </Text>
            </View>
          </View>
        </View>

        {/* Botón de acción final para ir al catálogo */}
        <View style={styles.pieCta}>
          <Button
            mode="contained"
            icon="calendar-check"
            onPress={() => router.push('/')}
            buttonColor={cictatColors.verde1}
            textColor="#FFFFFF"
            style={[styles.botonCta, getTerracottaShadow({ border: 'structural', intensity: 1.2 })]}
            contentStyle={styles.botonCtaContent}
            labelStyle={styles.botonCtaLabel}
          >
            Explorar Espacios Disponibles
          </Button>

          <Text variant="bodySmall" style={styles.pieTexto}>
            Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT) · UJAT
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: '#D4D4D8',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 4,
  },
  backButtonTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  pressed: { opacity: 0.8 },
  badgeGuia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  badgeGuiaTexto: {
    color: '#52525B',
    fontWeight: '700',
  },

  header: { gap: spacing.sm },
  subtitulo: {
    color: '#71717A',
    lineHeight: 22,
  },

  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4D4D8',
  },
  cardTitulos: { flex: 1, gap: 2 },
  cardTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  cardSub: {
    color: '#71717A',
  },
  parrafo: {
    color: cictatColors.carbon,
    lineHeight: 22,
  },

  grid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tipoEspacioCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FAFAFA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: spacing.md + 2,
    gap: spacing.xs + 2,
  },
  tipoEspacioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  tipoEspacioTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  tipoEspacioDesc: {
    color: '#71717A',
    lineHeight: 18,
  },

  listaPerfiles: { gap: spacing.md },
  perfilItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: spacing.md,
    gap: spacing.xs,
  },
  perfilBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm + 2,
  },
  perfilDesc: {
    color: cictatColors.carbon,
    lineHeight: 19,
  },
  textoBlancoBold: { color: '#FFFFFF', fontWeight: '800' },
  textoCarbonBold: { color: cictatColors.carbon, fontWeight: '800' },
  bold: { fontWeight: '800' },
  boldAviso: { color: '#9A3412', fontWeight: '800' },

  pasosContenedor: { gap: spacing.lg },
  pasoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pasoNumero: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.verde1,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoNumeroTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pasoTextos: { flex: 1, gap: 4 },
  pasoTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  pasoDetalle: {
    color: '#71717A',
    lineHeight: 20,
  },

  /* Tarjeta de Advertencias e Incidencias en Naranja / Rojo */
  cardAlerta: {
    backgroundColor: '#FFFDF9',
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    borderColor: cictatColors.warning,
    borderWidth: 2,
  },
  alertaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  alertaTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  alertaSub: {
    color: cictatColors.warning,
    fontWeight: '700',
  },
  listaAdvertencias: { gap: spacing.md },
  avisoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: cictatColors.warningSoft,
    borderColor: cictatColors.warning,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoIconoWrapNaranja: {
    paddingTop: 2,
  },
  avisoCuerpo: { flex: 1, gap: 4 },
  avisoTituloNaranja: {
    color: '#9A3412',
    fontWeight: '800',
  },
  avisoTexto: {
    color: cictatColors.carbon,
    lineHeight: 19,
  },

  avisoItemRojo: {
    backgroundColor: cictatColors.dangerSoft,
    borderColor: cictatColors.danger,
  },
  avisoIconoWrapRojo: {
    paddingTop: 2,
  },
  avisoTituloRojo: {
    color: cictatColors.danger,
    fontWeight: '800',
  },
  avisoTextoRojo: {
    color: cictatColors.carbon,
    lineHeight: 19,
  },
  boldRojo: {
    color: cictatColors.danger,
    fontWeight: '800',
  },

  faqLista: { gap: spacing.md },
  faqItem: { gap: spacing.xs },
  faqPregunta: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  faqRespuesta: {
    color: '#71717A',
    lineHeight: 20,
  },
  divider: {
    backgroundColor: '#E4E4E7',
  },

  pieCta: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  botonCta: {
    borderRadius: radius.pill,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    minWidth: 260,
  },
  botonCtaContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  botonCtaLabel: {
    fontWeight: '800',
    fontSize: 16,
  },
  pieTexto: {
    color: '#71717A',
    textAlign: 'center',
  },
});
