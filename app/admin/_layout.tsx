/**
 * Layout del módulo administrativo (/admin).
 * Protege el acceso para cuentas con `rol = 'administrador'`.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Slot, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ETIQUETA_ROL } from '@/domain/models';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { useAuth } from '@/presentation/context/AuthContext';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

export default function AdminLayout() {
  const router = useRouter();
  const { user, perfil, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={cictatColors.terracotta} />
          <Text variant="bodyMedium" style={styles.subtitulo}>
            Verificando credenciales de Administrador CICTAT…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centro}>
          <View style={[styles.guardiaCard, getTerracottaShadow({ border: 'structural' })]}>
            <View style={styles.iconoCircle}>
              <MaterialCommunityIcons name="shield-lock" size={34} color={cictatColors.ochre} />
            </View>
            <BrushTitle text="Acceso Restringido Admin" highlight="Admin" size="md" />
            <Text variant="bodyMedium" style={styles.subtitulo}>
              El Panel de Administración y Control de Espacios CICTAT es de uso exclusivo para el
              Encargado con perfil de Administrador.
            </Text>
            {perfil ? (
              <Text variant="labelMedium" style={styles.rolActual}>
                Sesión actual: {perfil.nombre_completo} ({ETIQUETA_ROL[perfil.rol]})
              </Text>
            ) : null}
            <Button
              mode="contained"
              icon="shield-key"
              onPress={() =>
                router.push({
                  pathname: '/auth/admin',
                  params: { returnTo: '/admin' },
                })
              }
              buttonColor={cictatColors.terracotta}
              textColor="#FFFFFF"
              style={styles.btn}
              labelStyle={styles.bold}
            >
              Ingresar como Administrador CICTAT
            </Button>
            <Button
              mode="outlined"
              icon="arrow-left"
              onPress={() => router.replace('/')}
              textColor={cictatColors.carbon}
              style={styles.btnSec}
              labelStyle={styles.bold}
            >
              Volver al Catálogo Público
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  guardiaCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitulo: { color: cictatColors.textSecondary },
  rolActual: {
    color: cictatColors.carbon,
    fontWeight: '800',
    backgroundColor: cictatColors.ochreSoft,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  btn: { alignSelf: 'stretch', borderRadius: radius.md },
  btnSec: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderColor: cictatColors.carbon,
  },
  bold: { fontWeight: '800' },
});
