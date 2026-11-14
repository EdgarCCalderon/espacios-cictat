/**
 * <CatalogoFiltros /> — Chips de filtro (Crema / Carbón / Terracota).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { FiltroCatalogo } from '@/domain/usecases';
import { cictatColors, radius, spacing } from '../../theme/cictatTheme';

interface FiltroChipProps {
  etiqueta: string;
  seleccionado: boolean;
  conCandado?: boolean;
  onPress: () => void;
}

const FiltroChip: React.FC<FiltroChipProps> = ({ etiqueta, seleccionado, conCandado, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: seleccionado }}
    style={({ pressed }) => [
      styles.chip,
      seleccionado ? styles.chipActivo : styles.chipInactivo,
      pressed && styles.chipPressed,
    ]}
  >
    <Text
      variant="labelLarge"
      style={[styles.texto, { color: seleccionado ? '#FFFFFF' : cictatColors.carbon }]}
    >
      {etiqueta}
    </Text>
    {conCandado ? (
      <MaterialCommunityIcons
        name="lock"
        size={14}
        color={seleccionado ? '#FFFFFF' : cictatColors.ochre}
      />
    ) : null}
  </Pressable>
);

export interface CatalogoFiltrosProps {
  filtro: FiltroCatalogo;
  onChange: (f: FiltroCatalogo) => void;
  conteos: { todos: number; salas: number; cubiculos: number };
}

export const CatalogoFiltros: React.FC<CatalogoFiltrosProps> = ({ filtro, onChange, conteos }) => (
  <View style={styles.fila} accessibilityRole="tablist">
    <FiltroChip
      etiqueta={`Todos (${conteos.todos})`}
      seleccionado={filtro === 'todos'}
      onPress={() => onChange('todos')}
    />
    <FiltroChip
      etiqueta="Salas CICTAT (1-6)"
      seleccionado={filtro === 'salas'}
      onPress={() => onChange('salas')}
    />
    <FiltroChip
      etiqueta="Cubículos Posgrado (7-9)"
      conCandado
      seleccionado={filtro === 'cubiculos'}
      onPress={() => onChange('cubiculos')}
    />
  </View>
);

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chipInactivo: { backgroundColor: cictatColors.surface },
  chipActivo: { backgroundColor: cictatColors.terracotta },
  chipPressed: { opacity: 0.8 },
  texto: { fontWeight: '700' },
});

export default CatalogoFiltros;
