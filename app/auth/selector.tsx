/**
 * A-01: Selector de Tipo de Usuario (/auth/selector).
 *
 * Permite elegir el perfil con el que se ingresará a Espacios CICTAT y preserva
 * los parámetros de redirección (`returnTo`, `espacioId`, `fecha`) hacia el
 * formulario correspondiente.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { AuthScreenContainer } from '@/presentation/components/auth/AuthLayout';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { normalizarParametro } from '@/presentation/controllers/useAuthController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface TarjetaPerfilProps {
  titulo: string;
  descripcion: string;
  badge: string;
  icono: IconName;
  acento: 'terracotta' | 'ochre' | 'surface';
  onPress: () => void;
}

const TarjetaPerfil: React.FC<TarjetaPerfilProps> = ({
  titulo,
  descripcion,
  badge,
  icono,
  acento,
  onPress,
}) => {
  const badgeStyle =
    acento === 'terracotta'
      ? styles.badgeTerracotta
      : acento === 'ochre'
        ? styles.badgeOchre
        : styles.badgeSurface;

  const badgeTextStyle =
    acento === 'terracotta' || acento === 'ochre' ? styles.badgeTextoBlanco : styles.badgeTextoCarbon;

  const iconBg =
    acento === 'terracotta'
      ? cictatColors.terracottaSoft
      : acento === 'ochre'
        ? cictatColors.ochreSoft
        : cictatColors.surface;

  const iconColor =
    acento === 'terracotta' ? cictatColors.terracotta : cictatColors.carbon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${badge}`}
      style={({ pressed }) => [
        styles.card,
        getTerracottaShadow({ border: 'structural' }),
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icono} size={26} color={iconColor} />
        </View>
        <View style={styles.cardTitulos}>
          <Text variant="titleMedium" style={styles.cardTitulo}>
            {titulo}
          </Text>
          <Text variant="bodySmall" style={styles.cardDescripcion}>
            {descripcion}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={cictatColors.terracotta} />
      </View>

      <View style={[styles.badge, badgeStyle]}>
        <Text variant="labelMedium" style={badgeTextStyle}>
          {badge}
        </Text>
      </View>
    </Pressable>
  );
};

export default function SelectorPerfilScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    returnTo?: string;
    espacioId?: string;
    fecha?: string;
  }>();

  const returnTo = normalizarParametro(rawParams.returnTo);
  const espacioId = normalizarParametro(rawParams.espacioId);
  const fecha = normalizarParametro(rawParams.fecha);

  const construirParams = (extra?: Record<string, string>) => {
    const out: Record<string, string> = { ...(extra ?? {}) };
    if (returnTo) out.returnTo = returnTo;
    if (espacioId) out.espacioId = espacioId;
    if (fecha) out.fecha = fecha;
    return out;
  };

  return (
    <AuthScreenContainer etiquetaVolver="Catálogo" maxWidth={600}>
      {/* Encabezado */}
      <View style={styles.header}>
        <BrushTitle text="Acceso CICTAT" highlight="CICTAT" size="lg" />
        <Text variant="bodyLarge" style={styles.subtitulo}>
          Selecciona tu perfil para autenticarte. Los permisos de reserva y el acceso a los
          cubículos de estudio se ajustan automáticamente a tu rol.
        </Text>
        {espacioId ? (
          <View style={styles.contextoAviso}>
            <MaterialCommunityIcons
              name="calendar-arrow-right"
              size={18}
              color={cictatColors.terracotta}
            />
            <Text variant="labelMedium" style={styles.contextoTexto}>
              Al iniciar sesión regresarás directamente al espacio que estabas consultando.
            </Text>
          </View>
        ) : null}
      </View>

      {/* 3 tarjetas principales */}
      <View style={styles.lista}>
        <TarjetaPerfil
          titulo="Estudiante de Posgrado"
          descripcion="Comunidad estudiantil de posgrado con matrícula institucional (@alumno.ujat.mx)."
          badge="Desbloquea Salas 1-6 y Cubículos 7-9"
          icono="school"
          acento="ochre"
          onPress={() =>
            router.push({
              pathname: '/auth/ujat',
              params: construirParams({ rol: 'estudiante_posgrado' }),
            })
          }
        />

        <TarjetaPerfil
          titulo="Doctor de Posgrado"
          descripcion="Profesores, investigadores y doctores adscritos al posgrado (@ujat.mx)."
          badge="Acceso a Salas 1 a 6"
          icono="account-tie"
          acento="terracotta"
          onPress={() =>
            router.push({
              pathname: '/auth/ujat',
              params: construirParams({ rol: 'doctor_posgrado' }),
            })
          }
        />

        <TarjetaPerfil
          titulo="Público General"
          descripcion="Visitantes, instituciones externas y usuarios sin matrícula UJAT."
          badge="Usuarios externos (Salas 1 a 6)"
          icono="account-group-outline"
          acento="surface"
          onPress={() =>
            router.push({
              pathname: '/auth/externo',
              params: construirParams(),
            })
          }
        />
      </View>

      {/* 4. Acceso discreto institucional al pie: Encargado / Administrador CICTAT */}
      <View style={styles.separadorAdmin}>
        <View style={styles.linea} />
        <Text variant="labelSmall" style={styles.etiquetaSeparador}>
          GESTIÓN INSTITUCIONAL
        </Text>
        <View style={styles.linea} />
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/auth/admin',
            params: construirParams(),
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Encargado o Administrador CICTAT"
        style={({ pressed }) => [
          styles.adminCard,
          getTerracottaShadow({ border: 'structural', intensity: 0.75 }),
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.adminIconWrap}>
          <MaterialCommunityIcons name="shield-account" size={22} color={cictatColors.ochre} />
        </View>
        <View style={styles.adminTextos}>
          <Text variant="titleSmall" style={styles.adminTitulo}>
            Encargado / Administrador CICTAT
          </Text>
          <Text variant="bodySmall" style={styles.adminSubtitulo}>
            Aprobación de solicitudes, control de espacios y administración del centro
          </Text>
        </View>
        <MaterialCommunityIcons name="arrow-right" size={20} color={cictatColors.carbon} />
      </Pressable>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm + 2 },
  subtitulo: { color: cictatColors.textSecondary },
  contextoAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.ochreSoft,
    borderColor: cictatColors.ochre,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  contextoTexto: { flex: 1, color: cictatColors.carbon, fontWeight: '700' },

  lista: { gap: spacing.md + 2 },
  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: cictatColors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitulos: { flex: 1, gap: 3 },
  cardTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  cardDescripcion: { color: cictatColors.textSecondary },

  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  badgeOchre: { backgroundColor: cictatColors.ochre },
  badgeTerracotta: { backgroundColor: cictatColors.terracotta },
  badgeSurface: { backgroundColor: cictatColors.surface },
  badgeTextoCarbon: { color: cictatColors.carbon, fontWeight: '800' },
  badgeTextoBlanco: { color: '#FFFFFF', fontWeight: '800' },

  separadorAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  linea: { flex: 1, height: 1, backgroundColor: cictatColors.borderSoft },
  etiquetaSeparador: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1,
  },

  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
  },
  adminIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTextos: { flex: 1, gap: 2 },
  adminTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  adminSubtitulo: { color: cictatColors.textSecondary },
});
