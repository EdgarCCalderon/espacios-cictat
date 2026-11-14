/**
 * Catálogo Digital de Espacios CICTAT (pantalla principal, pública).
 *
 * Vista MVC: no conoce Supabase; consume `useCatalogoController` y las reglas
 * de acceso del dominio. Los Cubículos 7-9 son visibles para todos pero sólo
 * accesibles para Alumnos de Posgrado / Administradores.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Espacio } from '@/domain/models';
import { puedeAccederAEspacio } from '@/domain/usecases';
import { AccesoPosgradoDialog } from '@/presentation/components/common/AccesoDialogs';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { ErrorPanel } from '@/presentation/components/common/ErrorPanel';
import { EstadoVivoBadge } from '@/presentation/components/common/EstadoVivoBadge';
import { CatalogoFiltros } from '@/presentation/components/catalogo/CatalogoFiltros';
import { EspacioCard } from '@/presentation/components/catalogo/EspacioCard';
import { SesionButton } from '@/presentation/components/catalogo/SesionButton';
import { useAuth } from '@/presentation/context/AuthContext';
import { useCatalogoController } from '@/presentation/controllers/useCatalogoController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

export default function CatalogoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { perfil, isAdmin, isLoading: authCargando } = useAuth();
  const rol = perfil?.rol ?? null;

  const {
    espacios,
    conteos,
    filtro,
    setFiltro,
    cargando,
    refrescando,
    error,
    estadoVivo,
    detalleVivo,
    recargar,
  } = useCatalogoController();

  const [espacioCandadoId, setEspacioCandadoId] = useState<string | null>(null);

  const irASelectorDeAcceso = useCallback(() => {
    setEspacioCandadoId(null);
    router.push('/auth/selector');
  }, [router]);

  const irALoginAlumnoPosgrado = useCallback(() => {
    const idDestino = espacioCandadoId;
    setEspacioCandadoId(null);
    router.push({
      pathname: '/auth/ujat',
      params: idDestino
        ? { rol: 'estudiante_posgrado', espacioId: idDestino }
        : { rol: 'estudiante_posgrado' },
    });
  }, [espacioCandadoId, router]);

  const abrirEspacio = useCallback(
    (espacio: Espacio) => {
      if (!espacio.esta_activo) return;
      if (!puedeAccederAEspacio(espacio, rol)) {
        // Mientras se resuelve el perfil no sabemos aún el rol: no molestar con el diálogo.
        if (authCargando) return;
        setEspacioCandadoId(espacio.id);
        return;
      }
      router.push({ pathname: '/espacio/[id]', params: { id: espacio.id } });
    },
    [rol, authCargando, router],
  );

  const dosColumnas = width >= 900;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={recargar}
            tintColor={cictatColors.terracotta}
            colors={[cictatColors.terracotta]}
          />
        }
      >
        {/* Barra superior: acceso a Panel de Administración (si es admin) + sesión */}
        <View style={styles.topBar}>
          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/admin')}
              accessibilityRole="button"
              accessibilityLabel="Abrir Panel de Administración"
              style={({ pressed }) => [
                styles.adminHeaderBtn,
                getTerracottaShadow({ border: 'structural', intensity: 1.1 }),
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons name="shield-crown" size={18} color="#FFFFFF" />
              <Text variant="labelLarge" style={styles.adminHeaderBtnTexto}>
                Panel de Administración
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <SesionButton onIniciarSesion={irASelectorDeAcceso} />
        </View>

        {/* Encabezado */}
        <View style={styles.header}>
          <BrushTitle text="Espacios CICTAT" highlight="CICTAT" size={width >= 600 ? 'xl' : 'lg'} />
          <Text variant="bodyLarge" style={styles.subtitulo}>
            Reserva de salas y cubículos de posgrado · DACyTI — UJAT
          </Text>
        </View>

        {/* Filtros */}
        <CatalogoFiltros filtro={filtro} onChange={setFiltro} conteos={conteos} />

        <View style={styles.filaEstado}>
          <Text variant="labelMedium" style={styles.contador}>
            {espacios.length} espacio{espacios.length === 1 ? '' : 's'}
          </Text>
          <EstadoVivoBadge estado={estadoVivo} detalle={detalleVivo} />
        </View>

        {/* Contenido */}
        {cargando && espacios.length === 0 ? (
          <View style={styles.centro}>
            <ActivityIndicator animating color={cictatColors.terracotta} size="large" />
            <Text variant="bodyMedium" style={styles.muted}>
              Cargando catálogo…
            </Text>
          </View>
        ) : error && espacios.length === 0 ? (
          <ErrorPanel error={error} onReintentar={recargar} />
        ) : (
          <>
            {error ? <ErrorPanel error={error} compacto onReintentar={recargar} /> : null}

            {espacios.length === 0 ? (
              <View style={styles.centro}>
                <Text variant="bodyLarge" style={styles.muted}>
                  No hay espacios para mostrar en este filtro.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {espacios.map((espacio) => (
                  <View key={espacio.id} style={dosColumnas ? styles.celdaDoble : styles.celda}>
                    <EspacioCard
                      espacio={espacio}
                      bloqueadoParaUsuario={!puedeAccederAEspacio(espacio, rol)}
                      onPress={abrirEspacio}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Text variant="bodySmall" style={styles.pie}>
          Las reservas requieren mínimo 24 horas de anticipación. Ventana operativa: 08:00 a 15:00 hrs.
        </Text>
      </ScrollView>

      <AccesoPosgradoDialog
        visible={!!espacioCandadoId}
        onDismiss={() => setEspacioCandadoId(null)}
        rolActual={rol}
        onIniciarSesion={irALoginAlumnoPosgrado}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
  },
  adminHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md + 4,
  },
  adminHeaderBtnTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pressed: { opacity: 0.8 },
  header: { gap: spacing.md },
  subtitulo: { color: cictatColors.textSecondary },
  filaEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  contador: { color: cictatColors.textSecondary, fontWeight: '700' },
  centro: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  muted: { color: cictatColors.textSecondary, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  celda: { width: '100%' },
  celdaDoble: { width: '48.5%' },
  pie: { color: cictatColors.textSecondary, textAlign: 'center', marginTop: spacing.md },
});
