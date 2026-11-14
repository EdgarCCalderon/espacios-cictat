/**
 * Presentación — Sistema de Diseño "Espacios CICTAT".
 *
 * Paleta cálida institucional (crema / carbón / ocre / terracota) aplicada
 * sobre `MD3LightTheme` de react-native-paper, más tokens de espaciado,
 * radios y un helper de sombras multiplataforma.
 */
import { Platform, type ViewStyle } from 'react-native';
import { MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

// ─────────────────────────────────────────────────────────────────────────────
// Paleta base
// ─────────────────────────────────────────────────────────────────────────────

export const cictatColors = {
  /** Blanco hueso / crema cálido principal. */
  background: '#FAF7F2',
  /** Crema suave para tarjetas y contenedores. */
  surface: '#F3EFE6',
  surfaceElevated: '#FFFFFF',
  /** Negro carbón para tipografía y bordes estructurales. */
  carbon: '#1C1917',
  textPrimary: '#1C1917',
  textSecondary: '#57534E',
  /** Secundario / institucional: badges, capacidad, bordes secundarios. */
  ochre: '#C88A32',
  /** Acento estratégico / CTA: botón principal, sombras cálidas, pinceladas. */
  terracotta: '#E05A2B',
  /** Borde estructural suave (alternativa al carbón). */
  borderSoft: '#E5DEC9',

  // Derivados de apoyo
  terracottaSoft: '#FBE3D8',
  ochreSoft: '#F5E6CC',
  success: '#3F7D4E',
  warning: '#C88A32',
  danger: '#B3261E',
} as const;

export type CictatColorName = keyof typeof cictatColors;

// ─────────────────────────────────────────────────────────────────────────────
// Tokens de layout
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Sombras multiplataforma
// ─────────────────────────────────────────────────────────────────────────────

export type BorderVariant = 'structural' | 'soft' | 'none';

export interface TerracottaShadowOptions {
  /** `structural` = 1px carbón (#1C1917), `soft` = 1px #E5DEC9. */
  border?: BorderVariant;
  /** Multiplicador de intensidad (1 = valores base del sistema). */
  intensity?: number;
}

/**
 * Sombra sutil con tinte terracota + borde estructural fino.
 *
 * - iOS:     `shadow*` nativos.
 * - Android: `elevation` + `shadowColor` (tinte soportado en API 28+).
 * - Web:     `boxShadow` CSS (react-native-web desaconseja `shadow*`).
 */
export const getTerracottaShadow = ({
  border = 'soft',
  intensity = 1,
}: TerracottaShadowOptions = {}): ViewStyle => {
  const opacity = +(0.14 * intensity).toFixed(3);
  const blur = Math.round(10 * intensity);
  const offsetY = Math.round(4 * intensity);

  const borderStyle: ViewStyle =
    border === 'none'
      ? {}
      : {
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: border === 'structural' ? cictatColors.carbon : cictatColors.borderSoft,
        };

  const shadowStyle = Platform.select<ViewStyle>({
    ios: {
      shadowColor: cictatColors.terracotta,
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      shadowColor: cictatColors.terracotta,
      elevation: Math.max(1, Math.round(4 * intensity)),
    },
    default: {
      boxShadow: `0px ${offsetY}px ${blur}px rgba(224, 90, 43, ${opacity})`,
    },
  });

  return { ...borderStyle, ...shadowStyle };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tema react-native-paper (MD3)
// ─────────────────────────────────────────────────────────────────────────────

export const cictatTheme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 3, // MD3 multiplica ×4 → 12px
  colors: {
    ...MD3LightTheme.colors,

    primary: cictatColors.terracotta,
    onPrimary: '#FFFFFF',
    primaryContainer: cictatColors.terracottaSoft,
    onPrimaryContainer: '#5A1E08',

    secondary: cictatColors.ochre,
    onSecondary: cictatColors.carbon,
    secondaryContainer: cictatColors.ochreSoft,
    onSecondaryContainer: '#4A3210',

    tertiary: cictatColors.carbon,
    onTertiary: cictatColors.background,
    tertiaryContainer: '#E7E5E4',
    onTertiaryContainer: cictatColors.carbon,

    background: cictatColors.background,
    onBackground: cictatColors.textPrimary,

    surface: cictatColors.surface,
    onSurface: cictatColors.textPrimary,
    surfaceVariant: '#ECE5D6',
    onSurfaceVariant: cictatColors.textSecondary,
    surfaceDisabled: 'rgba(28, 25, 23, 0.12)',
    onSurfaceDisabled: 'rgba(28, 25, 23, 0.38)',

    outline: cictatColors.carbon,
    outlineVariant: cictatColors.borderSoft,

    error: cictatColors.danger,
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    inverseSurface: cictatColors.carbon,
    inverseOnSurface: cictatColors.background,
    inversePrimary: '#FFB59A',
    shadow: cictatColors.terracotta,
    scrim: cictatColors.carbon,
    backdrop: 'rgba(28, 25, 23, 0.4)',

    elevation: {
      level0: 'transparent',
      level1: cictatColors.surface,
      level2: '#F0EADF',
      level3: '#EDE6D8',
      level4: '#EBE3D4',
      level5: '#E8DFCF',
    },
  },
  /** Tokens propios de la marca, accesibles con `useCictatTheme().cictat`. */
  cictat: {
    colors: cictatColors,
    spacing,
    radius,
  },
} satisfies MD3Theme & { cictat: unknown };

export type CictatTheme = typeof cictatTheme;

/** Hook tipado para consumir el tema (incluye tokens `cictat`). */
export const useCictatTheme = () => useTheme<CictatTheme>();
