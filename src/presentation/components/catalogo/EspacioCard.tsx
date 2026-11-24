/**
 * <EspacioCard /> — Tarjeta de un espacio en el catálogo digital.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { Espacio } from '@/domain/models';
import { cictatColors, getTerracottaShadow, radius, spacing } from '../../theme/cictatTheme';
import { BadgeEstadoEspacio, BadgeExclusivo } from './Badges';

export interface EspacioCardProps {
  espacio: Espacio;
  /** `true` si el espacio es exclusivo y el usuario actual no tiene acceso. */
  bloqueadoParaUsuario: boolean;
  onPress: (espacio: Espacio) => void;
}

const etiquetaTipo = (e: Espacio) =>
  e.tipo_espacio === 'cubiculo_estudio' ? 'Cubículo de estudio' : 'Sala de posgrado';

export const EspacioCard: React.FC<EspacioCardProps> = ({ espacio, bloqueadoParaUsuario, onPress }) => {
  const activo = espacio.esta_activo;

  return (
    <Pressable
      onPress={() => onPress(espacio)}
      accessibilityRole="button"
      accessibilityLabel={`${espacio.nombre}, ${espacio.capacidad} personas${
        espacio.exclusivo_alumnos_posgrado ? ', exclusivo para alumnos de posgrado' : ''
      }${activo ? '' : ', en mantenimiento'}`}
      accessibilityState={{ disabled: !activo }}
      style={({ pressed }) => [
        styles.card,
        getTerracottaShadow({ border: 'structural' }),
        pressed && activo && styles.pressed,
        !activo && styles.inactiva,
      ]}
    >
      <View style={styles.cuerpo}>
        <View style={styles.filaSuperior}>
          <View style={styles.codigo}>
            <Text variant="labelMedium" style={styles.codigoTexto}>
              {espacio.codigo_espacio}
            </Text>
          </View>
          <BadgeEstadoEspacio activo={activo} />
        </View>

        <Text variant="titleLarge" style={styles.nombre}>
          {espacio.nombre}
        </Text>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account-group" size={18} color={cictatColors.ochre} />
            <Text variant="bodyMedium" style={styles.metaTexto}>
              {espacio.capacidad} personas
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.tipo}>
            {etiquetaTipo(espacio)}
          </Text>
        </View>

        {espacio.exclusivo_alumnos_posgrado ? (
          <BadgeExclusivo desbloqueado={!bloqueadoParaUsuario} />
        ) : null}

        {espacio.equipamiento_incluido ? (
          <View style={styles.equipo}>
            <MaterialCommunityIcons
              name={espacio.tipo_espacio === 'sala_posgrado' ? 'projector-screen-outline' : 'power-plug'}
              size={18}
              color={cictatColors.textSecondary}
            />
            <Text variant="bodySmall" style={styles.equipoTexto}>
              {espacio.equipamiento_incluido}
            </Text>
          </View>
        ) : null}

        <View style={styles.pie}>
          {!activo ? (
            <Text variant="labelMedium" style={styles.pieMuted}>
              No disponible por mantenimiento
            </Text>
          ) : bloqueadoParaUsuario ? (
            <View style={styles.pieAccion}>
              <MaterialCommunityIcons name="lock" size={16} color={cictatColors.carbon} />
              <Text variant="labelLarge" style={styles.pieTexto}>
                Inicia sesión para consultar
              </Text>
            </View>
          ) : (
            <View style={styles.pieAccion}>
              <Text variant="labelLarge" style={[styles.pieTexto, { color: cictatColors.terracotta }]}>
                Ver disponibilidad
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={cictatColors.terracotta} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: { transform: [{ scale: 0.99 }], backgroundColor: cictatColors.surface },
  inactiva: { opacity: 0.7 },
  imagen: { width: '100%', height: 140, backgroundColor: cictatColors.surface },
  cuerpo: { padding: spacing.lg, gap: spacing.md },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  nombre: { color: cictatColors.carbon, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  metaTexto: { color: cictatColors.carbon, fontWeight: '700' },
  tipo: { color: cictatColors.textSecondary },
  equipo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  equipoTexto: { color: cictatColors.textSecondary, flex: 1 },
  pie: {
    borderTopWidth: 1,
    borderTopColor: cictatColors.borderSoft,
    paddingTop: spacing.md,
    alignItems: 'flex-end',
  },
  pieAccion: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pieTexto: { color: cictatColors.carbon, fontWeight: '800' },
  pieMuted: { color: cictatColors.textSecondary, fontStyle: 'italic' },
});

export default EspacioCard;
