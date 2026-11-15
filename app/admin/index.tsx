/**
 * Panel de Administración y Control Multiplataforma (/admin).
 *
 * Estructura adaptativa:
 *  - Web / Pantallas Anchas (width >= 768px): Barra Lateral Fija (Sidebar
 *    izquierda de 260px) con fondo #F3EFE6, borde derecho #1C1917, logo
 *    <BrushTitle /> ("Admin CICTAT"), datos del encargado activo, las 4 vistas
 *    con indicador activo en Naranja Terracota (#E05A2B) y botón de Cerrar
 *    Sesión al pie.
 *  - Móvil / iPhone (width < 768px): Header compacto superior y barra de
 *    navegación adaptable con las 4 vistas al alcance del pulgar.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActivityIndicator, Button, IconButton, Snackbar, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BandejaSolicitudesView } from '@/presentation/components/admin/BandejaSolicitudesView';
import { CalendarioMaestroView } from '@/presentation/components/admin/CalendarioMaestroView';
import { GestionEspaciosView } from '@/presentation/components/admin/GestionEspaciosView';
import { ReportesEstadisticasView } from '@/presentation/components/admin/ReportesEstadisticasView';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { ErrorPanel } from '@/presentation/components/common/ErrorPanel';
import { EstadoVivoBadge } from '@/presentation/components/common/EstadoVivoBadge';
import { useAuth } from '@/presentation/context/AuthContext';
import {
  usePanelAdminController,
  type VistaPanelAdmin,
} from '@/presentation/controllers/usePanelAdminController';
import {
  cictatColors,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ItemNavAdmin {
  id: VistaPanelAdmin;
  titulo: string;
  tituloCorto: string;
  icono: IconName;
  badge?: number;
}

export default function PanelAdminScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, perfil, signOut } = useAuth();

  const ctrl = usePanelAdminController();
  const esDesktop = width >= 768;

  const itemsNav: ItemNavAdmin[] = [
    {
      id: 'bandeja',
      titulo: 'Bandeja de Solicitudes',
      tituloCorto: 'Bandeja',
      icono: 'clipboard-check-multiple-outline',
      badge: ctrl.conteos.pendiente,
    },
    {
      id: 'calendario',
      titulo: 'Calendario Maestro',
      tituloCorto: 'Calendario',
      icono: 'calendar-clock',
    },
    {
      id: 'espacios',
      titulo: 'Catálogo y Mantenimiento',
      tituloCorto: 'Espacios',
      icono: 'office-building-cog-outline',
    },
    {
      id: 'reportes',
      titulo: 'Reportes y Estadísticas',
      tituloCorto: 'Reportes',
      icono: 'chart-bar',
    },
  ];

  const manejarCerrarSesion = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      console.warn('[Admin] Error al cerrar sesión:', e);
    }
  };

  const renderContenidoVista = () => {
    if (ctrl.cargando && ctrl.solicitudes.length === 0 && ctrl.espacios.length === 0) {
      return (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={cictatColors.terracotta} />
          <Text variant="bodyMedium" style={styles.muted}>
            Cargando datos administrativos de CICTAT…
          </Text>
        </View>
      );
    }

    switch (ctrl.vistaActiva) {
      case 'bandeja':
        return (
          <BandejaSolicitudesView
            solicitudes={ctrl.solicitudesFiltradas}
            filtroEstado={ctrl.filtroEstado}
            onChangeFiltro={ctrl.setFiltroEstado}
            conteos={ctrl.conteos}
            procesandoId={ctrl.procesandoId}
            onDictaminar={ctrl.dictaminarSolicitud}
            onObtenerUrlDocumento={ctrl.obtenerUrlDocumento}
          />
        );
      case 'calendario':
        return (
          <CalendarioMaestroView
            espacios={ctrl.espacios}
            solicitudes={ctrl.solicitudes}
            fechaISO={ctrl.fechaCalendarioMaestro}
            onChangeFecha={ctrl.setFechaCalendarioMaestro}
            onIrABandeja={() => {
              ctrl.setFiltroEstado('pendiente');
              ctrl.setVistaActiva('bandeja');
            }}
          />
        );
      case 'espacios':
        return (
          <GestionEspaciosView
            espacios={ctrl.espacios}
            procesandoId={ctrl.procesandoId}
            onToggleEstado={ctrl.toggleEstadoEspacio}
            onActualizarEspacio={ctrl.actualizarEspacioCatalogo}
          />
        );
      case 'reportes':
        return (
          <ReportesEstadisticasView
            reporte={ctrl.reporte}
            fechaInicioISO={ctrl.fechaInicioReporte}
            fechaFinISO={ctrl.fechaFinReporte}
            onActualizarRango={ctrl.actualizarRangoReporte}
          />
        );
    }
  };

  const tituloVistaActual =
    itemsNav.find((i) => i.id === ctrl.vistaActiva)?.titulo ?? 'Panel Administrativo';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.root, esDesktop && styles.rootDesktop]}>
        {/* ── Sidebar Fija (Web / Desktop >= 768px) ─────────────────────────── */}
        {esDesktop ? (
          <View style={styles.sidebar}>
            <View style={styles.sidebarTop}>
              <BrushTitle text="Admin CICTAT" highlight="CICTAT" size="md" />
              <Text variant="labelSmall" style={styles.sidebarSub}>
                DACyTI · UJAT · CONTROL CENTRAL
              </Text>

              {/* Datos del encargado activo */}
              <View style={styles.encargadoCard}>
                <View style={styles.encargadoAvatar}>
                  <MaterialCommunityIcons
                    name="shield-account"
                    size={22}
                    color={cictatColors.ochre}
                  />
                </View>
                <View style={styles.encargadoTextos}>
                  <Text variant="labelLarge" style={styles.encargadoNombre} numberOfLines={1}>
                    {perfil?.nombre_completo ?? user?.email ?? 'Encargado CICTAT'}
                  </Text>
                  <Text variant="labelSmall" style={styles.encargadoRol} numberOfLines={1}>
                    Administrador · {perfil?.correo ?? user?.email ?? ''}
                  </Text>
                </View>
              </View>

              {/* 4 botones de navegación */}
              <View style={styles.navVertical}>
                {itemsNav.map((item) => {
                  const activo = ctrl.vistaActiva === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => ctrl.setVistaActiva(item.id)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: activo }}
                      style={({ pressed }) => [
                        styles.navBtn,
                        activo && styles.navBtnActivo,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icono}
                        size={20}
                        color={activo ? '#FFFFFF' : cictatColors.carbon}
                      />
                      <Text
                        variant="labelLarge"
                        style={[styles.navBtnTexto, activo && styles.navBtnTextoActivo]}
                      >
                        {item.titulo}
                      </Text>
                      {item.badge !== undefined && item.badge > 0 ? (
                        <View
                          style={[
                            styles.navBadge,
                            activo ? styles.navBadgeActivo : styles.navBadgeInactivo,
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{
                              color: activo ? cictatColors.terracotta : '#FFFFFF',
                              fontWeight: '800',
                            }}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Pie de la Sidebar: Ir al catálogo y Cerrar sesión */}
            <View style={styles.sidebarFooter}>
              <Button
                mode="outlined"
                icon="storefront-outline"
                onPress={() => router.push('/')}
                textColor={cictatColors.carbon}
                style={styles.btnCatalogoSidebar}
                labelStyle={styles.bold}
              >
                Ver Catálogo Público
              </Button>
              <Button
                mode="contained"
                icon="logout"
                onPress={() => void manejarCerrarSesion()}
                buttonColor={cictatColors.carbon}
                textColor="#ffffff"
                style={styles.btnSalirSidebar}
                labelStyle={styles.bold}
              >
                Cerrar Sesión
              </Button>
            </View>
          </View>
        ) : null}

        {/* ── Área Principal ────────────────────────────────────────────────── */}
        <View style={styles.mainArea}>
          {/* Header compacto en móvil o barra superior de estado en Desktop */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              {!esDesktop ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  iconColor={cictatColors.carbon}
                  onPress={() => router.push('/')}
                  style={styles.mobileBackBtn}
                />
              ) : null}
              <View>
                <Text variant={esDesktop ? 'headlineSmall' : 'titleMedium'} style={styles.bold}>
                  {esDesktop ? tituloVistaActual : 'Admin CICTAT'}
                </Text>
                {!esDesktop ? (
                  <Text variant="labelSmall" style={styles.muted}>
                    {tituloVistaActual}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.topHeaderRight}>
              <EstadoVivoBadge estado={ctrl.estadoVivo} detalle={ctrl.detalleVivo} />
              <IconButton
                icon="refresh"
                size={20}
                iconColor={cictatColors.carbon}
                onPress={() => void ctrl.recargar()}
                accessibilityLabel="Actualizar datos"
                style={styles.refreshBtn}
              />
              {!esDesktop ? (
                <IconButton
                  icon="logout"
                  size={20}
                  iconColor="#e81313"
                  containerColor={cictatColors.carbon}
                  onPress={() => void manejarCerrarSesion()}
                  accessibilityLabel="Cerrar sesión"
                />
              ) : null}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={ctrl.refrescando}
                onRefresh={() => void ctrl.recargar()}
                tintColor={cictatColors.terracotta}
                colors={[cictatColors.terracotta]}
              />
            }
          >
            {ctrl.error ? (
              <ErrorPanel error={ctrl.error} onReintentar={() => void ctrl.recargar()} />
            ) : null}

            {renderContenidoVista()}
          </ScrollView>

          {/* Barra inferior de navegación en Móvil (< 768px) */}
          {!esDesktop ? (
            <View
              style={[
                styles.bottomNavMobile,
                { paddingBottom: Math.max(insets.bottom, spacing.xs + 2) },
              ]}
            >
              {itemsNav.map((item) => {
                const activo = ctrl.vistaActiva === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => ctrl.setVistaActiva(item.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: activo }}
                    style={[styles.mobileTab, activo && styles.mobileTabActivo]}
                  >
                    <View style={styles.mobileTabIconWrap}>
                      <MaterialCommunityIcons
                        name={item.icono}
                        size={20}
                        color={activo ? '#FFFFFF' : cictatColors.carbon}
                      />
                      {item.badge !== undefined && item.badge > 0 ? (
                        <View style={styles.mobileBadge}>
                          <Text variant="labelSmall" style={styles.mobileBadgeTexto}>
                            {item.badge}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      variant="labelSmall"
                      style={[styles.mobileTabTexto, activo && styles.mobileTabTextoActivo]}
                      numberOfLines={1}
                    >
                      {item.tituloCorto}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      <Snackbar
        visible={!!ctrl.mensajeExito}
        onDismiss={ctrl.limpiarMensajeExito}
        duration={4000}
      >
        {ctrl.mensajeExito ?? ''}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  root: { flex: 1 },
  rootDesktop: { flexDirection: 'row' },
  bold: { fontWeight: '800', color: cictatColors.carbon },
  muted: { color: cictatColors.textSecondary },
  pressed: { opacity: 0.8 },
  centro: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },

  // Sidebar fija izquierda (260px)
  sidebar: {
    width: 260,
    backgroundColor: cictatColors.surface,
    borderRightWidth: 1.5,
    borderRightColor: cictatColors.carbon,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  sidebarTop: { gap: spacing.md },
  sidebarSub: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: -4,
  },
  encargadoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  encargadoAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encargadoTextos: { flex: 1, gap: 1 },
  encargadoNombre: { color: cictatColors.carbon, fontWeight: '800' },
  encargadoRol: { color: cictatColors.textSecondary },

  navVertical: { gap: spacing.xs + 2, marginTop: spacing.xs },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  navBtnActivo: {
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
  },
  navBtnTexto: { flex: 1, color: cictatColors.carbon, fontWeight: '800' },
  navBtnTextoActivo: { color: '#FFFFFF' },
  navBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  navBadgeActivo: { backgroundColor: '#FFFFFF' },
  navBadgeInactivo: { backgroundColor: cictatColors.terracotta },

  sidebarFooter: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: cictatColors.borderSoft },
  btnCatalogoSidebar: {
    borderRadius: radius.md,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    backgroundColor: cictatColors.surfaceElevated,
  },
  btnSalirSidebar: {
    borderRadius: radius.md,
  },

  // Área principal
  mainArea: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: cictatColors.surfaceElevated,
    borderBottomWidth: 1.5,
    borderBottomColor: cictatColors.carbon,
  },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  topHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mobileBackBtn: {
    margin: 0,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    backgroundColor: cictatColors.surface,
  },
  refreshBtn: {
    margin: 0,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },

  // Barra inferior móvil
  bottomNavMobile: {
    flexDirection: 'row',
    backgroundColor: cictatColors.surface,
    borderTopWidth: 1.5,
    borderTopColor: cictatColors.carbon,
    paddingTop: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
  mobileTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    gap: 2,
  },
  mobileTabActivo: {
    backgroundColor: cictatColors.terracotta,
  },
  mobileTabIconWrap: { position: 'relative' },
  mobileBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: cictatColors.carbon,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
  },
  mobileBadgeTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  mobileTabTexto: { color: cictatColors.carbon, fontWeight: '800', fontSize: 11 },
  mobileTabTextoActivo: { color: '#FFFFFF' },
});
