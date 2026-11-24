/**
 * Badges reutilizables del catálogo: candado de exclusividad y estado operativo.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { cictatColors, radius, spacing } from '../../theme/cictatTheme';

export interface BadgeExclusivoProps {
  /** `true` cuando el usuario actual es Alumno de Posgrado o Administrador. */
  desbloqueado?: boolean;
}

/**
 * Cubículos 7-9:
 *  - Bloqueado: "🔒 Exclusivo Alumnos de Posgrado" (Ocre con borde Negro Carbón)
 *  - Desbloqueado: "🔓 Acceso Posgrado Habilitado"
 */
export const BadgeExclusivo: React.FC<BadgeExclusivoProps> = ({ desbloqueado = false }) =>
  desbloqueado ? (
    <View
      style={[styles.exclusivo, styles.exclusivoAbierto]}
      accessibilityLabel="Acceso posgrado habilitado"
      accessible
    >
      <MaterialCommunityIcons name="lock-open-variant" size={14} color={cictatColors.verde1} />
      <Text variant="labelMedium" style={styles.exclusivoAbiertoTexto}>
        Acceso Posgrado Habilitado
      </Text>
    </View>
  ) : (
    <View
      style={styles.exclusivo}
      accessibilityLabel="Exclusivo para alumnos de posgrado"
      accessible
    >
      <MaterialCommunityIcons name="lock" size={14} color="#FFFFFF" />
      <Text variant="labelMedium" style={styles.exclusivoTexto}>
        Exclusivo Alumnos de Posgrado
      </Text>
    </View>
  );

/** Disponible (verde institucional) / En Mantenimiento (naranja advertencia). */
export const BadgeEstadoEspacio: React.FC<{ activo: boolean }> = ({ activo }) =>
  activo ? (
    <View style={[styles.estado, styles.estadoOk]}>
      <View style={[styles.dot, { backgroundColor: cictatColors.verde1 }]} />
      <Text variant="labelMedium" style={[styles.estadoTexto, { color: cictatColors.verde1 }]}>
        Disponible
      </Text>
    </View>
  ) : (
    <View style={[styles.estado, styles.estadoMant]}>
      <MaterialCommunityIcons name="wrench" size={13} color={cictatColors.warning} />
      <Text variant="labelMedium" style={[styles.estadoTexto, { color: cictatColors.warning }]}>
        En Mantenimiento
      </Text>
    </View>
  );

const styles = StyleSheet.create({
  exclusivo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.verde2,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  exclusivoAbierto: {
    backgroundColor: cictatColors.verde1Soft,
    borderColor: cictatColors.verde1,
  },
  exclusivoTexto: { color: '#FFFFFF', fontWeight: '800' },
  exclusivoAbiertoTexto: { color: cictatColors.verde1, fontWeight: '800' },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  estadoOk: { backgroundColor: cictatColors.verde1Soft, borderColor: cictatColors.verde1 },
  estadoMant: { backgroundColor: cictatColors.warningSoft, borderColor: cictatColors.warning },
  estadoTexto: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
