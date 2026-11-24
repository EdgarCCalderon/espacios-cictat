/**
 * Detalle de un espacio + calendario en tiempo real (ventana 08:00–15:00 hrs).
 *
 * - Ficha técnica (nombre, capacidad, equipamiento, reglamento)
 * - Selector de fecha con aviso de 24 h de anticipación
 * - Matriz horaria que se actualiza sola vía Realtime
 * - CTA "Solicitar Reserva en este Espacio" (requiere sesión)
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { obtenerImagenesEspacio } from '@/domain/models';
import { formatearFechaLarga, puedeAccederAEspacio } from '@/domain/usecases';
import { BadgeEstadoEspacio, BadgeExclusivo } from '@/presentation/components/catalogo/Badges';
import {
  LoginRequeridoDialog,
  SolicitudPreparadaDialog,
} from '@/presentation/components/common/AccesoDialogs';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { ErrorPanel } from '@/presentation/components/common/ErrorPanel';
import { EstadoVivoBadge } from '@/presentation/components/common/EstadoVivoBadge';
import { CalendarioMatriz } from '@/presentation/components/espacio/CalendarioMatriz';
import { DateStrip } from '@/presentation/components/espacio/DateStrip';
import { useAuth } from '@/presentation/context/AuthContext';
import { useEspacioCalendarioController } from '@/presentation/controllers/useEspacioCalendarioController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const InfoFila: React.FC<{ icono: IconName; etiqueta: string; valor: string }> = ({
  icono,
  etiqueta,
  valor,
}) => (
  <View style={styles.infoFila}>
    <MaterialCommunityIcons name={icono} size={20} color={cictatColors.ochre} />
    <View style={styles.infoTextos}>
      <Text variant="labelSmall" style={styles.infoEtiqueta}>
        {etiqueta.toUpperCase()}
      </Text>
      <Text variant="bodyMedium" style={styles.infoValor}>
        {valor}
      </Text>
    </View>
  </View>
);

const Aviso: React.FC<{ icono: IconName; texto: string; tono?: 'info' | 'alerta' }> = ({
  icono,
  texto,
  tono = 'info',
}) => (
  <View style={[styles.aviso, tono === 'alerta' && styles.avisoAlerta]}>
    <MaterialCommunityIcons name={icono} size={20} color={cictatColors.carbon} />
    <Text variant="bodySmall" style={styles.avisoTexto}>
      {texto}
    </Text>
  </View>
);

export default function EspacioDetalleScreen() {
  const { id, fecha: fechaParam } = useLocalSearchParams<{ id: string; fecha?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, perfil, isLoading: authCargando } = useAuth();
  const rol = perfil?.rol ?? null;

  const c = useEspacioCalendarioController(id);
  const { espacio, setFechaISO } = c;

  const [dlgLogin, setDlgLogin] = useState(false);
  const [dlgPreparada, setDlgPreparada] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  React.useEffect(() => {
    if (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      setFechaISO(fechaParam);
    }
  }, [fechaParam, setFechaISO]);

  const volver = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const irALoginAlumnoPosgrado = useCallback(() => {
    setDlgLogin(false);
    const destinoId = espacio?.id ?? id;
    router.push({
      pathname: '/auth/ujat',
      params: destinoId
        ? { rol: 'estudiante_posgrado', espacioId: destinoId }
        : { rol: 'estudiante_posgrado' },
    });
  }, [espacio?.id, id, router]);

  const irASelector = useCallback(() => {
    setDlgLogin(false);
    const destinoId = espacio?.id ?? id;
    router.push({
      pathname: '/auth/selector',
      params: destinoId
        ? { espacioId: destinoId, fecha: c.fechaISO }
        : { fecha: c.fechaISO },
    });
  }, [c.fechaISO, espacio?.id, id, router]);

  const onSolicitar = useCallback(() => {
    const destinoId = espacio?.id ?? id;
    if (!user) {
      router.push({
        pathname: '/auth/selector',
        params: destinoId
          ? { espacioId: destinoId, fecha: c.fechaISO }
          : { fecha: c.fechaISO },
      });
      return;
    }
    if (!c.hayBloquesReservables) {
      setSnack('Este día ya no cumple las 24 horas de anticipación. Elige otra fecha.');
      return;
    }
    const partesHorario = c.resumenSeleccion?.etiqueta.split(' – ');
    router.push({
      pathname: '/solicitud/nueva',
      params: {
        espacioId: destinoId,
        fecha: c.fechaISO,
        ...(partesHorario && partesHorario.length === 2
          ? {
              horaInicio: partesHorario[0],
              horaFin: partesHorario[1],
            }
          : {}),
      },
    });
  }, [c.fechaISO, c.hayBloquesReservables, c.resumenSeleccion, espacio?.id, id, router, user]);

  // ── Barra superior ──────────────────────────────────────────────────────────
  const topBar = (
    <View style={styles.topBar}>
      <IconButton
        icon="arrow-left"
        size={24}
        onPress={volver}
        accessibilityLabel="Volver al catálogo"
        iconColor={cictatColors.carbon}
        style={styles.backBtn}
      />
      <View style={styles.topBarDerecha}>
        {user ? (
          <Pressable
            onPress={() => router.push('/solicitud/mis-solicitudes')}
            accessibilityRole="button"
            accessibilityLabel="Mis Solicitudes"
            style={({ pressed }) => [
              styles.btnMisSolicitudesTop,
              getTerracottaShadow({ border: 'structural', intensity: 0.8 }),
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="clipboard-text-clock" size={16} color={cictatColors.carbon} />
            <Text variant="labelMedium" style={styles.btnMisSolicitudesTopTexto}>
              Mis Solicitudes
            </Text>
          </Pressable>
        ) : null}
        <EstadoVivoBadge estado={c.estadoVivo} detalle={c.detalleVivo} />
      </View>
    </View>
  );

  // ── Estados de carga / error / no encontrado / acceso ───────────────────────
  const cuerpoEstado = (() => {
    if ((c.cargandoEspacio && !espacio) || (espacio?.exclusivo_alumnos_posgrado && authCargando)) {
      return (
        <View style={styles.centro}>
          <ActivityIndicator color={cictatColors.terracotta} size="large" />
        </View>
      );
    }
    if (!espacio && c.errorEspacio) {
      return <ErrorPanel error={c.errorEspacio} onReintentar={c.recargar} />;
    }
    if (!espacio) {
      return (
        <View style={styles.centro}>
          <MaterialCommunityIcons name="map-marker-question-outline" size={48} color={cictatColors.ochre} />
          <Text variant="titleMedium" style={styles.tituloCentro}>
            Espacio no encontrado
          </Text>
          <Button mode="contained" onPress={volver} labelStyle={styles.bold}>
            Volver al catálogo
          </Button>
        </View>
      );
    }
    if (!puedeAccederAEspacio(espacio, rol)) {
      return (
        <View style={[styles.muro, getTerracottaShadow({ border: 'structural' })]}>
          <View style={styles.muroIcono}>
            <MaterialCommunityIcons name="lock" size={34} color={cictatColors.carbon} />
          </View>
          <Text variant="titleLarge" style={styles.tituloCentro}>
            Acceso Exclusivo para Posgrado
          </Text>
          <Text variant="bodyMedium" style={styles.textoCentro}>
            {espacio.nombre} ({espacio.capacidad} personas) es de uso exclusivo para Estudiantes de
            Posgrado. Inicia sesión con una cuenta autorizada para consultar su disponibilidad.
          </Text>
          <Button
            mode="contained"
            icon="school"
            onPress={irALoginAlumnoPosgrado}
            style={getTerracottaShadow({ border: 'none' })}
            labelStyle={styles.bold}
          >
            Iniciar sesión como Alumno de Posgrado
          </Button>
          <Button mode="text" onPress={volver} textColor={cictatColors.textSecondary}>
            Volver al catálogo
          </Button>
        </View>
      );
    }
    return null;
  })();

  const mostrarContenido = !!espacio && !cuerpoEstado;
  const operativo = !!espacio?.esta_activo;
  const resumen = c.resumenSeleccion;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {topBar}

          {cuerpoEstado}

          {mostrarContenido && espacio ? (
            <>
              {/* ── Ficha técnica ─────────────────────────────────────────── */}
              <View style={[styles.ficha, getTerracottaShadow({ border: 'structural' })]}>
                <View style={styles.fichaTop}>
                  <View style={styles.codigo}>
                    <Text variant="labelMedium" style={styles.codigoTexto}>
                      {espacio.codigo_espacio}
                    </Text>
                  </View>
                  <BadgeEstadoEspacio activo={espacio.esta_activo} />
                </View>

                <BrushTitle text={espacio.nombre} size="md" />

                {espacio.exclusivo_alumnos_posgrado ? <BadgeExclusivo desbloqueado /> : null}

                <InfoFila
                  icono="account-group"
                  etiqueta="Capacidad máxima"
                  valor={`${espacio.capacidad} personas`}
                />
                {espacio.equipamiento_incluido ? (
                  <InfoFila
                    icono="toolbox-outline"
                    etiqueta="Equipamiento incluido"
                    valor={espacio.equipamiento_incluido}
                  />
                ) : null}
                {espacio.reglamento ? (
                  <View style={styles.reglamento}>
                    <View style={styles.reglamentoTitulo}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={18}
                        color={cictatColors.carbon}
                      />
                      <Text variant="labelLarge" style={styles.bold}>
                        Reglamento
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={styles.reglamentoTexto}>
                      {espacio.reglamento}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* ── Galería de Fotografías de la Sala (hasta 3 imágenes JPG) ── */}
              {(() => {
                const fotos = obtenerImagenesEspacio(espacio);
                const slotsPlaceholders = [
                  { etiqueta: 'Foto 1 (.jpg)', desc: 'Vista principal y acceso al aula' },
                  { etiqueta: 'Foto 2 (.jpg)', desc: 'Pizarrón, proyector y equipamiento' },
                  { etiqueta: 'Foto 3 (.jpg)', desc: 'Distribución, contactos y climatización' },
                ];

                return (
                  <View style={[styles.galeriaCard, getTerracottaShadow({ border: 'structural' })]}>
                    <View style={styles.galeriaHeader}>
                      <View style={styles.galeriaIconoWrap}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={20} color={cictatColors.verde1} />
                      </View>
                      <View style={styles.galeriaTextos}>
                        <Text variant="titleMedium" style={styles.galeriaTitulo}>
                          Galería Fotográfica de la Sala
                        </Text>
                        <Text variant="bodySmall" style={styles.galeriaSub}>
                          {fotos.length > 0
                            ? `${fotos.length} ${fotos.length === 1 ? 'fotografía registrada' : 'fotografías registradas'} de este espacio`
                            : 'Espacios preparados para hasta 3 fotografías (.jpg) de la sala'}
                        </Text>
                      </View>
                    </View>

                    {fotos.length > 0 ? (
                      <View style={styles.galeriaFotosGrid}>
                        {fotos.map((url, i) => (
                          <View key={i} style={styles.fotoCard}>
                            <Image source={{ uri: url }} style={styles.fotoImg} resizeMode="cover" />
                            <View style={styles.fotoBadge}>
                              <Text variant="labelSmall" style={styles.fotoBadgeTexto}>
                                Foto {i + 1} de {fotos.length}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.placeholdersGrid}>
                        {slotsPlaceholders.map((slot, i) => (
                          <View key={i} style={styles.placeholderSlot}>
                            <View style={styles.placeholderIconoWrap}>
                              <MaterialCommunityIcons name="camera-outline" size={24} color="#71717A" />
                            </View>
                            <Text variant="labelMedium" style={styles.placeholderTitulo}>
                              {slot.etiqueta}
                            </Text>
                            <Text variant="bodySmall" style={styles.placeholderDesc}>
                              {slot.desc}
                            </Text>
                            <View style={styles.placeholderPill}>
                              <Text variant="labelSmall" style={styles.placeholderPillTexto}>
                                Espacio JPG Reservado
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}

              {c.errorEspacio ? <ErrorPanel error={c.errorEspacio} compacto /> : null}

              {!operativo ? (
                <Aviso
                  icono="wrench"
                  tono="alerta"
                  texto="Este espacio está en mantenimiento: por ahora no se reciben solicitudes de reserva."
                />
              ) : (
                <>
                  {/* ── Fecha ─────────────────────────────────────────────── */}
                  <View style={styles.seccion}>
                    <Text variant="titleMedium" style={styles.seccionTitulo}>
                      Fecha a consultar
                    </Text>
                    <Aviso
                      icono="information-outline"
                      texto="Las reservas requieren mínimo 24 horas de anticipación."
                    />
                    <DateStrip
                      dias={c.dias}
                      seleccionado={c.fechaISO}
                      hoyISO={c.hoyISO}
                      onChange={c.setFechaISO}
                    />
                    {!c.hayBloquesReservables ? (
                      <Aviso
                        icono="clock-alert-outline"
                        tono="alerta"
                        texto="Este día ya no cumple las 24 horas de anticipación; puedes consultarlo, pero no solicitarlo."
                      />
                    ) : null}
                  </View>

                  {/* ── Calendario ────────────────────────────────────────── */}
                  <View style={styles.seccion}>
                    <View style={styles.seccionCabecera}>
                      <Text variant="titleMedium" style={styles.seccionTitulo}>
                        Disponibilidad · 08:00 a 15:00 hrs
                      </Text>
                      {c.ultimaActualizacion ? (
                        <Text variant="labelSmall" style={styles.muted}>
                          Actualizado{' '}
                          {c.ultimaActualizacion.toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      ) : null}
                    </View>

                    {c.errorReservas ? (
                      <ErrorPanel error={c.errorReservas} onReintentar={c.recargar} />
                    ) : (
                      <CalendarioMatriz
                        bloques={c.bloques}
                        seleccion={c.seleccion}
                        cargando={c.cargandoReservas}
                        onToggle={c.alternar}
                      />
                    )}

                    {c.avisoSeleccion ? (
                      <Aviso icono="alert-outline" tono="alerta" texto={c.avisoSeleccion} />
                    ) : null}

                    <Text variant="bodySmall" style={styles.muted}>
                      Cada reserva aprobada añade 1 hora posterior de limpieza, durante la cual el
                      espacio permanece bloqueado.
                    </Text>
                  </View>
                </>
              )}
            </>
          ) : null}
        </ScrollView>

        {/* ── Barra inferior con CTA ────────────────────────────────────────── */}
        {mostrarContenido && operativo ? (
          <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.barraInner}>
              <View style={styles.resumen}>
                {resumen ? (
                  <>
                    <Text variant="titleSmall" style={styles.resumenTitulo}>
                      {resumen.etiqueta} · {resumen.horas} h
                    </Text>
                    {resumen.bloquesConPendientes > 0 ? (
                      <Text variant="bodySmall" style={styles.resumenAlerta}>
                        Hay solicitudes en evaluación en este horario: la tuya quedará sujeta a
                        aprobación.
                      </Text>
                    ) : (
                      <Text variant="bodySmall" style={styles.muted}>
                        {formatearFechaLarga(c.fechaISO)}
                      </Text>
                    )}
                    <Pressable onPress={c.limpiarSeleccion} hitSlop={8} accessibilityRole="button">
                      <Text variant="labelMedium" style={styles.link}>
                        Quitar selección
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text variant="bodySmall" style={styles.muted}>
                    Selecciona uno o más bloques consecutivos disponibles.
                  </Text>
                )}
              </View>

              <Button
                mode="contained"
                icon="calendar-plus"
                onPress={onSolicitar}
                buttonColor={cictatColors.terracotta}
                textColor="#FFFFFF"
                style={[styles.cta, getTerracottaShadow({ border: 'structural', intensity: 1.4 })]}
                contentStyle={styles.ctaContent}
                labelStyle={styles.ctaLabel}
              >
                Solicitar Reserva en este Espacio
              </Button>
            </View>
          </View>
        ) : null}
      </View>

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={4000}
        wrapperStyle={styles.snackWrapper}
      >
        {snack}
      </Snackbar>

      <LoginRequeridoDialog
        visible={dlgLogin}
        onDismiss={() => setDlgLogin(false)}
        onIniciarSesion={irASelector}
      />
      <SolicitudPreparadaDialog
        visible={dlgPreparada}
        onDismiss={() => setDlgPreparada(false)}
        resumen={
          espacio && resumen
            ? `${espacio.nombre} · ${formatearFechaLarga(c.fechaISO)} · ${resumen.etiqueta}`
            : ''
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  flex: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.xl,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: spacing.xxl,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarDerecha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnMisSolicitudesTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: cictatColors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  btnMisSolicitudesTopTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  pressed: { opacity: 0.75 },
  backBtn: {
    margin: 0,
    backgroundColor: cictatColors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
  },
  centro: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  tituloCentro: { color: cictatColors.carbon, fontWeight: '800', textAlign: 'center' },
  textoCentro: { color: cictatColors.textSecondary, textAlign: 'center' },
  bold: { fontWeight: '700' },
  muted: { color: cictatColors.textSecondary },
  link: { color: cictatColors.terracotta, fontWeight: '700', textDecorationLine: 'underline' },

  muro: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  muroIcono: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.ochre,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ficha: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md + 2,
  },
  fichaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  codigo: {
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.carbon,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  codigoTexto: { color: cictatColors.carbon, fontWeight: '800', letterSpacing: 0.8 },
  infoFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  infoTextos: { flex: 1, gap: 1 },
  infoEtiqueta: { color: cictatColors.textSecondary, fontWeight: '700', letterSpacing: 0.8 },
  infoValor: { color: cictatColors.carbon, fontWeight: '600' },
  reglamento: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  reglamentoTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reglamentoTexto: { color: cictatColors.textSecondary },

  galeriaCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  galeriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  galeriaIconoWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: cictatColors.verde1Soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galeriaTextos: { flex: 1, gap: 2 },
  galeriaTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  galeriaSub: {
    color: '#71717A',
  },
  galeriaFotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fotoCard: {
    flex: 1,
    minWidth: 160,
    height: 140,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  fotoImg: {
    width: '100%',
    height: '100%',
  },
  fotoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(28, 25, 23, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  fotoBadgeTexto: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  placeholdersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  placeholderSlot: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 130,
  },
  placeholderIconoWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderDesc: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 11,
  },
  placeholderPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  placeholderPillTexto: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 10,
  },

  seccion: { gap: spacing.md },
  seccionCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  seccionTitulo: { color: cictatColors.carbon, fontWeight: '800' },

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.ochreSoft,
    borderColor: cictatColors.ochre,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoAlerta: { backgroundColor: cictatColors.terracottaSoft, borderColor: cictatColors.terracotta },
  avisoTexto: { flex: 1, color: cictatColors.carbon, fontWeight: '600' },

  barra: {
    backgroundColor: cictatColors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: cictatColors.carbon,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  barraInner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.md },
  resumen: { gap: 2 },
  resumenTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  resumenAlerta: { color: '#7A4E0E', fontWeight: '600' },
  cta: { borderRadius: radius.md },
  ctaContent: { paddingVertical: spacing.xs + 2 },
  ctaLabel: { fontWeight: '800', fontSize: 16 },
  snackWrapper: { bottom: 150 },
});
