/**
 * <DateStrip /> — Selector de fecha: flechas ‹ › + tira horizontal de días.
 * Sin dependencias nativas extra (funciona igual en iOS, Android y Web).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import type { ISODate } from '@/domain/models';
import {
  DURACION_BLOQUE_MIN,
  VENTANA_FIN_MIN,
  cumpleAnticipacion,
  desdeFechaISO,
  formatearFechaLarga,
  nombreDia,
  nombreMes,
} from '@/domain/usecases';
import { cictatColors, radius, spacing } from '../../theme/cictatTheme';

const ANCHO = 62;
const GAP = spacing.sm;

export interface DateStripProps {
  dias: readonly ISODate[];
  seleccionado: ISODate;
  hoyISO: ISODate;
  onChange: (fecha: ISODate) => void;
}

export const DateStrip: React.FC<DateStripProps> = ({ dias, seleccionado, hoyISO, onChange }) => {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const indice = dias.indexOf(seleccionado);

  useEffect(() => {
    if (indice < 0) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, indice * (ANCHO + GAP) - 60), animated: true });
  }, [indice]);

  const ir = (delta: number) => {
    const destino = dias[indice + delta];
    if (destino) onChange(destino);
  };

  const ahora = new Date();

  return (
    <View style={styles.contenedor}>
      <View style={styles.cabecera}>
        <IconButton
          icon="chevron-left"
          size={22}
          disabled={indice <= 0}
          onPress={() => ir(-1)}
          accessibilityLabel="Día anterior"
          iconColor={cictatColors.carbon}
        />
        <View style={styles.fechaWrap}>
          <MaterialCommunityIcons name="calendar" size={18} color={cictatColors.verde1} />
          <Text variant="titleSmall" style={styles.fechaLarga} numberOfLines={2}>
            {formatearFechaLarga(seleccionado)}
          </Text>
        </View>
        <IconButton
          icon="chevron-right"
          size={22}
          disabled={indice < 0 || indice >= dias.length - 1}
          onPress={() => ir(1)}
          accessibilityLabel="Día siguiente"
          iconColor={cictatColors.carbon}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tira}
      >
        {dias.map((iso, i) => {
          const activo = iso === seleccionado;
          const esHoy = iso === hoyISO;
          const reservable = cumpleAnticipacion(iso, VENTANA_FIN_MIN - DURACION_BLOQUE_MIN, ahora);
          const dia = desdeFechaISO(iso).getDate();
          const mostrarMes = i === 0 || dia === 1;
          return (
            <Pressable
              key={iso}
              onPress={() => onChange(iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={formatearFechaLarga(iso) + (esHoy ? ', hoy' : '')}
              style={[
                styles.pill,
                activo ? styles.pillActivo : styles.pillInactivo,
                !reservable && !activo && styles.pillMuted,
              ]}
            >
              <Text variant="labelSmall" style={[styles.dow, activo && styles.textoActivo]}>
                {nombreDia(iso, true).toUpperCase()}
              </Text>
              <Text variant="titleLarge" style={[styles.num, activo && styles.textoActivo]}>
                {dia}
              </Text>
              <Text variant="labelSmall" style={[styles.mes, activo && styles.textoActivo]}>
                {esHoy ? 'HOY' : mostrarMes ? nombreMes(iso, true).toUpperCase() : ' '}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fechaWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  fechaLarga: { color: cictatColors.carbon, fontWeight: '800', textTransform: 'capitalize', flexShrink: 1, textAlign: 'center' },
  tira: { gap: GAP, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  pill: {
    width: ANCHO,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    paddingVertical: spacing.sm,
  },
  pillInactivo: { backgroundColor: cictatColors.surfaceElevated },
  pillActivo: { backgroundColor: cictatColors.verde1 },
  pillMuted: { opacity: 0.5, borderStyle: 'dashed' },
  dow: { color: cictatColors.textSecondary, fontWeight: '700', letterSpacing: 0.6 },
  num: { color: cictatColors.carbon, fontWeight: '800' },
  mes: { color: cictatColors.verde2, fontWeight: '800', letterSpacing: 0.6 },
  textoActivo: { color: '#FFFFFF' },
});

export default DateStrip;
