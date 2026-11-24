/**
 * <BrushTitle /> — Encabezado de identidad "Espacios CICTAT".
 *
 * Renderiza el título en Negro Carbón (bold) y, bajo la palabra clave,
 * una pincelada orgánica en Verde 1 (#1C8443) con degradado hacia Verde 2 (#41AD49)
 * y destello en Verde 3 (#8DC642), dibujada con react-native-svg.
 */
import React, { useId } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { cictatColors } from '../../theme/cictatTheme';

export type BrushTitleSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BrushTitleProps {
  /** Texto completo del encabezado. */
  text: string;
  /**
   * Palabra(s) a subrayar con la pincelada. Debe estar contenida en `text`.
   * Por defecto se usa la última palabra.
   */
  highlight?: string;
  size?: BrushTitleSize;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Color del trazo principal (por defecto Verde 1 predominante). */
  strokeColor?: string;
  /** Color de transición (por defecto Verde 2). */
  accentColor?: string;
  /** Color del destello fino (por defecto Verde 3). */
  highlightColor?: string;
}

const FONT_SIZES: Record<BrushTitleSize, number> = { sm: 20, md: 26, lg: 34, xl: 42 };

/** Trazo principal: forma rellena con extremos afilados (efecto pincel). viewBox 300×32 */
const BRUSH_MAIN =
  'M3 21 C 28 14, 70 11, 118 12 C 168 13, 222 12, 268 8 C 280 7, 292 6, 297 7 ' +
  'C 299 10, 295 14, 288 16 C 250 19, 206 20, 160 21 C 112 22, 64 24, 22 27 ' +
  'C 12 28, 4 27, 2 25 C 1 24, 1 22, 3 21 Z';

/** Fibra interior más clara que simula la textura de las cerdas. */
const BRUSH_FIBER = 'M18 22 C 70 17, 150 16, 230 14 C 252 13, 270 12, 284 11';

/** Destello complementario: trazo fino y desplazado bajo el principal. */
const BRUSH_ACCENT = 'M40 29 C 100 25, 180 24, 262 20';

export const BrushTitle: React.FC<BrushTitleProps> = ({
  text,
  highlight,
  size = 'lg',
  align = 'left',
  style,
  textStyle,
  strokeColor = cictatColors.verde1,
  accentColor = cictatColors.verde2,
  highlightColor = cictatColors.verde3,
}) => {
  const gradientId = `brush-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fontSize = FONT_SIZES[size];
  const { before, keyword, after } = splitByHighlight(text, highlight);

  const baseText: TextStyle = {
    fontSize,
    lineHeight: Math.round(fontSize * 1.25),
    color: cictatColors.carbon,
    fontWeight: '800',
    letterSpacing: -0.5,
  };
  const gap = Math.round(fontSize * 0.28);

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={text}
      style={[styles.row, align === 'center' && styles.center, style]}
    >
      {before.map((word, i) => (
        <Text key={`b-${i}`} style={[baseText, { marginRight: gap }, textStyle]}>
          {word}
        </Text>
      ))}

      {keyword.length > 0 && (
        <View style={[styles.keyword, { marginRight: after.length ? gap : 0 }]}>
          <View
            pointerEvents="none"
            style={[
              styles.brush,
              {
                height: Math.round(fontSize * 0.5),
                bottom: -Math.round(fontSize * 0.14),
                left: -Math.round(fontSize * 0.12),
                right: -Math.round(fontSize * 0.12),
              },
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 300 32" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={strokeColor} stopOpacity={0.94} />
                  <Stop offset="0.65" stopColor={strokeColor} stopOpacity={1} />
                  <Stop offset="1" stopColor={accentColor} stopOpacity={0.96} />
                </LinearGradient>
              </Defs>
              <Path d={BRUSH_MAIN} fill={`url(#${gradientId})`} />
              <Path
                d={BRUSH_FIBER}
                stroke="#FFFFFF"
                strokeOpacity={0.28}
                strokeWidth={1.4}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={BRUSH_ACCENT}
                stroke={highlightColor}
                strokeOpacity={0.92}
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
          <Text style={[baseText, textStyle]}>{keyword}</Text>
        </View>
      )}

      {after.map((word, i) => (
        <Text
          key={`a-${i}`}
          style={[baseText, { marginRight: i < after.length - 1 ? gap : 0 }, textStyle]}
        >
          {word}
        </Text>
      ))}
    </View>
  );
};

/** Separa el texto en palabras previas, palabra clave y palabras posteriores. */
function splitByHighlight(text: string, highlight?: string) {
  const words = (s: string) => s.split(/\s+/).filter(Boolean);
  const trimmed = text.trim();

  if (!highlight) {
    const all = words(trimmed);
    return { before: all.slice(0, -1), keyword: all.at(-1) ?? '', after: [] as string[] };
  }

  const idx = trimmed.toLowerCase().indexOf(highlight.trim().toLowerCase());
  if (idx < 0) return { before: words(trimmed), keyword: '', after: [] as string[] };

  const end = idx + highlight.trim().length;
  return {
    before: words(trimmed.slice(0, idx)),
    keyword: trimmed.slice(idx, end),
    after: words(trimmed.slice(end)),
  };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  center: {
    justifyContent: 'center',
  },
  keyword: {
    position: 'relative',
  },
  brush: {
    position: 'absolute',
  },
});

export default BrushTitle;
