/**
 * <EstadoVivoBadge /> — Indicador del estado de la conexión Realtime.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { EstadoEnVivo } from '@/domain/repositories';
import { cictatColors, radius, spacing } from '../../theme/cictatTheme';

const CONFIG: Record<EstadoEnVivo, { color: string; texto: string }> = {
  en_vivo: { color: cictatColors.success, texto: 'En vivo' },
  conectando: { color: cictatColors.ochre, texto: 'Conectando…' },
  error: { color: cictatColors.danger, texto: 'Sin tiempo real · se actualiza cada 30 s' },
};

export const EstadoVivoBadge: React.FC<{ estado: EstadoEnVivo; detalle?: string | null }> = ({
  estado,
  detalle,
}) => {
  const { color, texto } = CONFIG[estado];
  return (
    <View
      style={styles.row}
      accessibilityLabel={`Tiempo real: ${texto}${detalle ? `. ${detalle}` : ''}`}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="labelSmall" style={styles.texto}>
        {texto}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  texto: { color: cictatColors.textSecondary, fontWeight: '600' },
});

export default EstadoVivoBadge;
