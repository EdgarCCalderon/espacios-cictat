/**
 * app/solicitud/mis-solicitudes.tsx — Historial y Seguimiento en Tiempo Real (U-03)
 *
 * Módulo de Solicitante CICTAT:
 * - Suscripción en tiempo real a public.solicitudes_reservas del usuario autenticado.
 * - Filtros por estado: Todas, Pendientes, Aprobadas, Rechazadas, Canceladas.
 * - Tarjeta detallada con Sala/Cubículo, fecha, horario + bloque de limpieza y badge de estado.
 * - Muestra de motivo de rechazo (incluyendo rechazo automático por colisión de horario).
 * - Botones de acción:
 *   * "📄 Volver a Descargar Formato PDF Pre-llenado" (regenera o abre con GeneradorFormatoPDFService).
 *   * "Cancelar Solicitud" (disponible para 'pendiente' o 'aprobada').
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Dialog, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generadorFormatoPDFService } from '@/application/services/GeneradorFormatoPDFService';
import type { EstadoSolicitud } from '@/domain/models';
import { formatearFechaLarga } from '@/domain/usecases/calendario';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { useAuth } from '@/presentation/context/AuthContext';
import {
  solicitudUsuarioController,
  type SolicitudConDetalles,
} from '@/presentation/controllers/SolicitudUsuarioController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

type FiltroEstado = 'todas' | EstadoSolicitud;

const FILTROS: { id: FiltroEstado; etiqueta: string }[] = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'pendiente', etiqueta: 'Pendientes' },
  { id: 'aprobada', etiqueta: 'Aprobadas' },
  { id: 'rechazada', etiqueta: 'Rechazadas' },
  { id: 'cancelada', etiqueta: 'Canceladas' },
];

export default function MisSolicitudesScreen() {
  const router = useRouter();
  const { user, perfil, isLoading: authCargando } = useAuth();

  const [solicitudes, setSolicitudes] = useState<SolicitudConDetalles[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');

  // Diálogo de cancelación
  const [solicitudACancelar, setSolicitudACancelar] = useState<SolicitudConDetalles | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelando, setCancelando] = useState(false);

  // Descarga en curso
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  // Cargar solicitudes del usuario
  const cargarSolicitudes = useCallback(async () => {
    if (!user) return;
    try {
      const data = await solicitudUsuarioController.obtenerMisSolicitudes(user.id);
      setSolicitudes(data);
    } catch (err) {
      console.warn('[MisSolicitudes] Error al cargar solicitudes:', err);
      setSnack('No se pudieron cargar tus solicitudes de reserva.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [user]);

  // Efecto inicial + Suscripción Realtime
  useEffect(() => {
    if (!user) {
      setCargando(false);
      return;
    }

    void cargarSolicitudes();

    // Suscripción Realtime a cambios en solicitudes_reservas
    const cancelarSuscripcion = solicitudUsuarioController.suscribirMisSolicitudes(
      user.id,
      (nuevas) => {
        setSolicitudes(nuevas);
      },
    );

    return () => {
      cancelarSuscripcion();
    };
  }, [user, cargarSolicitudes]);

  const refrescar = useCallback(() => {
    setRefrescando(true);
    void cargarSolicitudes();
  }, [cargarSolicitudes]);

  // Conteos para cada filtro
  const conteos = useMemo(() => {
    const counts: Record<FiltroEstado, number> = {
      todas: solicitudes.length,
      pendiente: 0,
      aprobada: 0,
      rechazada: 0,
      cancelada: 0,
    };
    for (const s of solicitudes) {
      if (counts[s.estado] !== undefined) {
        counts[s.estado]++;
      }
    }
    return counts;
  }, [solicitudes]);

  // Lista filtrada
  const solicitudesFiltradas = useMemo(() => {
    if (filtro === 'todas') return solicitudes;
    return solicitudes.filter((s) => s.estado === filtro);
  }, [solicitudes, filtro]);

  // Manejar descarga o compartición de PDF pre-llenado
  const manejarDescargarPDF = useCallback(
    async (sol: SolicitudConDetalles) => {
      if (!perfil) {
        setSnack('Perfil no disponible.');
        return;
      }
      if (!sol.espacio) {
        setSnack('No se encontraron los datos del espacio solicitado.');
        return;
      }

      setDescargandoId(sol.id);
      try {
        // Buscar si ya existe el documento adjunto registrado
        const docPDF = sol.documentos.find((d) => d.tipo_documento === 'formato_pdf_prellenado');

        if (docPDF?.storage_path) {
          // Intentar abrir con ruta o regenerar
          await generadorFormatoPDFService.regenerarYDescargarPDF(perfil, sol.espacio, sol);
        } else {
          // Regenerar directamente
          await generadorFormatoPDFService.regenerarYDescargarPDF(perfil, sol.espacio, sol);
        }
      } catch (err) {
        console.error('[MisSolicitudes] Error al descargar PDF:', err);
        setSnack('Ocurrió un error al preparar el documento PDF.');
      } finally {
        setDescargandoId(null);
      }
    },
    [perfil],
  );

  // Ejecutar cancelación
  const confirmarCancelacion = useCallback(async () => {
    if (!solicitudACancelar || !user) return;
    setCancelando(true);

    try {
      const res = await solicitudUsuarioController.cancelarSolicitudPropia(
        solicitudACancelar.id,
        user.id,
        motivoCancelacion.trim() || 'Cancelada voluntariamente por el solicitante.',
      );

      if (res.ok) {
        setSnack('Tu solicitud ha sido cancelada correctamente.');
        setSolicitudACancelar(null);
        setMotivoCancelacion('');
        void cargarSolicitudes();
      } else {
        setSnack(res.error ?? 'No se pudo cancelar la solicitud.');
      }
    } catch (err) {
      setSnack(err instanceof Error ? err.message : 'Error al cancelar la solicitud.');
    } finally {
      setCancelando(false);
    }
  }, [solicitudACancelar, user, motivoCancelacion, cargarSolicitudes]);

  // Si no está autenticado
  if (!authCargando && !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centroVacio}>
          <MaterialCommunityIcons name="account-lock-outline" size={54} color={cictatColors.carbon} />
          <BrushTitle text="Inicia Sesión" highlight="Sesión" size="md" />
          <Text variant="bodyMedium" style={styles.textoCentro}>
            Inicia sesión para consultar tus solicitudes de reserva, conocer su estado en tiempo real y
            descargar tus formatos oficiales.
          </Text>
          <Button
            mode="contained"
            icon="login"
            onPress={() => router.push('/auth/selector')}
            buttonColor={cictatColors.terracotta}
            textColor="#FFFFFF"
            style={styles.botonAuth}
            labelStyle={styles.bold}
          >
            Iniciar Sesión
          </Button>
          <Button mode="text" onPress={() => router.replace('/')} textColor={cictatColors.carbon}>
            Volver al Catálogo
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={cictatColors.terracotta}
            colors={[cictatColors.terracotta]}
          />
        }
      >
        {/* Barra de navegación superior */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/')} style={styles.botonVolver}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={cictatColors.carbon} />
            <Text variant="labelLarge" style={styles.botonVolverTexto}>
              Catálogo de Espacios
            </Text>
          </Pressable>

          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push('/solicitud/nueva')}
            buttonColor={cictatColors.terracotta}
            textColor="#FFFFFF"
            style={styles.botonNueva}
            labelStyle={styles.bold}
          >
            Nueva Solicitud
          </Button>
        </View>

        {/* Título de la sección */}
        <View style={styles.header}>
          <BrushTitle text="Mis Solicitudes" highlight="Solicitudes" size="lg" />
          <Text variant="bodyMedium" style={styles.subtitulo}>
            Seguimiento en tiempo real y descarga de formatos pre-llenados CICTAT
          </Text>
        </View>

        {/* Barra de Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosRow}
        >
          {FILTROS.map((f) => {
            const activo = filtro === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFiltro(f.id)}
                style={[
                  styles.filtroChip,
                  getTerracottaShadow({ border: 'soft', intensity: activo ? 0.9 : 0.2 }),
                  activo && styles.filtroChipActivo,
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={[styles.filtroChipTexto, activo && styles.filtroChipTextoActivo]}
                >
                  {f.etiqueta} ({conteos[f.id]})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Listado de Solicitudes */}
        {cargando ? (
          <View style={styles.centroVacio}>
            <ActivityIndicator size="large" color={cictatColors.terracotta} />
            <Text variant="bodyMedium" style={styles.muted}>
              Cargando tus solicitudes...
            </Text>
          </View>
        ) : solicitudesFiltradas.length === 0 ? (
          <View style={[styles.cardVacia, getTerracottaShadow({ border: 'soft' })]}>
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={48}
              color={cictatColors.ochre}
            />
            <Text variant="titleMedium" style={styles.vaciaTitulo}>
              No hay solicitudes {filtro !== 'todas' ? `en estado '${filtro}'` : 'registradas'}
            </Text>
            <Text variant="bodyMedium" style={styles.vaciaTexto}>
              {filtro === 'todas'
                ? 'Aún no has solicitado la reserva de ningún espacio del CICTAT.'
                : 'No se encontraron solicitudes que coincidan con este filtro.'}
            </Text>
            {filtro === 'todas' ? (
              <Button
                mode="contained"
                icon="calendar-plus"
                onPress={() => router.push('/solicitud/nueva')}
                buttonColor={cictatColors.terracotta}
                textColor="#FFFFFF"
                style={styles.botonCrearVacio}
                labelStyle={styles.bold}
              >
                Crear una Solicitud Ahora
              </Button>
            ) : null}
          </View>
        ) : (
          <View style={styles.listaSolicitudes}>
            {solicitudesFiltradas.map((sol) => {
              const folioCorto = sol.id.slice(0, 8).toUpperCase();
              const cancelable = sol.estado === 'pendiente' || sol.estado === 'aprobada';
              const esDescargando = descargandoId === sol.id;

              // Detección de rechazo automático por colisión de horario
              const esRechazoColision =
                sol.historial.some((h) => h.es_rechazo_automatico_colision) ||
                (sol.motivo_rechazo_cancelacion &&
                  /colisi[oó]n|traslape|aprobada otra solicitud/i.test(
                    sol.motivo_rechazo_cancelacion,
                  ));

              return (
                <View
                  key={sol.id}
                  style={[
                    styles.solicitudCard,
                    getTerracottaShadow({
                      border: sol.estado === 'aprobada' ? 'structural' : 'soft',
                      intensity: 0.9,
                    }),
                  ]}
                >
                  {/* Cabecera de la tarjeta */}
                  <View style={styles.solicitudCardHeader}>
                    <View style={styles.espacioHeaderInfo}>
                      <View style={styles.codigoBadge}>
                        <Text variant="labelSmall" style={styles.codigoBadgeTexto}>
                          {sol.espacio?.codigo_espacio ?? 'ESPACIO'}
                        </Text>
                      </View>
                      <Text variant="titleMedium" style={styles.espacioNombreTexto}>
                        {sol.espacio?.nombre ?? 'Espacio CICTAT'}
                      </Text>
                    </View>

                    {/* Badge de Estado */}
                    <View
                      style={[
                        styles.badgeEstado,
                        sol.estado === 'pendiente' && styles.badgePendiente,
                        sol.estado === 'aprobada' && styles.badgeAprobada,
                        sol.estado === 'rechazada' && styles.badgeRechazada,
                        sol.estado === 'cancelada' && styles.badgeCancelada,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          sol.estado === 'aprobada'
                            ? 'check-circle'
                            : sol.estado === 'rechazada'
                              ? 'close-circle'
                              : sol.estado === 'cancelada'
                                ? 'cancel'
                                : 'clock-outline'
                        }
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text variant="labelSmall" style={styles.badgeEstadoLabel}>
                        {sol.estado.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Datos del evento */}
                  <View style={styles.eventoDetallesBox}>
                    <View style={styles.detalleFila}>
                      <MaterialCommunityIcons
                        name="calendar-month"
                        size={18}
                        color={cictatColors.verde1}
                      />
                      <Text variant="bodyMedium" style={styles.detalleFilaTexto}>
                        <Text style={styles.bold}>{formatearFechaLarga(sol.fecha_evento)}</Text> ({sol.fecha_evento})
                      </Text>
                    </View>

                    <View style={styles.detalleFila}>
                      <MaterialCommunityIcons
                        name="clock-time-four-outline"
                        size={18}
                        color={cictatColors.verde2}
                      />
                      <View style={styles.horarioBloque}>
                        <Text variant="bodyMedium" style={styles.detalleFilaTexto}>
                          Horario: <Text style={styles.bold}>{sol.hora_inicio} a {sol.hora_fin} hrs</Text>
                        </Text>
                        <Text variant="bodySmall" style={styles.limpiezaNota}>
                          + 1h institucional de limpieza: espacio bloqueado hasta las{' '}
                          {sol.hora_fin_limpieza || '1 hora posterior'} hrs
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detalleFila}>
                      <MaterialCommunityIcons
                        name="format-quote-open"
                        size={18}
                        color={cictatColors.textSecondary}
                      />
                      <Text variant="bodySmall" style={styles.temaTexto} numberOfLines={2}>
                        "{sol.tema_evento}"
                      </Text>
                    </View>
                  </View>

                  {/* Banner si fue Rechazada o Cancelada con motivo */}
                  {sol.motivo_rechazo_cancelacion ? (
                    <View
                      style={[
                        styles.motivoCaja,
                        esRechazoColision && styles.motivoColisionCaja,
                        sol.estado === 'cancelada' && styles.motivoCanceladaCaja,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={esRechazoColision ? 'clock-alert-outline' : 'alert-circle-outline'}
                        size={20}
                        color={
                          esRechazoColision
                            ? cictatColors.warning
                            : sol.estado === 'cancelada'
                              ? cictatColors.carbon
                              : cictatColors.danger
                        }
                      />
                      <View style={styles.motivoTextos}>
                        <Text variant="labelSmall" style={styles.motivoTitulo}>
                          {esRechazoColision
                            ? 'DESCARTE AUTOMÁTICO POR COLISIÓN DE HORARIO'
                            : sol.estado === 'cancelada'
                              ? 'MOTIVO DE CANCELACIÓN'
                              : 'MOTIVO DE RECHAZO ADMINISTRATIVO'}
                        </Text>
                        <Text variant="bodySmall" style={styles.motivoCuerpo}>
                          {sol.motivo_rechazo_cancelacion}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Pie de tarjeta con Folio y Botones de Acción */}
                  <View style={styles.cardFooter}>
                    <Text variant="labelSmall" style={styles.folioFooterTexto}>
                      Folio: CICTAT-{folioCorto}
                    </Text>

                    <View style={styles.accionesFila}>
                      {/* Botón Descargar Formato PDF Pre-llenado */}
                      <Button
                        mode="outlined"
                        icon={({ size }) => (
                          <MaterialCommunityIcons
                            name="file-pdf-box"
                            size={size}
                            color={sol.estado === 'rechazada' ? cictatColors.warning : cictatColors.carbon}
                          />
                        )}
                        loading={esDescargando}
                        disabled={esDescargando}
                        onPress={() => void manejarDescargarPDF(sol)}
                        textColor={sol.estado === 'rechazada' ? cictatColors.warning : cictatColors.carbon}
                        style={[
                          styles.botonPdf,
                          sol.estado === 'rechazada' && styles.botonPdfRechazada,
                        ]}
                        labelStyle={styles.botonPdfLabel}
                      >
                        Descargar Formato PDF
                      </Button>

                      {/* Botón Cancelar Solicitud */}
                      {cancelable ? (
                        <Button
                          mode="text"
                          icon="close"
                          onPress={() => {
                            setSolicitudACancelar(sol);
                            setMotivoCancelacion('');
                          }}
                          textColor={cictatColors.danger}
                          labelStyle={styles.botonCancelarLabel}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Diálogo de Cancelación de Solicitud */}
      <Portal>
        <Dialog
          visible={!!solicitudACancelar}
          onDismiss={() => !cancelando && setSolicitudACancelar(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitulo}>
            Cancelar Solicitud de Reserva
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={styles.dialogMensaje}>
              ¿Estás seguro de que deseas cancelar la solicitud para{' '}
              <Text style={styles.bold}>{solicitudACancelar?.espacio?.nombre}</Text> el día{' '}
              <Text style={styles.bold}>{solicitudACancelar?.fecha_evento}</Text>? Esta acción no se
              puede revertir.
            </Text>

            <TextInput
              mode="outlined"
              label="Motivo de cancelación (opcional)"
              placeholder="Ej. Cambio de fecha del evento, cancelación académica..."
              value={motivoCancelacion}
              onChangeText={setMotivoCancelacion}
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
              outlineColor={cictatColors.borderSoft}
              activeOutlineColor={cictatColors.terracotta}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setSolicitudACancelar(null)}
              disabled={cancelando}
              textColor={cictatColors.textSecondary}
            >
              Regresar
            </Button>
            <Button
              mode="contained"
              onPress={confirmarCancelacion}
              loading={cancelando}
              disabled={cancelando}
              buttonColor={cictatColors.danger}
              textColor="#FFFFFF"
              labelStyle={styles.bold}
            >
              Confirmar Cancelación
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    maxWidth: 780,
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  botonVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cictatColors.surface,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  botonVolverTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  botonNueva: {
    borderRadius: radius.pill,
  },
  header: { gap: 2 },
  subtitulo: { color: cictatColors.textSecondary },

  filtrosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filtroChip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.surfaceElevated,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  filtroChipActivo: {
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
  },
  filtroChipTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  filtroChipTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  listaSolicitudes: {
    gap: spacing.lg,
  },
  solicitudCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  solicitudCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  espacioHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  codigoBadge: {
    backgroundColor: cictatColors.surface,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  codigoBadgeTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  espacioNombreTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
    flexShrink: 1,
  },

  badgeEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  badgePendiente: { backgroundColor: cictatColors.warning },
  badgeAprobada: { backgroundColor: cictatColors.verde1 },
  badgeRechazada: { backgroundColor: cictatColors.danger },
  badgeCancelada: { backgroundColor: '#57534E' },
  badgeEstadoLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  eventoDetallesBox: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  detalleFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detalleFilaTexto: {
    color: cictatColors.carbon,
    flex: 1,
  },
  horarioBloque: { flex: 1, gap: 1 },
  limpiezaNota: {
    color: cictatColors.verde1,
    fontWeight: '600',
  },
  temaTexto: {
    color: cictatColors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  bold: { fontWeight: '800' },

  motivoCaja: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#F9DEDC',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: cictatColors.danger,
  },
  motivoColisionCaja: {
    backgroundColor: cictatColors.warningSoft,
    borderColor: cictatColors.warning,
  },
  motivoCanceladaCaja: {
    backgroundColor: '#E7E5E4',
    borderColor: '#78716C',
  },
  motivoTextos: { flex: 1, gap: 2 },
  motivoTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  motivoCuerpo: {
    color: cictatColors.carbon,
    lineHeight: 18,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: cictatColors.borderSoft,
    paddingTop: spacing.md,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folioFooterTexto: {
    color: cictatColors.textSecondary,
    fontWeight: '700',
  },
  accionesFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  botonPdf: {
    borderColor: '#D4D4D8',
    borderWidth: 1,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.surfaceElevated,
  },
  botonPdfRechazada: {
    borderColor: cictatColors.warning,
    backgroundColor: cictatColors.warningSoft,
  },
  botonPdfLabel: {
    fontWeight: '800',
    fontSize: 12,
  },
  botonCancelarLabel: {
    fontWeight: '700',
    fontSize: 12,
  },

  centroVacio: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  muted: { color: cictatColors.textSecondary },
  cardVacia: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    textAlign: 'center',
    gap: spacing.sm,
  },
  vaciaTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
    textAlign: 'center',
  },
  vaciaTexto: {
    color: cictatColors.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
  },
  botonCrearVacio: {
    borderRadius: radius.md,
    marginTop: spacing.md,
  },

  textoCentro: {
    color: cictatColors.textSecondary,
    textAlign: 'center',
    maxWidth: 400,
  },
  botonAuth: {
    borderRadius: radius.md,
    width: '100%',
    maxWidth: 300,
    marginTop: spacing.sm,
  },

  dialog: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
  },
  dialogTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  dialogContent: {
    gap: spacing.md,
  },
  dialogMensaje: {
    color: cictatColors.carbon,
  },
  dialogInput: {
    backgroundColor: cictatColors.surface,
  },
});
