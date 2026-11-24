/**
 * Presentación — Sistema de Diseño "Espacios CICTAT".
 *
 * Paleta institucional basada en la gama de tres verdes oficiales:
 * - Verde 1 (PANTONE 356 C · RGB 28, 132, 67): Color predominante / Primario
 * - Verde 2 (PANTONE 362 C · RGB 65, 173, 73): Acompañamiento y contraste / Secundario
 * - Verde 3 (PANTONE 376 C · RGB 141, 198, 66): Armonía cromática y acentos
 *
 * Estados de advertencia y error preservados explícitamente en naranja y rojo.
 */
import { Platform, type ViewStyle } from 'react-native';
import { MD3LightTheme, useTheme, type MD3Theme } from 'react-native-paper';

// ─────────────────────────────────────────────────────────────────────────────
// Paleta base institucional
// ─────────────────────────────────────────────────────────────────────────────

export const cictatColors = {
  /** Blanco hueso / crema suave principal para fondos. */
  background: '#FAF8F5',
  /** Crema suave para tarjetas y contenedores. */
  surface: '#F4F1EA',
  surfaceElevated: '#FFFFFF',
  /** Negro carbón para tipografía y bordes estructurales. */
  carbon: '#1C1917',
  textPrimary: '#1C1917',
  textSecondary: '#57534E',

  // Gama de tres verdes institucionales (según manual oficial)
  /** Verde 1 (PANTONE 356 C): Color predominante principal. */
  verde1: '#1C8443',
  /** Verde 2 (PANTONE 362 C): Color de acompañamiento y contraste. */
  verde2: '#41AD49',
  /** Verde 3 (PANTONE 376 C): Color para armonía cromática y badges luminosos. */
  verde3: '#8DC642',

  // Derivados suaves de los tres verdes para fondos y contenedores
  verde1Soft: '#E2F3E7',
  verde2Soft: '#EAF6EB',
  verde3Soft: '#F2F9E8',

  /** Color primario de la aplicación (Verde 1 predominante). */
  primary: '#1C8443',
  primarySoft: '#E2F3E7',
  /** Color secundario institucional (Verde 2). */
  secondary: '#41AD49',
  secondarySoft: '#EAF6EB',
  /** Acento terciario (Verde 3). */
  tertiary: '#8DC642',
  tertiarySoft: '#F2F9E8',

  /** Borde estructural neutro suave (zinc/gris balanceado para no sobresaturar). */
  borderSoft: '#E4E4E7',

  // Escala de grises balanceada para evitar sobresaturación
  grayLight: '#F4F4F5',
  grayBorder: '#E4E4E7',
  grayText: '#71717A',
  grayDark: '#27272A',

  // Advertencias y errores (mantenidos explícitamente en naranja o rojo)
  /** Advertencias / estados pendientes / alertas en naranja. */
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  /** Peligro / rechazos / cancelaciones / errores en rojo. */
  danger: '#B3261E',
  dangerSoft: '#FDF2F0',
  /** Operaciones exitosas / disponibilidad (alineado con Verde 1). */
  success: '#1C8443',

  // Aliases de compatibilidad para componentes existentes
  terracotta: '#1C8443',
  terracottaSoft: '#E2F3E7',
  ochre: '#41AD49',
  ochreSoft: '#EAF6EB',
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
  /** `structural` = 1px carbón (#1C1917), `soft` = 1px borderSoft. */
  border?: BorderVariant;
  /** Multiplicador de intensidad (1 = valores base del sistema). */
  intensity?: number;
}

export type InstitutionalShadowOptions = TerracottaShadowOptions;

/**
 * Sombra institucional con tinte de Verde 1 predominante (#1C8443) + borde fino.
 *
 * - iOS:     `shadow*` nativos.
 * - Android: `elevation` + `shadowColor`.
 * - Web:     `boxShadow` CSS.
 */
export const getTerracottaShadow = ({
  border = 'soft',
  intensity = 1,
}: TerracottaShadowOptions = {}): ViewStyle => {
  const opacity = +(0.15 * intensity).toFixed(3);
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
      shadowColor: cictatColors.verde1,
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: {
      shadowColor: cictatColors.verde1,
      elevation: Math.max(1, Math.round(4 * intensity)),
    },
    default: {
      boxShadow: `0px ${offsetY}px ${blur}px rgba(28, 132, 67, ${opacity})`,
    },
  });

  return { ...borderStyle, ...shadowStyle };
};

export const getInstitutionalShadow = getTerracottaShadow;

// ─────────────────────────────────────────────────────────────────────────────
// Tema react-native-paper (MD3)
// ─────────────────────────────────────────────────────────────────────────────

export const cictatTheme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 3, // MD3 multiplica ×4 → 12px
  colors: {
    ...MD3LightTheme.colors,

    primary: cictatColors.verde1,
    onPrimary: '#FFFFFF',
    primaryContainer: cictatColors.verde1Soft,
    onPrimaryContainer: '#0B4720',

    secondary: cictatColors.verde2,
    onSecondary: '#FFFFFF',
    secondaryContainer: cictatColors.verde2Soft,
    onSecondaryContainer: '#135019',

    tertiary: cictatColors.verde3,
    onTertiary: cictatColors.carbon,
    tertiaryContainer: cictatColors.verde3Soft,
    onTertiaryContainer: '#22470A',

    background: cictatColors.background,
    onBackground: cictatColors.textPrimary,

    surface: cictatColors.surface,
    onSurface: cictatColors.textPrimary,
    surfaceVariant: '#E7EFE8',
    onSurfaceVariant: cictatColors.textSecondary,
    surfaceDisabled: 'rgba(28, 25, 23, 0.12)',
    onSurfaceDisabled: 'rgba(28, 25, 23, 0.38)',

    outline: cictatColors.carbon,
    outlineVariant: cictatColors.borderSoft,

    error: cictatColors.danger,
    onError: '#FFFFFF',
    errorContainer: cictatColors.dangerSoft,
    onErrorContainer: '#410E0B',

    inverseSurface: cictatColors.carbon,
    inverseOnSurface: cictatColors.background,
    inversePrimary: '#84D89A',
    shadow: cictatColors.verde1,
    scrim: cictatColors.carbon,
    backdrop: 'rgba(28, 25, 23, 0.4)',

    elevation: {
      level0: 'transparent',
      level1: cictatColors.surface,
      level2: '#EEF4EF',
      level3: '#E8F1EA',
      level4: '#E2EEE5',
      level5: '#DCEBE0',
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
