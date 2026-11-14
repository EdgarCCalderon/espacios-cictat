/**
 * app/solicitud/confirmacion.tsx — Confirmación y Descarga de Formato Pre-llenado (U-02)
 *
 * Pantalla de confirmación de registro de solicitud:
 * - Ícono de verificación institucional y folio único de solicitud.
 * - Resumen del horario reservado + bloque de limpieza institucional.
 * - Estado: PENDIENTE DE EVALUACIÓN.
 * - Botón Principal Destacado (Naranja Terracota #E05A2B):
 *   "📄 Descargar / Imprimir Formato Oficial Pre-llenado (Sin Firma)".
 * - Tarjeta Ocre suave con instrucciones del día del evento.
 * - Navegación hacia "Mis Solicitudes" (/solicitud/mis-solicitudes) o catálogo.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generadorFormatoPDFService } from '@/application/services/GeneradorFormatoPDFService';
import type { Espacio, SolicitudReserva } from '@/domain/models';
import { formatearFechaLarga } from '@/domain/usecases/calendario';
import { supabase } from '@/infrastructure/supabase/supabaseClient';
import { TABLAS } from '@/infrastructure/supabase/tables';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { useAuth } from '@/presentation/context/AuthContext';
import { normalizarParametro } from '@/presentation/controllers/useAuthController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

export default function ConfirmacionSolicitudScreen() {
  const router = useRouter();
  const { perfil } = useAuth();
  const rawParams = useLocalSearchParams<{
    solicitudId?: string;
    pdfUri?: string;
  }>();

  const solicitudId = normalizarParametro(rawParams.solicitudId);
  const paramPdfUri = normalizarParametro(rawParams.pdfUri);

  const [solicitud, setSolicitud] = useState<SolicitudReserva | null>(null);
  const [espacio, setEspacio] = useState<Espacio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  // Cargar datos de la solicitud y espacio
  useEffect(() => {
    let cancelado = false;
    async function cargarDetalles() {
      if (!solicitudId) {
        setCargando(false);
        return;
      }

      try {
        const { data: solData } = await supabase
          .from(TABLAS.solicitudesReservas)
          .select('*')
          .eq('id', solicitudId)
          .single();

        if (cancelado) return;

        if (solData) {
          const s = solData as SolicitudReserva;
          setSolicitud(s);

          const { data: espData } = await supabase
            .from(TABLAS.espacios)
            .select('*')
            .eq('id', s.espacio_id)
            .single();

          if (!cancelado && espData) {
            setEspacio(espData as Espacio);
          }
        }
      } catch (err) {
        console.warn('[Confirmacion] Error cargando detalles:', err);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargarDetalles();
    return () => {
      cancelado = true;
    };
  }, [solicitudId]);

  // Manejador de descarga / compartir
  const manejarDescargarOImprimir = useCallback(async () => {
    setDescargando(true);
    try {
      if (paramPdfUri && paramPdfUri.trim()) {
        await generadorFormatoPDFService.descargarOCompartirPDF(paramPdfUri);
      } else if (perfil && espacio && solicitud) {
        await generadorFormatoPDFService.regenerarYDescargarPDF(perfil, espacio, solicitud);
      } else {
        setSnack('Generando vista previa del documento...');
        if (solicitudId) {
          // Consultar documento adjunto
          const { data: docData } = await supabase
            .from(TABLAS.documentosSolicitud)
            .select('*')
            .eq('solicitud_id', solicitudId)
            .eq('tipo_documento', 'formato_pdf_prellenado')
            .maybeSingle();

          if (docData?.storage_path) {
            const { data: urlData } = supabase.storage
              .from('formatos_pdf')
              .getPublicUrl(docData.storage_path);

            if (urlData?.publicUrl) {
              await generadorFormatoPDFService.descargarOCompartirPDF(urlData.publicUrl);
              return;
            }
          }
        }
        setSnack('No se encontró el documento local. Puedes descargarlo en "Mis Solicitudes".');
      }
    } catch (err) {
      console.error('[Confirmacion] Error descargando PDF:', err);
      setSnack('Ocurrió un error al intentar abrir o compartir el formato PDF.');
    } finally {
      setDescargando(false);
    }
  }, [paramPdfUri, perfil, espacio, solicitud, solicitudId]);

  const folioTexto = solicitudId ? `CICTAT-${solicitudId.slice(0, 8).toUpperCase()}` : 'CICTAT-REGISTRADO';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ícono de Éxito y Título */}
        <View style={styles.centroHeader}>
          <View style={[styles.exitoCircle, getTerracottaShadow({ border: 'structural', intensity: 1.2 })]}>
            <MaterialCommunityIcons name="check-decagram" size={54} color={cictatColors.terracotta} />
          </View>
          <BrushTitle text="¡Solicitud Registrada con Éxito!" highlight="Éxito" size="lg" />
          <Text variant="bodyLarge" style={styles.subtitulo}>
            Tu petición de reserva ha ingresado al sistema institucional de Espacios CICTAT.
          </Text>
        </View>

        {/* Tarjeta de Folio y Estado */}
        <View style={[styles.cardFolio, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.filaFolio}>
            <View>
              <Text variant="labelSmall" style={styles.folioEtiqueta}>FOLIO INSTITUCIONAL</Text>
              <Text variant="headlineSmall" style={styles.folioValor}>
                {folioTexto}
              </Text>
            </View>
            <View style={styles.badgeEstado}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#FFFFFF" />
              <Text variant="labelMedium" style={styles.badgeEstadoTexto}>
                PENDIENTE DE EVALUACIÓN
              </Text>
            </View>
          </View>
        </View>

        {/* Resumen del Espacio y Horario */}
        {cargando ? (
          <ActivityIndicator color={cictatColors.terracotta} style={{ padding: spacing.xl }} />
        ) : solicitud && espacio ? (
          <View style={[styles.cardResumen, getTerracottaShadow({ border: 'soft' })]}>
            <View style={styles.resumenHeader}>
              <MaterialCommunityIcons name="calendar-check" size={22} color={cictatColors.ochre} />
              <Text variant="titleMedium" style={styles.resumenTitulo}>
                Detalles de la Reserva
              </Text>
            </View>

            <View style={styles.datosGrid}>
              <View style={styles.datoFila}>
                <Text variant="labelSmall" style={styles.datoEtiqueta}>ESPACIO SOLICITADO</Text>
                <Text variant="bodyLarge" style={styles.datoValor}>
                  {espacio.nombre} ({espacio.codigo_espacio}) · Capacidad {espacio.capacidad} personas
                </Text>
              </View>

              <View style={styles.datoFila}>
                <Text variant="labelSmall" style={styles.datoEtiqueta}>FECHA PROGRAMADA</Text>
                <Text variant="bodyMedium" style={styles.datoValor}>
                  {formatearFechaLarga(solicitud.fecha_evento)} ({solicitud.fecha_evento})
                </Text>
              </View>

              <View style={styles.datoFila}>
                <Text variant="labelSmall" style={styles.datoEtiqueta}>HORARIO DE LA RESERVA</Text>
                <Text variant="bodyLarge" style={styles.datoValor}>
                  {solicitud.hora_inicio} a {solicitud.hora_fin} hrs
                </Text>
                <Text variant="bodySmall" style={styles.limpiezaNota}>
                  * Bloque institucional de limpieza: espacio reservado hasta las{' '}
                  <Text style={styles.bold}>{solicitud.hora_fin_limpieza || '1 hora después'} hrs</Text>.
                </Text>
              </View>

              <View style={styles.datoFila}>
                <Text variant="labelSmall" style={styles.datoEtiqueta}>TEMA DEL EVENTO</Text>
                <Text variant="bodyMedium" style={styles.datoValor}>
                  {solicitud.tema_evento}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Botón Principal Destacado (Naranja Terracota #E05A2B) */}
        <Button
          mode="contained"
          icon="file-pdf-box"
          onPress={manejarDescargarOImprimir}
          loading={descargando}
          disabled={descargando}
          buttonColor={cictatColors.terracotta}
          textColor="#FFFFFF"
          style={[styles.botonDescarga, getTerracottaShadow({ border: 'structural', intensity: 1.5 })]}
          contentStyle={styles.botonDescargaContent}
          labelStyle={styles.botonDescargaLabel}
        >
          📄 Descargar / Imprimir Formato Oficial Pre-llenado (Sin Firma)
        </Button>

        {/* Tarjeta de Instrucciones en Ocre Suave */}
        <View style={styles.tarjetaOcreInstrucciones}>
          <MaterialCommunityIcons name="information" size={26} color={cictatColors.ochre} />
          <View style={styles.instruccionesTextos}>
            <Text variant="titleSmall" style={styles.instruccionesTitulo}>
              Paso siguiente y trámite presencial
            </Text>
            <Text variant="bodyMedium" style={styles.instruccionesCuerpo}>
              Espera la aprobación del encargado en la sección{' '}
              <Text style={styles.bold}>"Mis Solicitudes"</Text>. El día de tu evento, presenta este
              formato impreso para recabar la firma física y sello en la coordinación del CICTAT — DACyTI.
            </Text>
          </View>
        </View>

        {/* Botones Secundarios */}
        <View style={styles.accionesSecundarias}>
          <Button
            mode="outlined"
            icon="clipboard-text-clock"
            onPress={() => router.replace('/solicitud/mis-solicitudes')}
            textColor={cictatColors.carbon}
            style={styles.botonSecundario}
            labelStyle={styles.botonSecundarioLabel}
          >
            Ver Mis Solicitudes
          </Button>

          <Button
            mode="text"
            icon="home"
            onPress={() => router.replace('/')}
            textColor={cictatColors.textSecondary}
          >
            Volver al Catálogo de Espacios
          </Button>
        </View>
      </ScrollView>

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={4000}
      >
        {snack}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },
  centroHeader: {
    alignItems: 'center',
    textAlign: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  exitoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  subtitulo: {
    color: cictatColors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
  },

  cardFolio: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  filaFolio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  folioEtiqueta: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  folioValor: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  badgeEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: cictatColors.ochre,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  badgeEstadoTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  cardResumen: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  resumenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resumenTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  datosGrid: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  datoFila: { gap: 2 },
  datoEtiqueta: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  datoValor: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  limpiezaNota: {
    color: cictatColors.terracotta,
    fontWeight: '600',
    marginTop: 2,
  },
  bold: { fontWeight: '800' },

  botonDescarga: {
    borderRadius: radius.md,
    backgroundColor: cictatColors.terracotta,
  },
  botonDescargaContent: {
    paddingVertical: spacing.sm + 4,
  },
  botonDescargaLabel: {
    fontWeight: '800',
    fontSize: 15,
  },

  tarjetaOcreInstrucciones: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: cictatColors.ochreSoft,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: cictatColors.ochre,
  },
  instruccionesTextos: { flex: 1, gap: 4 },
  instruccionesTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  instruccionesCuerpo: {
    color: '#4A3210',
    lineHeight: 20,
  },

  accionesSecundarias: {
    gap: spacing.xs,
    alignItems: 'stretch',
    marginTop: spacing.xs,
  },
  botonSecundario: {
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: cictatColors.surfaceElevated,
  },
  botonSecundarioLabel: { fontWeight: '800' },
});
