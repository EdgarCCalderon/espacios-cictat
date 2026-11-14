/**
 * <SesionButton /> — Cabecera de sesión del catálogo:
 *  - Sin sesión: botón "Iniciar Sesión" → `/auth/selector`
 *  - Con sesión activa: Card/Chip compacto con el nombre del usuario, badge de
 *    rol (`Alumno Posgrado`, `Doctor Posgrado`, `Público General` o
 *    `Administrador`), matrícula (si aplica) y botón "Salir" (`signOut`).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { RolUsuario } from '@/domain/models';
import { useAuth } from '../../context/AuthContext';
import { cictatColors, getTerracottaShadow, radius, spacing } from '../../theme/cictatTheme';

export interface SesionButtonProps {
  onIniciarSesion: () => void;
}

const ETIQUETA_BADGE_ROL: Record<RolUsuario, string> = {
  estudiante_posgrado: 'Alumno Posgrado',
  doctor_posgrado: 'Doctor Posgrado',
  publico_general: 'Público General',
  administrador: 'Administrador',
};

export const SesionButton: React.FC<SesionButtonProps> = ({ onIniciarSesion }) => {
  const { user, perfil, isLoading, signOut } = useAuth();
  const [saliendo, setSaliendo] = useState(false);

  if (!user) {
    return (
      <Pressable
        onPress={onIniciarSesion}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión"
        style={({ pressed }) => [
          styles.botonLogin,
          getTerracottaShadow({ border: 'structural', intensity: 0.7 }),
          pressed && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons name="login" size={18} color={cictatColors.carbon} />
        <Text variant="labelLarge" style={styles.textoCarbon}>
          Iniciar Sesión
        </Text>
      </Pressable>
    );
  }

  const nombre = perfil?.nombre_completo?.trim() || user.email || 'Usuario autenticado';
  const rolBadge = perfil
    ? ETIQUETA_BADGE_ROL[perfil.rol]
    : isLoading
      ? 'Cargando perfil…'
      : 'Sesión activa';
  const matricula = perfil?.matricula?.trim() || null;

  const esDestacado =
    perfil?.rol === 'estudiante_posgrado' || perfil?.rol === 'administrador';

  const manejarSalir = async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await signOut();
    } catch (e) {
      console.warn('[Auth] signOut falló:', e);
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <View
      style={[
        styles.sesionCard,
        getTerracottaShadow({ border: 'structural', intensity: 0.75 }),
      ]}
    >
      <View style={styles.infoWrap}>
        <View style={styles.filaNombre}>
          <MaterialCommunityIcons
            name="account-check"
            size={18}
            color={cictatColors.terracotta}
          />
          <Text variant="labelLarge" style={styles.nombreTexto} numberOfLines={1}>
            {nombre}
          </Text>
        </View>

        <View style={styles.filaMeta}>
          <View
            style={[
              styles.rolChip,
              esDestacado ? styles.rolChipOchre : styles.rolChipSurface,
            ]}
          >
            <Text variant="labelSmall" style={styles.rolChipTexto}>
              {rolBadge}
            </Text>
          </View>

          {matricula ? (
            <View style={styles.matriculaChip}>
              <Text variant="labelSmall" style={styles.matriculaTexto}>
                {matricula}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => void manejarSalir()}
        disabled={saliendo}
        accessibilityRole="button"
        accessibilityLabel="Salir de la sesión"
        style={({ pressed }) => [styles.botonSalir, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="logout" size={16} color="#FFFFFF" />
        <Text variant="labelMedium" style={styles.textoSalir}>
          {saliendo ? '…' : 'Salir'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  botonLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 4,
  },
  pressed: { opacity: 0.75 },
  textoCarbon: { color: cictatColors.carbon, fontWeight: '800' },

  sesionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: '100%',
    flexShrink: 1,
  },
  infoWrap: {
    flexShrink: 1,
    gap: 4,
  },
  filaNombre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
  },
  nombreTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
    flexShrink: 1,
  },
  filaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  rolChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm + 2,
  },
  rolChipOchre: {
    backgroundColor: cictatColors.ochre,
  },
  rolChipSurface: {
    backgroundColor: cictatColors.surface,
  },
  rolChipTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  matriculaChip: {
    backgroundColor: cictatColors.ochreSoft,
    borderColor: cictatColors.ochre,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  matriculaTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  botonSalir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  textoSalir: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default SesionButton;
