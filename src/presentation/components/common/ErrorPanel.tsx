/**
 * <ErrorPanel /> — Muestra un error real de Supabase/PostgREST sin ocultar nada:
 * message, details, hint, code y status (más el JSON completo desplegable).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import type { ErrorInfo } from '@/infrastructure/repositories';
import { cictatColors, getTerracottaShadow, radius, spacing } from '../../theme/cictatTheme';

export interface ErrorPanelProps {
  error: ErrorInfo;
  titulo?: string;
  onReintentar?: () => void;
  /** Versión compacta (banner) cuando ya hay datos en pantalla. */
  compacto?: boolean;
}

const MAX_DETALLES = 400;

export const ErrorPanel: React.FC<ErrorPanelProps> = ({ error, titulo, onReintentar, compacto }) => {
  const [verJson, setVerJson] = useState(false);
  const detalles =
    error.detalles && error.detalles.length > MAX_DETALLES
      ? error.detalles.slice(0, MAX_DETALLES) + '…'
      : error.detalles;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, getTerracottaShadow({ border: 'structural' }), compacto && styles.compacto]}
    >
      <View style={styles.row}>
        <MaterialCommunityIcons name="alert-circle" size={22} color={cictatColors.danger} />
        <Text variant="titleSmall" style={styles.titulo}>
          {titulo ?? error.contexto}
        </Text>
      </View>

      <Text variant="bodyMedium" selectable style={styles.mensaje}>
        {error.mensaje}
      </Text>

      {detalles ? (
        <Text variant="bodySmall" selectable style={styles.mono}>
          <Text style={styles.bold}>details: </Text>
          {detalles}
        </Text>
      ) : null}

      {error.hint ? (
        <Text variant="bodySmall" selectable style={styles.mono}>
          <Text style={styles.bold}>hint: </Text>
          {error.hint}
        </Text>
      ) : null}

      {error.code || error.status !== null ? (
        <Text variant="bodySmall" selectable style={styles.mono}>
          {error.code ? `code: ${error.code}   ` : ''}
          {error.status !== null ? `status: ${error.status}` : ''}
        </Text>
      ) : null}

      <Pressable onPress={() => setVerJson((v) => !v)} accessibilityRole="button" hitSlop={8}>
        <Text variant="labelMedium" style={styles.link}>
          {verJson ? 'Ocultar JSON completo' : 'Ver JSON completo'}
        </Text>
      </Pressable>
      {verJson ? (
        <Text variant="bodySmall" selectable style={[styles.mono, styles.json]}>
          {error.json}
        </Text>
      ) : null}

      {onReintentar ? (
        <Button
          mode="contained"
          icon="refresh"
          onPress={onReintentar}
          style={styles.btn}
          labelStyle={styles.bold}
        >
          Reintentar
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  compacto: { padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titulo: { color: cictatColors.carbon, fontWeight: '700', flex: 1 },
  mensaje: { color: cictatColors.carbon, fontWeight: '700' },
  bold: { fontWeight: '700' },
  mono: {
    color: cictatColors.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  json: {
    backgroundColor: cictatColors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  link: { color: cictatColors.terracotta, fontWeight: '700', textDecorationLine: 'underline' },
  btn: { alignSelf: 'flex-start', marginTop: spacing.xs },
});

export default ErrorPanel;
