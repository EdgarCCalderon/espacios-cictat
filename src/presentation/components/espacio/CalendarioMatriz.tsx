/**
 * <CalendarioMatriz /> — Matriz horaria en tiempo real (08:00–15:00 hrs).
 *
 * Código de colores:
 *  - Libre              → blanco/crema, seleccionable
 *  - Solicitudes pend.  → Ocre (se puede solicitar; sujeto a aprobación)
 *  - Reserva Aprobada   → Negro Carbón con franja Terracota (bloqueado)
 *  - Bloqueo Limpieza   → gris cálido punteado con ícono de escoba (bloqueado)
 *  - Seleccionado       → Naranja Terracota
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import type { BloqueHorario, RangoSeleccion } from '@/domain/usecases';
import { cictatColors, radius, spacing } from '../../theme/cictatTheme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Apariencia {
  fondo: string;
  borde: string;
  bordeEstilo: 'solid' | 'dashed';
  colorTexto: string;
  colorSub: string;
  icono: IconName;
  colorIcono: string;
  franja?: string;
}

const APARIENCIA = {
  libre: {
    fondo: cictatColors.surfaceElevated,
    borde: cictatColors.borderSoft,
    bordeEstilo: 'solid',
    colorTexto: cictatColors.carbon,
    colorSub: cictatColors.textSecondary,
    icono: 'check-circle-outline',
    colorIcono: cictatColors.success,
  },
  pendiente: {
    fondo: cictatColors.warningSoft,
    borde: cictatColors.warning,
    bordeEstilo: 'solid',
    colorTexto: cictatColors.carbon,
    colorSub: '#9A3412',
    icono: 'timer-sand',
    colorIcono: cictatColors.warning,
    franja: cictatColors.warning,
  },
  ocupado: {
    fondo: cictatColors.carbon,
    borde: cictatColors.carbon,
    bordeEstilo: 'solid',
    colorTexto: '#FFFFFF',
    colorSub: '#D6D3D1',
    icono: 'lock',
    colorIcono: cictatColors.verde1,
    franja: cictatColors.verde1,
  },
  limpieza: {
    fondo: '#EDE6DA',
    borde: '#A8A29E',
    bordeEstilo: 'dashed',
    colorTexto: cictatColors.carbon,
    colorSub: cictatColors.textSecondary,
    icono: 'broom',
    colorIcono: cictatColors.textSecondary,
  },
  seleccionado: {
    fondo: cictatColors.verde1,
    borde: cictatColors.carbon,
    bordeEstilo: 'solid',
    colorTexto: '#FFFFFF',
    colorSub: '#FFEDE5',
    icono: 'check-circle',
    colorIcono: '#FFFFFF',
  },
} satisfies Record<string, Apariencia>;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function textosDe(b: BloqueHorario, seleccionado: boolean): { titulo: string; sub: string } {
  if (seleccionado) {
    return {
      titulo: 'Seleccionado',
      sub:
        b.estado === 'pendiente'
          ? `${plural(b.pendientes, 'solicitud pendiente', 'solicitudes pendientes')} · sujeto a aprobación`
          : 'Toca de nuevo para quitar',
    };
  }
  switch (b.estado) {
    case 'ocupado':
      return { titulo: 'Reserva Aprobada', sub: 'Ocupado' };
    case 'limpieza':
      return { titulo: 'Bloqueo Limpieza +1h', sub: 'Preparación del espacio' };
    case 'pendiente':
      return {
        titulo: plural(b.pendientes, 'Solicitud Pendiente', 'Solicitudes Pendientes'),
        sub: b.seleccionable ? 'Aún puedes solicitarlo · sujeto a aprobación' : 'En evaluación',
      };
    default:
      return { titulo: 'Disponible', sub: b.seleccionable ? 'Toca para seleccionar' : '' };
  }
}

const BloqueRow: React.FC<{
  bloque: BloqueHorario;
  seleccionado: boolean;
  onPress: () => void;
}> = ({ bloque, seleccionado, onPress }) => {
  const ap: Apariencia = seleccionado ? APARIENCIA.seleccionado : APARIENCIA[bloque.estado];
  const { titulo } = textosDe(bloque, seleccionado);
  let { sub } = textosDe(bloque, seleccionado);

  // Bloques que aún serían reservables salvo por la regla de 24 h.
  const sinAnticipacion =
    bloque.dentroDeVentana &&
    !bloque.anticipacionSuficiente &&
    (bloque.estado === 'libre' || bloque.estado === 'pendiente');
  if (sinAnticipacion) sub = 'Requiere 24 h de anticipación';

  const icono: IconName = sinAnticipacion ? 'clock-alert-outline' : ap.icono;
  const apagado = sinAnticipacion;

  return (
    <View style={styles.fila}>
      <View style={styles.hora}>
        <Text variant="labelLarge" style={styles.horaTexto}>
          {bloque.etiqueta}
        </Text>
      </View>

      <Pressable
        onPress={onPress}
        disabled={!bloque.seleccionable}
        accessibilityRole="button"
        accessibilityLabel={`${bloque.etiqueta}. ${titulo}. ${sub}`}
        accessibilityState={{ disabled: !bloque.seleccionable, selected: seleccionado }}
        style={({ pressed }) => [
          styles.bloque,
          {
            backgroundColor: ap.fondo,
            borderColor: ap.borde,
            borderStyle: ap.bordeEstilo,
            borderLeftColor: ap.franja ?? ap.borde,
            borderLeftWidth: ap.franja ? 6 : seleccionado ? 2 : 1.5,
          },
          seleccionado && styles.bloqueSeleccionado,
          apagado && styles.apagado,
          pressed && bloque.seleccionable && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons name={icono} size={22} color={ap.colorIcono} />
        <View style={styles.textos}>
          <Text variant="titleSmall" style={[styles.titulo, { color: ap.colorTexto }]}>
            {titulo}
          </Text>
          {sub ? (
            <Text variant="bodySmall" style={{ color: ap.colorSub }}>
              {sub}
            </Text>
          ) : null}
        </View>
        {!bloque.dentroDeVentana ? (
          <Text variant="labelSmall" style={[styles.extra, { color: ap.colorSub }]}>
            Fuera de horario
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const LEYENDA: { color: string; borde: string; etiqueta: string; dashed?: boolean }[] = [
  { color: cictatColors.surfaceElevated, borde: cictatColors.borderSoft, etiqueta: 'Disponible' },
  { color: cictatColors.warning, borde: cictatColors.warning, etiqueta: 'Solicitudes pendientes' },
  { color: cictatColors.verde1, borde: cictatColors.verde1, etiqueta: 'Reserva Aprobada' },
  { color: '#EDE6DA', borde: '#A8A29E', etiqueta: 'Bloqueo Limpieza +1h', dashed: true },
];

export const LeyendaCalendario: React.FC = () => (
  <View style={styles.leyenda}>
    {LEYENDA.map((l) => (
      <View key={l.etiqueta} style={styles.leyendaItem}>
        <View
          style={[
            styles.muestra,
            { backgroundColor: l.color, borderColor: l.borde, borderStyle: l.dashed ? 'dashed' : 'solid' },
          ]}
        />
        <Text variant="labelSmall" style={styles.leyendaTexto}>
          {l.etiqueta}
        </Text>
      </View>
    ))}
  </View>
);

export interface CalendarioMatrizProps {
  bloques: readonly BloqueHorario[];
  seleccion: RangoSeleccion | null;
  cargando: boolean;
  onToggle: (indice: number) => void;
}

export const CalendarioMatriz: React.FC<CalendarioMatrizProps> = ({
  bloques,
  seleccion,
  cargando,
  onToggle,
}) => (
  <View style={styles.contenedor}>
    <LeyendaCalendario />
    <View style={styles.lista}>
      {bloques.map((b) => (
        <BloqueRow
          key={b.indice}
          bloque={b}
          seleccionado={!!seleccion && b.indice >= seleccion.desde && b.indice <= seleccion.hasta}
          onPress={() => onToggle(b.indice)}
        />
      ))}
      {cargando ? (
        <View style={styles.velo} pointerEvents="none">
          <ActivityIndicator color={cictatColors.terracotta} />
        </View>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  contenedor: { gap: spacing.md },
  lista: { gap: spacing.sm, position: 'relative' },
  fila: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  hora: { width: 104, justifyContent: 'center' },
  horaTexto: { color: cictatColors.carbon, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bloque: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  bloqueSeleccionado: { borderWidth: 2 },
  apagado: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  textos: { flex: 1, gap: 1 },
  titulo: { fontWeight: '800' },
  extra: { fontStyle: 'italic' },
  velo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250, 247, 242, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  muestra: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5 },
  leyendaTexto: { color: cictatColors.textSecondary, fontWeight: '600' },
});

export default CalendarioMatriz;
