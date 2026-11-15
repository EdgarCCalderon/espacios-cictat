/**
 * Componentes compartidos de presentación para las pantallas de `/auth/*`.
 * Sistema de Diseño CICTAT: Crema (#FAF7F2), Superficie (#F3EFE6),
 * Negro Carbón (#1C1917), Ocre (#C88A32) y Naranja Terracota (#E05A2B).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import React, { useState, type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ErrorAuthInfo } from '@/domain/errors/ErrorAuth';
import { cictatColors, getTerracottaShadow, radius, spacing } from '../../theme/cictatTheme';

export interface AuthScreenContainerProps extends PropsWithChildren {
  /** Texto junto al botón de regreso. */
  etiquetaVolver?: string;
  /** Acción personalizada al volver (por defecto regresa o va a `/`). */
  onVolver?: () => void;
  /** Ancho máximo del contenedor central. */
  maxWidth?: number;
}

export const AuthScreenContainer: React.FC<AuthScreenContainerProps> = ({
  etiquetaVolver = 'Volver',
  onVolver,
  maxWidth = 540,
  children,
}) => {
  const router = useRouter();

  const manejarVolver = () => {
    if (onVolver) {
      onVolver();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { maxWidth }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={manejarVolver}
              accessibilityRole="button"
              accessibilityLabel={etiquetaVolver}
              style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={18}
                color={cictatColors.carbon}
                style={styles.backIcon}
              />
              <Text variant="labelLarge" style={styles.backText}>
                {etiquetaVolver}
              </Text>
            </Pressable>

            <View style={styles.institucionalTag}>
              <MaterialCommunityIcons name="shield-check-outline" size={15} color={cictatColors.ochre} />
              <Text variant="labelSmall" style={styles.institucionalTexto}>
                DACyTI · UJAT
              </Text>
            </View>
          </View>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Banner de error de autenticación
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthErrorBannerProps {
  error: ErrorAuthInfo | null;
  accionTexto?: string;
  onAccion?: () => void;
}

export const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({
  error,
  accionTexto,
  onAccion,
}) => {
  const [verDetalle, setVerDetalle] = useState(false);
  if (!error) return null;

  return (
    <View
      style={[styles.errorBanner, getTerracottaShadow({ border: 'structural', intensity: 0.7 })]}
      accessibilityRole="alert"
    >
      <View style={styles.errorHeader}>
        <MaterialCommunityIcons name="alert-circle" size={20} color={cictatColors.danger} />
        <Text variant="bodyMedium" style={styles.errorMensaje}>
          {error.mensaje}
        </Text>
      </View>

      {accionTexto && onAccion ? (
        <Button
          mode="outlined"
          compact
          icon="arrow-right-circle-outline"
          onPress={onAccion}
          textColor={cictatColors.carbon}
          style={styles.errorAccionBtn}
          labelStyle={styles.bold}
        >
          {accionTexto}
        </Button>
      ) : null}

      {error.detalleTecnico ? (
        <View style={styles.detalleWrap}>
          <Pressable
            onPress={() => setVerDetalle((v) => !v)}
            accessibilityRole="button"
            style={styles.detalleToggle}
          >
            <Text variant="labelSmall" style={styles.detalleToggleTexto}>
              {verDetalle ? 'Ocultar diagnóstico técnico ▲' : 'Ver diagnóstico técnico ▼'}
            </Text>
          </Pressable>
          {verDetalle ? (
            <View style={styles.detalleCaja}>
              <Text variant="bodySmall" style={styles.detalleCodigo} selectable>
                {error.detalleTecnico}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Banner de confirmación de correo pendiente
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthConfirmacionBannerProps {
  mensaje: string | null;
  onIrALogin?: () => void;
}

export const AuthConfirmacionBanner: React.FC<AuthConfirmacionBannerProps> = ({
  mensaje,
  onIrALogin,
}) => {
  if (!mensaje) return null;

  return (
    <View style={[styles.confirmBanner, getTerracottaShadow({ border: 'structural' })]}>
      <View style={styles.confirmHeader}>
        <MaterialCommunityIcons name="email-check-outline" size={24} color={cictatColors.carbon} />
        <Text variant="titleSmall" style={styles.confirmTitulo}>
          Confirma tu correo electrónico
        </Text>
      </View>
      <Text variant="bodyMedium" style={styles.confirmTexto}>
        {mensaje}
      </Text>
      {onIrALogin ? (
        <Button
          mode="contained"
          icon="login"
          onPress={onIrALogin}
          buttonColor={cictatColors.carbon}
          textColor="#FFFFFF"
          labelStyle={styles.bold}
        >
          Ya confirmé mi correo · Iniciar sesión
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  flex: { flex: 1 },
  scrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.78 },
  backIcon: { margin: 0 },
  backText: { color: cictatColors.carbon, fontWeight: '800' },
  institucionalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.borderSoft,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  institucionalTexto: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  errorBanner: {
    backgroundColor: '#FDF2F0',
    borderColor: cictatColors.danger,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  errorMensaje: {
    flex: 1,
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  errorAccionBtn: {
    alignSelf: 'flex-start',
    borderColor: cictatColors.carbon,
    backgroundColor: cictatColors.surfaceElevated,
  },
  detalleWrap: { gap: spacing.xs },
  detalleToggle: { paddingVertical: 2 },
  detalleToggleTexto: {
    color: cictatColors.textSecondary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  detalleCaja: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  detalleCodigo: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: cictatColors.carbon,
    fontSize: 11,
  },
  confirmBanner: {
    backgroundColor: cictatColors.ochreSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmTitulo: { color: cictatColors.carbon, fontWeight: '800', flex: 1 },
  confirmTexto: { color: cictatColors.carbon },
  bold: { fontWeight: '800' },
});
