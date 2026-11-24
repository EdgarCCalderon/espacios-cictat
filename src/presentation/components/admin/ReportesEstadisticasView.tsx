/**
 * Vista 4 del Panel Administrativo — Reportes de Ocupación, KPIs y Bitácora.
 *
 * Muestra:
 *  - Selector de rango de fechas (`fechaInicioISO` a `fechaFinISO`)
 *  - KPIs Totales (`totalSolicitudes`, `aprobadas`, `rechazadasManual`,
 *    `rechazadasPorColisionAutomatica`, `canceladas`, `pendientes`)
 *  - Ranking de Uso por Espacio con barras de progreso relativas
 *  - Distribución por Tipo de Usuario (`estudiante_posgrado`, `doctor_posgrado`,
 *    `publico_general`)
 *  - Bitácora de Auditoría reciente (`historial_estados_solicitud`)
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text, TextInput } from 'react-native-paper';

import { exportarReporteEstadisticasPDF } from '@/application/services/GeneradorReportePDFService';
import type { ISODate, ReporteOcupacionDTO } from '@/domain/models';
import { aFechaISOLocal, formatearFolioCorto, sumarDias } from '@/domain/usecases';
import { useAuth } from '../../context/AuthContext';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '../../theme/cictatTheme';

export interface ReportesEstadisticasViewProps {
  reporte: ReporteOcupacionDTO | null;
  fechaInicioISO: ISODate;
  fechaFinISO: ISODate;
  onActualizarRango: (inicioISO: ISODate, finISO: ISODate) => Promise<void>;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const ReportesEstadisticasView: React.FC<ReportesEstadisticasViewProps> = ({
  reporte,
  fechaInicioISO,
  fechaFinISO,
  onActualizarRango,
}) => {
  const { user, perfil } = useAuth();
  const hoyISO = useMemo(() => aFechaISOLocal(new Date()), []);
  const [inicioInput, setInicioInput] = useState(fechaInicioISO);
  const [finInput, setFinInput] = useState(fechaFinISO);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [snackMensaje, setSnackMensaje] = useState<string | null>(null);

  const aplicarRangoRapido = (diasAtras: number, diasAdelante: number) => {
    const ini = sumarDias(hoyISO, -diasAtras);
    const fin = sumarDias(hoyISO, diasAdelante);
    setInicioInput(ini);
    setFinInput(fin);
    void onActualizarRango(ini, fin);
  };

  const aplicarManual = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(inicioInput) && /^\d{4}-\d{2}-\d{2}$/.test(finInput)) {
      void onActualizarRango(inicioInput, finInput);
    }
  };

  const manejarExportarPDF = async () => {
    if (!reporte) {
      setSnackMensaje('No hay datos disponibles para generar el informe.');
      return;
    }
    setExportandoPdf(true);
    try {
      const nombreEncargado = perfil?.nombre_completo?.trim() || user?.email || undefined;
      await exportarReporteEstadisticasPDF(reporte, nombreEncargado);
      setSnackMensaje('Informe estadístico generado exitosamente.');
    } catch (err) {
      console.error('[Reportes] Error al generar PDF de estadísticas:', err);
      setSnackMensaje('No se pudo generar el documento PDF. Intenta nuevamente.');
    } finally {
      setExportandoPdf(false);
    }
  };

  const kpis = reporte?.kpis ?? {
    totalSolicitudes: 0,
    aprobadas: 0,
    rechazadasManual: 0,
    rechazadasPorColisionAutomatica: 0,
    canceladas: 0,
    pendientes: 0,
  };

  return (
    <View style={styles.contenedor}>
      {/* Selector de periodo del reporte */}
      <View style={[styles.seccionCard, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextos}>
            <Text variant="titleMedium" style={styles.titulo}>
              Periodo del Reporte de Ocupación
            </Text>
            <Text variant="bodySmall" style={styles.subtitulo}>
              Consulta indicadores ejecutivos, horas aprobadas por sala/cubículo y rechazos
              automáticos por colisión.
            </Text>
          </View>

          <View style={styles.atajosRow}>
            <Button
              mode="outlined"
              compact
              onPress={() => aplicarRangoRapido(15, 15)}
              textColor={cictatColors.carbon}
            >
              ±15 días
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() => aplicarRangoRapido(30, 7)}
              textColor={cictatColors.carbon}
            >
              Últimos 30 días
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() => aplicarRangoRapido(90, 30)}
              textColor={cictatColors.carbon}
            >
              Trimestre
            </Button>
          </View>
        </View>

        <View style={styles.rangoInputsRow}>
          <TextInput
            mode="outlined"
            dense
            label="Fecha Inicio (YYYY-MM-DD)"
            value={inicioInput}
            onChangeText={setInicioInput}
            style={styles.fechaInput}
          />
          <TextInput
            mode="outlined"
            dense
            label="Fecha Fin (YYYY-MM-DD)"
            value={finInput}
            onChangeText={setFinInput}
            style={styles.fechaInput}
          />
          <View style={styles.botonesAccionRow}>
            <Button
              mode="contained"
              icon="chart-box-outline"
              onPress={aplicarManual}
              buttonColor={cictatColors.carbon}
              textColor="#FFFFFF"
              labelStyle={styles.bold}
            >
              Consultar
            </Button>
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={manejarExportarPDF}
              loading={exportandoPdf}
              disabled={exportandoPdf || !reporte}
              buttonColor={cictatColors.verde1}
              textColor="#FFFFFF"
              labelStyle={styles.bold}
            >
              {exportandoPdf ? 'Generando PDF…' : 'Generar Reporte PDF'}
            </Button>
          </View>
        </View>
      </View>

      {/* 1. KPIs Totales */}
      <View style={styles.kpisGrid}>
        <TarjetaKpi
          titulo="Total Solicitudes"
          valor={kpis.totalSolicitudes}
          subtitulo="Registradas en el periodo"
          icono="clipboard-text-multiple-outline"
          colorFondo={cictatColors.surfaceElevated}
          colorIcono={cictatColors.carbon}
        />
        <TarjetaKpi
          titulo="Aprobadas"
          valor={kpis.aprobadas}
          subtitulo="Con bloqueo +1h limpieza"
          icono="check-decagram"
          colorFondo="#E4F0E7"
          colorIcono={cictatColors.verde1}
        />
        <TarjetaKpi
          titulo="Pendientes"
          valor={kpis.pendientes}
          subtitulo="Por dictaminar en bandeja"
          icono="clock-outline"
          colorFondo={cictatColors.ochreSoft}
          colorIcono="#7A4E0E"
        />
        <TarjetaKpi
          titulo="Rechazo por Colisión Auto"
          valor={kpis.rechazadasPorColisionAutomatica}
          subtitulo="Trigger SQL automático"
          icono="lightning-bolt-circle"
          colorFondo={cictatColors.warningSoft}
          colorIcono={cictatColors.warning}
        />
        <TarjetaKpi
          titulo="Rechazo Manual"
          valor={kpis.rechazadasManual}
          subtitulo="Por dictamen del encargado"
          icono="close-octagon-outline"
          colorFondo={cictatColors.dangerSoft}
          colorIcono={cictatColors.danger}
        />
        <TarjetaKpi
          titulo="Canceladas"
          valor={kpis.canceladas}
          subtitulo="Liberadas posteriormente"
          icono="calendar-remove-outline"
          colorFondo={cictatColors.surface}
          colorIcono={cictatColors.textSecondary}
        />
      </View>

      {/* 2. Ranking de Uso por Espacio */}
      <View style={[styles.seccionCard, getTerracottaShadow({ border: 'structural' })]}>
        <Text variant="titleMedium" style={styles.titulo}>
          Ranking de Uso por Espacio (Salas 1–6 y Cubículos 7–9)
        </Text>
        <Text variant="bodySmall" style={styles.subtitulo}>
          Ordenado por horas aprobadas ocupadas y número de reservas en el periodo.
        </Text>

        <View style={styles.rankingLista}>
          {(reporte?.rankingEspacios ?? []).map((item, idx) => (
            <View key={item.espacioId} style={styles.rankingFila}>
              <View style={styles.rankingTop}>
                <View style={styles.rankingNombreWrap}>
                  <View style={styles.posicionBadge}>
                    <Text variant="labelSmall" style={styles.posicionTexto}>
                      #{idx + 1}
                    </Text>
                  </View>
                  <Text variant="labelLarge" style={styles.bold}>
                    {item.codigoEspacio} · {item.nombreEspacio}
                  </Text>
                </View>

                <Text variant="labelMedium" style={styles.rankingMetricas}>
                  {item.horasAprobadasOcupadas} h aprobadas · {item.numeroReservasAprobadas}{' '}
                  {item.numeroReservasAprobadas === 1 ? 'reserva' : 'reservas'} (
                  {item.totalSolicitudesEspacio} solic.)
                </Text>
              </View>

              <View style={styles.barraFondo}>
                <View
                  style={[
                    styles.barraRelleno,
                    {
                      width: `${Math.max(item.porcentajeRelativo, item.totalSolicitudesEspacio > 0 ? 8 : 0)}%`,
                      backgroundColor:
                        item.tipoEspacio === 'cubiculo_estudio'
                          ? cictatColors.verde2
                          : cictatColors.verde1,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 3. Distribución por Tipo de Usuario */}
      <View style={[styles.seccionCard, getTerracottaShadow({ border: 'structural' })]}>
        <Text variant="titleMedium" style={styles.titulo}>
          Distribución de Solicitudes por Perfil de Usuario
        </Text>
        <Text variant="bodySmall" style={styles.subtitulo}>
          Participación relativa de Alumnos de Posgrado, Doctores de Posgrado y Público General.
        </Text>

        <View style={styles.rankingLista}>
          {(reporte?.distribucionPorRol ?? []).map((d) => (
            <View key={d.rol} style={styles.rankingFila}>
              <View style={styles.rankingTop}>
                <Text variant="labelLarge" style={styles.bold}>
                  {d.etiqueta}
                </Text>
                <Text variant="labelLarge" style={styles.rankingMetricas}>
                  {d.conteo} solicitudes ({d.porcentaje}%)
                </Text>
              </View>
              <View style={styles.barraFondo}>
                <View
                  style={[
                    styles.barraRelleno,
                    {
                      width: `${Math.max(d.porcentaje, d.conteo > 0 ? 6 : 0)}%`,
                      backgroundColor:
                        d.rol === 'estudiante_posgrado'
                          ? cictatColors.verde2
                          : d.rol === 'doctor_posgrado'
                            ? cictatColors.verde1
                            : cictatColors.carbon,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 4. Bitácora de Auditoría (historial_estados_solicitud) */}
      <View style={[styles.seccionCard, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.bitacoraHeader}>
          <MaterialCommunityIcons name="history" size={22} color={cictatColors.carbon} />
          <Text variant="titleMedium" style={styles.titulo}>
            Bitácora de Auditoría (historial_estados_solicitud)
          </Text>
        </View>

        {!reporte || reporte.bitacoraReciente.length === 0 ? (
          <Text variant="bodySmall" style={styles.subtitulo}>
            Aún no hay movimientos registrados en la bitácora de auditoría para este rango.
          </Text>
        ) : (
          <View style={styles.bitacoraLista}>
            {reporte.bitacoraReciente.slice(0, 15).map((item) => (
              <View
                key={item.id}
                style={[
                  styles.bitacoraFila,
                  item.es_rechazo_automatico_colision && styles.bitacoraFilaColision,
                ]}
              >
                <View style={styles.bitacoraTop}>
                  <Text variant="labelMedium" style={styles.bold}>
                    Solicitud {formatearFolioCorto(item.solicitud_id)}:{' '}
                    {(item.estado_anterior ?? 'nueva').toUpperCase()} →{' '}
                    {item.estado_nuevo.toUpperCase()}
                  </Text>
                  <Text variant="labelSmall" style={styles.subtitulo}>
                    {new Date(item.fecha_cambio).toLocaleString('es-MX')}
                  </Text>
                </View>

                {item.es_rechazo_automatico_colision ? (
                  <Text variant="labelSmall" style={styles.tagAutoColision}>
                    ⚡ Rechazo automático por colisión ejecutado por Trigger SQL
                  </Text>
                ) : null}

                {item.motivo_cambio ? (
                  <Text variant="bodySmall" style={styles.bitacoraMotivo}>
                    {item.motivo_cambio}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <Snackbar
        visible={!!snackMensaje}
        onDismiss={() => setSnackMensaje(null)}
        duration={3500}
        action={{
          label: 'OK',
          onPress: () => setSnackMensaje(null),
        }}
      >
        {snackMensaje}
      </Snackbar>
    </View>
  );
};

const TarjetaKpi: React.FC<{
  titulo: string;
  valor: number;
  subtitulo: string;
  icono: IconName;
  colorFondo: string;
  colorIcono: string;
}> = ({ titulo, valor, subtitulo, icono, colorFondo, colorIcono }) => (
  <View
    style={[
      styles.kpiCard,
      { backgroundColor: colorFondo },
      getTerracottaShadow({ border: 'structural', intensity: 0.75 }),
    ]}
  >
    <View style={styles.kpiTop}>
      <Text variant="labelMedium" style={styles.kpiTitulo}>
        {titulo.toUpperCase()}
      </Text>
      <MaterialCommunityIcons name={icono} size={22} color={colorIcono} />
    </View>
    <Text variant="headlineMedium" style={styles.kpiValor}>
      {valor}
    </Text>
    <Text variant="bodySmall" style={styles.kpiSubtitulo}>
      {subtitulo}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  bold: { fontWeight: '800' },
  titulo: { color: cictatColors.carbon, fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },

  seccionCard: {
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
  atajosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  rangoInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fechaInput: {
    flex: 1,
    minWidth: 160,
    backgroundColor: cictatColors.surfaceElevated,
  },
  botonesAccionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    gap: 4,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  kpiTitulo: { color: cictatColors.carbon, fontWeight: '800', letterSpacing: 0.5 },
  kpiValor: { color: cictatColors.carbon, fontWeight: '900' },
  kpiSubtitulo: { color: cictatColors.textSecondary },

  rankingLista: { gap: spacing.md },
  rankingFila: { gap: 6 },
  rankingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rankingNombreWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  posicionBadge: {
    backgroundColor: cictatColors.carbon,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  posicionTexto: { color: '#FFFFFF', fontWeight: '800' },
  rankingMetricas: { color: cictatColors.textSecondary, fontWeight: '700' },
  barraFondo: {
    height: 12,
    backgroundColor: cictatColors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: radius.pill,
  },

  bitacoraHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bitacoraLista: { gap: spacing.sm },
  bitacoraFila: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
    padding: spacing.md,
    gap: 4,
  },
  bitacoraFilaColision: {
    backgroundColor: cictatColors.terracottaSoft,
    borderColor: cictatColors.terracotta,
  },
  bitacoraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagAutoColision: { color: cictatColors.terracotta, fontWeight: '800' },
  bitacoraMotivo: { color: cictatColors.carbon },
});
