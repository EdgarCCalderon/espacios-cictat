/**
 * Vista 2 del Panel Administrativo — Monitor y Calendario Maestro (08:00 a 15:00 hrs).
 *
 * Muestra simultáneamente la matriz de ocupación de las Salas 1 a 6 y Cubículos
 * 7 a 9 en una fecha elegida, diferenciando bloques Libres, En Evaluación
 * (Pendientes), Reservados (Aprobados), En Limpieza (+1h) y En Mantenimiento.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import type { Espacio, ISODate, SolicitudAdminItem } from '@/domain/models';
import {
  aFechaISOLocal,
  construirMatrizHoraria,
  formatearFechaLarga,
  formatearFolioCorto,
  sumarDias,
  type EstadoBloque,
} from '@/domain/usecases';
import { DateStrip } from '../espacio/DateStrip';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '../../theme/cictatTheme';

export interface CalendarioMaestroViewProps {
  espacios: Espacio[];
  solicitudes: SolicitudAdminItem[];
  fechaISO: ISODate;
  onChangeFecha: (fechaISO: ISODate) => void;
  onIrABandeja?: () => void;
}

const HORAS_CABECERA = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00 (Limp.)',
];

export const CalendarioMaestroView: React.FC<CalendarioMaestroViewProps> = ({
  espacios,
  solicitudes,
  fechaISO,
  onChangeFecha,
  onIrABandeja,
}) => {
  const hoyISO = useMemo(() => aFechaISOLocal(new Date()), []);
  const dias = useMemo(
    () => Array.from({ length: 14 }, (_, i) => sumarDias(hoyISO, i)),
    [hoyISO],
  );

  const solicitudesDelDia = useMemo(
    () =>
      solicitudes.filter(
        (s) =>
          s.fecha_evento === fechaISO &&
          (s.estado === 'aprobada' || s.estado === 'pendiente'),
      ),
    [fechaISO, solicitudes],
  );

  return (
    <View style={styles.contenedor}>
      {/* Cabecera y selector de fecha */}
      <View style={[styles.headerCard, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextos}>
            <Text variant="titleMedium" style={styles.titulo}>
              Monitor Maestro de Ocupación Diaria (08:00 – 15:00 hrs)
            </Text>
            <Text variant="bodySmall" style={styles.subtitulo}>
              {formatearFechaLarga(fechaISO)} ({fechaISO}) · Vista simultánea de Salas 1-6 y
              Cubículos 7-9
            </Text>
          </View>

          <View style={styles.navBotones}>
            <Button
              mode="outlined"
              compact
              icon="chevron-left"
              onPress={() => onChangeFecha(sumarDias(fechaISO, -1))}
              textColor={cictatColors.carbon}
            >
              Anterior
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() => onChangeFecha(sumarDias(hoyISO, 1))}
              textColor={cictatColors.terracotta}
            >
              Mañana
            </Button>
            <Button
              mode="outlined"
              compact
              contentStyle={{ flexDirection: 'row-reverse' }}
              icon="chevron-right"
              onPress={() => onChangeFecha(sumarDias(fechaISO, 1))}
              textColor={cictatColors.carbon}
            >
              Siguiente
            </Button>
          </View>
        </View>

        <DateStrip
          dias={dias}
          seleccionado={fechaISO}
          hoyISO={hoyISO}
          onChange={onChangeFecha}
        />

        {/* Leyenda de colores */}
        <View style={styles.leyendaRow}>
          <LeyendaChip color="#E4F0E7" borde={cictatColors.success} texto="Libre" />
          <LeyendaChip
            color={cictatColors.ochreSoft}
            borde={cictatColors.ochre}
            texto="Pendiente de Dictamen"
          />
          <LeyendaChip
            color={cictatColors.terracottaSoft}
            borde={cictatColors.terracotta}
            texto="Reservado (Aprobada)"
          />
          <LeyendaChip
            color={cictatColors.surface}
            borde={cictatColors.carbon}
            texto="Bloqueo Limpieza (+1h)"
          />
        </View>
      </View>

      {/* Matriz horizontal deslizable de los 9 espacios */}
      <View style={[styles.matrizWrap, getTerracottaShadow({ border: 'structural' })]}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.tabla}>
            {/* Encabezado de columnas */}
            <View style={[styles.fila, styles.filaCabecera]}>
              <View style={styles.celdaEspacioHeader}>
                <Text variant="labelMedium" style={styles.headerColTexto}>
                  ESPACIO
                </Text>
              </View>
              {HORAS_CABECERA.map((h) => (
                <View key={h} style={styles.celdaHoraHeader}>
                  <Text variant="labelSmall" style={styles.headerColTexto}>
                    {h}
                  </Text>
                </View>
              ))}
            </View>

            {/* Filas por cada espacio */}
            {espacios.map((esp) => {
              const delEspacio = solicitudesDelDia.filter((s) => s.espacio_id === esp.id);
              const bloques = construirMatrizHoraria(delEspacio, fechaISO, new Date());

              return (
                <View key={esp.id} style={styles.fila}>
                  <View style={styles.celdaEspacio}>
                    <Text variant="labelMedium" style={styles.espCodigo}>
                      {esp.codigo_espacio}
                    </Text>
                    <Text variant="bodySmall" style={styles.espNombre} numberOfLines={1}>
                      {esp.nombre}
                    </Text>
                    {!esp.esta_activo ? (
                      <Text variant="labelSmall" style={styles.mantTag}>
                        En Mantenimiento
                      </Text>
                    ) : null}
                  </View>

                  {HORAS_CABECERA.map((_, idx) => {
                    const b = bloques[idx];
                    if (!esp.esta_activo) {
                      return (
                        <View key={idx} style={[styles.celdaBloque, styles.bloqueMant]}>
                          <Text variant="labelSmall" style={styles.bloqueTextoMuted}>
                            Mant.
                          </Text>
                        </View>
                      );
                    }
                    if (!b) {
                      return (
                        <View key={idx} style={[styles.celdaBloque, styles.bloqueNeutro]}>
                          <Text variant="labelSmall" style={styles.bloqueTextoMuted}>
                            —
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <CeldaEstadoBloque
                        key={idx}
                        estado={b.estado}
                        pendientes={b.pendientes}
                        onPress={b.estado === 'pendiente' ? onIrABandeja : undefined}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Detalle de eventos programados o pendientes en esta fecha */}
      <View style={[styles.eventosDiaCard, getTerracottaShadow({ border: 'structural' })]}>
        <Text variant="titleSmall" style={styles.titulo}>
          Solicitudes registradas para el {fechaISO} ({solicitudesDelDia.length})
        </Text>
        {solicitudesDelDia.length === 0 ? (
          <Text variant="bodySmall" style={styles.subtitulo}>
            No hay reservas aprobadas ni pendientes para esta fecha.
          </Text>
        ) : (
          <View style={styles.listaEventosDia}>
            {solicitudesDelDia.map((s) => (
              <View key={s.id} style={styles.eventoDiaFila}>
                <View style={styles.eventoDiaBadge}>
                  <Text variant="labelSmall" style={styles.eventoDiaCodigo}>
                    {s.espacio?.codigo_espacio ?? 'ESP'} · {s.hora_inicio.slice(0, 5)}–
                    {s.hora_fin.slice(0, 5)}
                  </Text>
                </View>
                <View style={styles.flex1}>
                  <Text variant="bodyMedium" style={styles.eventoDiaTema}>
                    {s.tema_evento} ({formatearFolioCorto(s.id)})
                  </Text>
                  <Text variant="bodySmall" style={styles.subtitulo}>
                    {s.usuario?.nombre_completo ?? 'Usuario'} · Estado: {s.estado.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const LeyendaChip: React.FC<{ color: string; borde: string; texto: string }> = ({
  color,
  borde,
  texto,
}) => (
  <View style={styles.leyendaItem}>
    <View style={[styles.leyendaCuadro, { backgroundColor: color, borderColor: borde }]} />
    <Text variant="labelSmall" style={styles.leyendaTexto}>
      {texto}
    </Text>
  </View>
);

const CeldaEstadoBloque: React.FC<{
  estado: EstadoBloque;
  pendientes: number;
  onPress?: () => void;
}> = ({ estado, pendientes, onPress }) => {
  if (estado === 'ocupado') {
    return (
      <View style={[styles.celdaBloque, styles.bloqueOcupado]}>
        <MaterialCommunityIcons name="lock" size={14} color={cictatColors.terracotta} />
        <Text variant="labelSmall" style={styles.textoOcupado}>
          Reservado
        </Text>
      </View>
    );
  }
  if (estado === 'limpieza') {
    return (
      <View style={[styles.celdaBloque, styles.bloqueLimpieza]}>
        <MaterialCommunityIcons name="broom" size={14} color={cictatColors.carbon} />
        <Text variant="labelSmall" style={styles.textoLimpieza}>
          Limpieza
        </Text>
      </View>
    );
  }
  if (estado === 'pendiente') {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.celdaBloque, styles.bloquePendiente]}
      >
        <MaterialCommunityIcons name="clock-alert-outline" size={14} color="#7A4E0E" />
        <Text variant="labelSmall" style={styles.textoPendiente}>
          {pendientes} Pend.
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.celdaBloque, styles.bloqueLibre]}>
      <Text variant="labelSmall" style={styles.textoLibre}>
        Libre
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  flex1: { flex: 1 },
  headerCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headerTextos: { flex: 1, minWidth: 240, gap: 2 },
  titulo: { color: cictatColors.carbon, fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },
  navBotones: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },

  leyendaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaCuadro: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  leyendaTexto: { color: cictatColors.carbon, fontWeight: '700' },

  matrizWrap: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tabla: { minWidth: 920 },
  fila: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: cictatColors.borderSoft,
  },
  filaCabecera: {
    backgroundColor: cictatColors.carbon,
  },
  celdaEspacioHeader: {
    width: 170,
    padding: spacing.sm + 2,
    justifyContent: 'center',
  },
  celdaHoraHeader: {
    width: 96,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#3A3532',
  },
  headerColTexto: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },

  celdaEspacio: {
    width: 170,
    padding: spacing.sm + 2,
    backgroundColor: cictatColors.surface,
    justifyContent: 'center',
    gap: 2,
  },
  espCodigo: { color: cictatColors.carbon, fontWeight: '800' },
  espNombre: { color: cictatColors.textSecondary },
  mantTag: { color: cictatColors.terracotta, fontWeight: '800' },

  celdaBloque: {
    width: 96,
    minHeight: 54,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: cictatColors.borderSoft,
    gap: 2,
  },
  bloqueLibre: { backgroundColor: '#F2F8F3' },
  bloquePendiente: { backgroundColor: cictatColors.ochreSoft },
  bloqueOcupado: { backgroundColor: cictatColors.terracottaSoft },
  bloqueLimpieza: { backgroundColor: cictatColors.surface },
  bloqueMant: { backgroundColor: '#ECE7DF' },
  bloqueNeutro: { backgroundColor: cictatColors.surfaceElevated },

  textoLibre: { color: cictatColors.success, fontWeight: '700' },
  textoPendiente: { color: '#7A4E0E', fontWeight: '800' },
  textoOcupado: { color: cictatColors.terracotta, fontWeight: '800' },
  textoLimpieza: { color: cictatColors.carbon, fontWeight: '700' },
  bloqueTextoMuted: { color: cictatColors.textSecondary },

  eventosDiaCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  listaEventosDia: { gap: spacing.sm },
  eventoDiaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  eventoDiaBadge: {
    backgroundColor: cictatColors.carbon,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  eventoDiaCodigo: { color: '#FFFFFF', fontWeight: '800' },
  eventoDiaTema: { color: cictatColors.carbon, fontWeight: '700' },
});
