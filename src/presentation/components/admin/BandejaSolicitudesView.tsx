/**
 * Vista 1 del Panel Administrativo — Bandeja de Solicitudes y Evaluación.
 *
 * Incluye:
 *  - Filtros por estado (`Pendientes`, `Aprobadas`, `Rechazadas`, `Canceladas`, `Todas`)
 *  - Botón "⚡ Generar Solicitudes Demo (Probar Colisión)"
 *  - Tarjetas con Folio corto, Sala/Cubículo, Fecha, Horario del evento + 1h de limpieza,
 *    datos del solicitante, alerta de colisión en memoria, documentos adjuntos y
 *    acciones de dictamen (Aprobar, Rechazar con motivo, Cancelar con motivo).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  ETIQUETA_ROL,
  type DocumentoSolicitud,
  type EstadoDictamen,
  type SolicitudAdminItem,
  type TipoDocumento,
  type UUID,
} from '@/domain/models';
import {
  esRechazoAutomaticoPorColision,
  formatearFechaLarga,
  formatearFolioCorto,
  formatearHoraLimpieza,
} from '@/domain/usecases';
import { generadorFormatoPDFService } from '@/application/services/GeneradorFormatoPDFService';
import type {
  ConteosBandejaAdmin,
  FiltroEstadoBandeja,
} from '../../controllers/usePanelAdminController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '../../theme/cictatTheme';

export interface BandejaSolicitudesViewProps {
  solicitudes: SolicitudAdminItem[];
  filtroEstado: FiltroEstadoBandeja;
  onChangeFiltro: (filtro: FiltroEstadoBandeja) => void;
  conteos: ConteosBandejaAdmin;
  procesandoId: string | null;
  onDictaminar: (
    solicitudId: UUID,
    nuevoEstado: EstadoDictamen,
    motivo?: string,
  ) => Promise<boolean>;
  onObtenerUrlDocumento: (storagePath: string) => Promise<string | null>;
}

const ETIQUETA_TIPO_DOC: Record<TipoDocumento, string> = {
  credencial_posgrado: 'Credencial Posgrado',
  ine_externo: 'Identificación INE',
  formato_pdf_prellenado: 'Formato Oficial PDF',
};

const FILTROS: { id: FiltroEstadoBandeja; label: string; icono: string }[] = [
  { id: 'pendiente', label: 'Pendientes', icono: 'clock-outline' },
  { id: 'aprobada', label: 'Aprobadas', icono: 'check-circle-outline' },
  { id: 'rechazada', label: 'Rechazadas', icono: 'close-circle-outline' },
  { id: 'cancelada', label: 'Canceladas', icono: 'cancel' },
  { id: 'todas', label: 'Todas', icono: 'format-list-bulleted' },
];

export const BandejaSolicitudesView: React.FC<BandejaSolicitudesViewProps> = ({
  solicitudes,
  filtroEstado,
  onChangeFiltro,
  conteos,
  procesandoId,
  onDictaminar,
  onObtenerUrlDocumento,
}) => {
  // Modal de motivo para rechazar / cancelar
  const [modalDictamen, setModalDictamen] = useState<{
    solicitud: SolicitudAdminItem;
    accion: 'rechazada' | 'cancelada';
  } | null>(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  // Modal de detalle de documento (para visualización de datos)
  const [docActivo, setDocActivo] = useState<DocumentoSolicitud | null>(null);

  const abrirModalMotivo = (
    solicitud: SolicitudAdminItem,
    accion: 'rechazada' | 'cancelada',
  ) => {
    setModalDictamen({ solicitud, accion });
    setMotivoTexto('');
    setErrorMotivo(null);
  };

  const confirmarRechazoOCancelacion = async () => {
    if (!modalDictamen) return;
    if (motivoTexto.trim().length < 5) {
      setErrorMotivo('Escribe un motivo claro (mínimo 5 caracteres).');
      return;
    }
    const { solicitud, accion } = modalDictamen;
    const ok = await onDictaminar(solicitud.id, accion, motivoTexto.trim());
    if (ok) {
      setModalDictamen(null);
      setMotivoTexto('');
    }
  };

  const manejarVerDocumento = async (
    doc: DocumentoSolicitud,
    solicitud: SolicitudAdminItem,
  ) => {
    // 1. Si es el formato PDF oficial pre-llenado, se regenera en vivo para visualizarlo o imprimirlo
    if (doc.tipo_documento === 'formato_pdf_prellenado' && solicitud.espacio && solicitud.usuario) {
      try {
        await generadorFormatoPDFService.regenerarYDescargarPDF(
          solicitud.usuario,
          solicitud.espacio,
          solicitud,
        );
        return;
      } catch (err) {
        console.warn('No se pudo regenerar el formato PDF:', err);
      }
    }

    // 2. Si es la Identificación (Credencial / INE) o documento adjunto:
    let urlFinal: string | null = null;
    if (doc.url_descarga && /^https?:\/\//i.test(doc.url_descarga)) {
      urlFinal = doc.url_descarga;
    } else if (doc.storage_path && !doc.storage_path.startsWith('demo/')) {
      urlFinal = await onObtenerUrlDocumento(doc.storage_path);
    }

    if (urlFinal) {
      // En Web: obtenemos el binario con fetch y forzamos el MIME Type correcto
      // para evitar que el navegador lo muestre como texto plano (%PDF-1.3...)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const res = await fetch(urlFinal);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const nombreLower = (doc.nombre_archivo || '').toLowerCase();
            let tipoMime = 'application/pdf';
            if (nombreLower.endsWith('.png')) {
              tipoMime = 'image/png';
            } else if (nombreLower.endsWith('.jpg') || nombreLower.endsWith('.jpeg')) {
              tipoMime = 'image/jpeg';
            }

            const cleanBlob = new Blob([buffer], { type: tipoMime });
            const blobUrl = URL.createObjectURL(cleanBlob);
            window.open(blobUrl, '_blank');
            return;
          }
        } catch (fetchErr) {
          console.warn('Error al abrir documento con MIME limpio:', fetchErr);
        }

        window.open(urlFinal, '_blank');
        return;
      }

      // En Móvil (iOS / Android)
      try {
        await Linking.openURL(urlFinal);
        return;
      } catch {
        // Fallback a modal
      }
    }

    setDocActivo(doc);
  };

  return (
    <View style={styles.contenedor}>
      {/* Cabecera institucional de solicitudes */}
      <View style={[styles.barraAcciones, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.barraTextos}>
          <Text variant="titleMedium" style={styles.barraTitulo}>
            Solicitudes de Reserva
          </Text>
          <Text variant="bodySmall" style={styles.barraSubtitulo}>
            Revisa y gestiona las solicitudes de salas y cubículos. Al aprobar una reserva se asigna automáticamente una hora de limpieza posterior para el espacio.
          </Text>
        </View>
      </View>

      {/* Banner de alerta si existen colisiones pendientes */}
      {conteos.colisionesPendientes > 0 ? (
        <View style={styles.alertaGlobalColision}>
          <MaterialCommunityIcons name="alert-decagram" size={22} color={cictatColors.warning} />
          <Text variant="bodySmall" style={styles.alertaGlobalTexto}>
            Hay <Text style={styles.bold}>{conteos.colisionesPendientes}</Text> solicitudes
            pendientes con traslape horario en el mismo espacio y fecha. Revisa las tarjetas marcadas
            con <Text style={styles.bold}>Colisión Pendiente</Text>.
          </Text>
        </View>
      ) : null}

      {/* Filtros por estado */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtrosScroll}
      >
        {FILTROS.map((f) => {
          const activo = filtroEstado === f.id;
          const cantidad = conteos[f.id];
          return (
            <Pressable
              key={f.id}
              onPress={() => onChangeFiltro(f.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              style={[styles.filtroChip, activo && styles.filtroChipActivo]}
            >
              <Text
                variant="labelLarge"
                style={[styles.filtroTexto, activo && styles.filtroTextoActivo]}
              >
                {f.label}
              </Text>
              <View style={[styles.contadorBadge, activo && styles.contadorBadgeActivo]}>
                <Text
                  variant="labelSmall"
                  style={[styles.contadorTexto, activo && styles.contadorTextoActivo]}
                >
                  {cantidad}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Lista de tarjetas de solicitud */}
      {solicitudes.length === 0 ? (
        <View style={[styles.vacioCard, getTerracottaShadow({ border: 'soft' })]}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={44}
            color={cictatColors.ochre}
          />
          <Text variant="titleMedium" style={styles.vacioTitulo}>
            No hay solicitudes en este filtro
          </Text>
          <Text variant="bodyMedium" style={styles.vacioSubtitulo}>
            Las nuevas solicitudes de reserva que envíen los solicitantes aparecerán aquí para su revisión.
          </Text>
        </View>
      ) : (
        <View style={styles.lista}>
          {solicitudes.map((sol) => {
            const folio = formatearFolioCorto(sol.id);
            const horaInicio = sol.hora_inicio.slice(0, 5);
            const horaFin = sol.hora_fin.slice(0, 5);
            const horaLimpieza = formatearHoraLimpieza(sol.hora_fin, sol.hora_fin_limpieza);
            const esAutoColision = esRechazoAutomaticoPorColision(sol);
            const procesandoEsta = procesandoId === sol.id;

            return (
              <View
                key={sol.id}
                style={[
                  styles.card,
                  getTerracottaShadow({ border: 'structural' }),
                  sol.tieneColisionPendiente && styles.cardColision,
                ]}
              >
                {/* Fila superior: Folio + Espacio + Badge de Estado */}
                <View style={styles.cardHeader}>
                  <View style={styles.folioRow}>
                    <View style={styles.folioTag}>
                      <Text variant="labelMedium" style={styles.folioTexto}>
                        FOLIO {folio}
                      </Text>
                    </View>
                    {sol.espacio ? (
                      <View style={styles.espacioTag}>
                        <MaterialCommunityIcons
                          name={
                            sol.espacio.tipo_espacio === 'cubiculo_estudio'
                              ? 'desk'
                              : 'presentation'
                          }
                          size={15}
                          color={cictatColors.carbon}
                        />
                        <Text variant="labelMedium" style={styles.espacioTagTexto}>
                          {sol.espacio.codigo_espacio} · {sol.espacio.nombre}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <BadgeEstadoSolicitud
                    estado={sol.estado}
                    esAutoColision={esAutoColision}
                  />
                </View>

                {/* Alerta de colisión pendiente */}
                {sol.tieneColisionPendiente ? (
                  <View style={styles.bannerColision}>
                    <MaterialCommunityIcons
                      name="alert-octagon"
                      size={20}
                      color={cictatColors.warning}
                    />
                    <View style={styles.bannerColisionTextos}>
                      <Text variant="labelLarge" style={styles.bannerColisionTitulo}>
                        Colisión Pendiente ({sol.colisionaConIds.length}{' '}
                        {sol.colisionaConIds.length === 1
                          ? 'solicitud en conflicto'
                          : 'solicitudes en conflicto'}
                        :{" "}
                        {sol.colisionaConIds.map(formatearFolioCorto).join(', ')})
                      </Text>
                      <Text variant="bodySmall" style={styles.bannerColisionDesc}>
                        Se traslapa en el mismo espacio y fecha considerando la hora de limpieza
                        (+1h). Si apruebas esta solicitud, las demás en conflicto se rechazarán
                        automáticamente.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Tema del evento */}
                <Text variant="titleMedium" style={styles.temaTitulo}>
                  {sol.tema_evento || 'Solicitud de reserva de espacio académico'}
                </Text>

                {/* Grilla de Fecha, Horario + Limpieza y Solicitante */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoCaja}>
                    <View style={styles.infoFila}>
                      <MaterialCommunityIcons
                        name="calendar-month"
                        size={18}
                        color={cictatColors.verde1}
                      />
                      <View style={styles.flex1}>
                        <Text variant="labelSmall" style={styles.infoLabel}>
                          FECHA DEL EVENTO
                        </Text>
                        <Text variant="bodyMedium" style={styles.infoValor}>
                          {formatearFechaLarga(sol.fecha_evento)} ({sol.fecha_evento})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoFila}>
                      <MaterialCommunityIcons
                        name="clock-check-outline"
                        size={18}
                        color={cictatColors.verde2}
                      />
                      <View style={styles.flex1}>
                        <Text variant="labelSmall" style={styles.infoLabel}>
                          HORARIO + 1H DE LIMPIEZA
                        </Text>
                        <Text variant="bodyMedium" style={styles.infoValor}>
                          Evento: {horaInicio} a {horaFin} hrs ·{' '}
                          <Text style={styles.limpiezaHighlight}>
                            Bloqueo hasta {horaLimpieza} hrs
                          </Text>
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoCaja}>
                    <View style={styles.infoFila}>
                      <MaterialCommunityIcons
                        name="account-badge-outline"
                        size={18}
                        color={cictatColors.carbon}
                      />
                      <View style={styles.flex1}>
                        <Text variant="labelSmall" style={styles.infoLabel}>
                          SOLICITANTE
                        </Text>
                        <Text variant="bodyMedium" style={styles.infoValor}>
                          {sol.usuario?.nombre_completo ?? 'Usuario Registrado'}
                        </Text>
                        <Text variant="bodySmall" style={styles.infoSubvalor}>
                          {sol.usuario ? ETIQUETA_ROL[sol.usuario.rol] : 'Comunidad CICTAT'}
                          {sol.usuario?.matricula ? ` · Matrícula: ${sol.usuario.matricula}` : ''}
                          {sol.usuario?.correo ? ` · ${sol.usuario.correo}` : ''}
                        </Text>
                        {sol.usuario?.dependencia_procedencia ? (
                          <Text variant="bodySmall" style={styles.infoSubvalor}>
                            Procedencia: {sol.usuario.dependencia_procedencia}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>

                {/* Documentos adjuntos */}
                <View style={styles.docsSeccion}>
                  <Text variant="labelSmall" style={styles.infoLabel}>
                    DOCUMENTACIÓN ADJUNTA ({sol.documentos.length})
                  </Text>
                  {sol.documentos.length === 0 ? (
                    <Text variant="bodySmall" style={styles.sinDocs}>
                      Sin documentos adjuntos registrados.
                    </Text>
                  ) : (
                    <View style={styles.docsRow}>
                      {sol.documentos.map((doc) => (
                        <Pressable
                          key={doc.id}
                          onPress={() => void manejarVerDocumento(doc, sol)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.docChip,
                            pressed && styles.docChipPressed,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="file-pdf-box"
                            size={18}
                            color={sol.estado === 'rechazada' ? cictatColors.warning : '#71717A'}
                          />
                          <View style={styles.docTextos}>
                            <Text variant="labelSmall" style={styles.docTipo}>
                              {ETIQUETA_TIPO_DOC[doc.tipo_documento] ?? doc.tipo_documento}
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={styles.docNombre}
                              numberOfLines={1}
                            >
                              {doc.nombre_archivo}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="open-in-new"
                            size={14}
                            color={cictatColors.textSecondary}
                          />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Motivo de rechazo o cancelación (si existe) */}
                {sol.motivo_rechazo_cancelacion ? (
                  <View
                    style={[
                      styles.motivoCaja,
                      esAutoColision && styles.motivoCajaAutoColision,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={esAutoColision ? 'lightning-bolt-circle' : 'comment-alert-outline'}
                      size={18}
                      color={esAutoColision ? cictatColors.terracotta : cictatColors.danger}
                    />
                    <View style={styles.flex1}>
                      <Text variant="labelSmall" style={styles.motivoEtiqueta}>
                        {esAutoColision
                          ? 'MOTIVO (RECHAZO AUTOMÁTICO POR COLISIÓN EN BD)'
                          : 'MOTIVO DE DICTAMEN / CANCELACIÓN'}
                      </Text>
                      <Text variant="bodySmall" style={styles.motivoTexto}>
                        {sol.motivo_rechazo_cancelacion}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Botones de Acción según estado */}
                {sol.estado === 'pendiente' ? (
                  <View style={styles.accionesFila}>
                    <Button
                      mode="contained"
                      icon="check-bold"
                      loading={procesandoEsta}
                      disabled={!!procesandoId}
                      onPress={() => void onDictaminar(sol.id, 'aprobada')}
                      buttonColor={cictatColors.success}
                      textColor="#FFFFFF"
                      style={styles.btnAprobar}
                      labelStyle={styles.bold}
                    >
                      Aprobar Reserva (+1h Limpieza)
                    </Button>

                    <Button
                      mode="outlined"
                      icon="close-thick"
                      disabled={!!procesandoId}
                      onPress={() => abrirModalMotivo(sol, 'rechazada')}
                      textColor={cictatColors.danger}
                      style={styles.btnRechazar}
                      labelStyle={styles.bold}
                    >
                      Rechazar con Motivo
                    </Button>
                  </View>
                ) : sol.estado === 'aprobada' ? (
                  <View style={styles.accionesFila}>
                    <Button
                      mode="outlined"
                      icon="calendar-remove"
                      disabled={!!procesandoId}
                      onPress={() => abrirModalMotivo(sol, 'cancelada')}
                      textColor={cictatColors.carbon}
                      style={styles.btnCancelar}
                      labelStyle={styles.bold}
                    >
                      Cancelar Reserva Aprobada
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* Modal para capturar motivo de Rechazo o Cancelación */}
      <Portal>
        <Dialog
          visible={!!modalDictamen}
          onDismiss={() => setModalDictamen(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitulo}>
            {modalDictamen?.accion === 'rechazada'
              ? 'Rechazar Solicitud de Reserva'
              : 'Cancelar Reserva Aprobada'}
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {modalDictamen ? (
              <Text variant="bodySmall" style={styles.dialogSubtitulo}>
                Folio {formatearFolioCorto(modalDictamen.solicitud.id)} ·{' '}
                {modalDictamen.solicitud.espacio?.nombre ?? ''} (
                {modalDictamen.solicitud.fecha_evento})
              </Text>
            ) : null}

            <TextInput
              mode="outlined"
              label={
                modalDictamen?.accion === 'rechazada'
                  ? 'Motivo del rechazo *'
                  : 'Motivo de la cancelación *'
              }
              placeholder="Ej. El espacio será utilizado para examen de grado institucional..."
              value={motivoTexto}
              onChangeText={(v) => {
                setMotivoTexto(v);
                if (errorMotivo) setErrorMotivo(null);
              }}
              multiline
              numberOfLines={3}
              error={!!errorMotivo}
              style={styles.dialogInput}
            />
            {errorMotivo ? (
              <HelperText type="error" visible padding="none">
                {errorMotivo}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setModalDictamen(null)}
              textColor={cictatColors.textSecondary}
            >
              Volver
            </Button>
            <Button
              mode="contained"
              onPress={() => void confirmarRechazoOCancelacion()}
              loading={!!procesandoId}
              buttonColor={
                modalDictamen?.accion === 'rechazada'
                  ? cictatColors.danger
                  : cictatColors.terracotta
              }
              textColor="#FFFFFF"
              labelStyle={styles.bold}
            >
              Confirmar
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Modal de ficha de documento adjunto */}
        <Dialog
          visible={!!docActivo}
          onDismiss={() => setDocActivo(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitulo}>Documento Adjunto</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {docActivo ? (
              <View style={styles.docModalBox}>
                <MaterialCommunityIcons
                  name="file-certificate-outline"
                  size={34}
                  color={cictatColors.terracotta}
                />
                <Text variant="titleSmall" style={styles.bold}>
                  {docActivo.nombre_archivo}
                </Text>
                <Text variant="bodySmall" style={styles.dialogSubtitulo}>
                  Tipo: {ETIQUETA_TIPO_DOC[docActivo.tipo_documento] ?? docActivo.tipo_documento}
                </Text>
                <Text variant="bodySmall" style={styles.dialogSubtitulo} selectable>
                  Ruta en Storage: {docActivo.storage_path}
                </Text>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="contained"
              onPress={() => setDocActivo(null)}
              buttonColor={cictatColors.carbon}
              textColor="#FFFFFF"
            >
              Cerrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const BadgeEstadoSolicitud: React.FC<{
  estado: SolicitudAdminItem['estado'];
  esAutoColision: boolean;
}> = ({ estado, esAutoColision }) => {
  if (estado === 'aprobada') {
    return (
      <View style={[styles.estadoBadge, styles.estadoAprobada]}>
        <MaterialCommunityIcons name="check-circle" size={14} color={cictatColors.success} />
        <Text variant="labelMedium" style={{ color: cictatColors.success, fontWeight: '800' }}>
          Aprobada
        </Text>
      </View>
    );
  }
  if (estado === 'rechazada') {
    return (
      <View style={[styles.estadoBadge, styles.estadoRechazada]}>
        <MaterialCommunityIcons
          name={esAutoColision ? 'lightning-bolt' : 'close-circle'}
          size={14}
          color={cictatColors.danger}
        />
        <Text variant="labelMedium" style={{ color: cictatColors.danger, fontWeight: '800' }}>
          {esAutoColision ? 'Rechazada (Colisión Auto)' : 'Rechazada'}
        </Text>
      </View>
    );
  }
  if (estado === 'cancelada') {
    return (
      <View style={[styles.estadoBadge, styles.estadoCancelada]}>
        <MaterialCommunityIcons name="cancel" size={14} color={cictatColors.textSecondary} />
        <Text
          variant="labelMedium"
          style={{ color: cictatColors.textSecondary, fontWeight: '800' }}
        >
          Cancelada
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.estadoBadge, styles.estadoPendiente]}>
      <MaterialCommunityIcons name="clock-outline" size={14} color="#7A4E0E" />
      <Text variant="labelMedium" style={{ color: '#7A4E0E', fontWeight: '800' }}>
        Pendiente de Dictamen
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  bold: { fontWeight: '800' },
  flex1: { flex: 1, gap: 2 },

  barraAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  barraTextos: { flex: 1, minWidth: 240, gap: 4 },
  barraTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  barraSubtitulo: { color: cictatColors.textSecondary },
  botonDemo: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
  },
  botonDemoLabel: { fontWeight: '800' },

  alertaGlobalColision: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.warningSoft,
    borderColor: cictatColors.warning,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  alertaGlobalTexto: { flex: 1, color: cictatColors.carbon },

  filtrosScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filtroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.surfaceElevated,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
  },
  filtroChipActivo: {
    backgroundColor: cictatColors.carbon,
  },
  filtroTexto: { color: cictatColors.carbon, fontWeight: '800' },
  filtroTextoActivo: { color: '#FFFFFF' },
  contadorBadge: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  contadorBadgeActivo: {
    backgroundColor: cictatColors.verde1,
  },
  contadorTexto: { color: cictatColors.carbon, fontWeight: '800' },
  contadorTextoActivo: { color: '#FFFFFF' },

  vacioCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  vacioTitulo: { color: cictatColors.carbon, fontWeight: '800', textAlign: 'center' },
  vacioSubtitulo: { color: cictatColors.textSecondary, textAlign: 'center', maxWidth: 520 },

  lista: { gap: spacing.lg },
  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardColision: {
    borderColor: cictatColors.warning,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  folioTag: {
    backgroundColor: cictatColors.carbon,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  folioTexto: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.6 },
  espacioTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: cictatColors.verde1Soft,
    borderColor: cictatColors.verde1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  espacioTagTexto: { color: cictatColors.carbon, fontWeight: '800' },

  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
  },
  estadoPendiente: { backgroundColor: cictatColors.warningSoft, borderColor: cictatColors.warning },
  estadoAprobada: { backgroundColor: cictatColors.verde1Soft, borderColor: cictatColors.verde1 },
  estadoRechazada: { backgroundColor: cictatColors.dangerSoft, borderColor: cictatColors.danger },
  estadoCancelada: { backgroundColor: cictatColors.surface, borderColor: cictatColors.borderSoft },

  bannerColision: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: cictatColors.warningSoft,
    borderColor: cictatColors.warning,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerColisionTextos: { flex: 1, gap: 2 },
  bannerColisionTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  bannerColisionDesc: { color: cictatColors.carbon },

  temaTitulo: { color: cictatColors.carbon, fontWeight: '800' },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoCaja: {
    flex: 1,
    minWidth: 250,
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  infoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoLabel: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  infoValor: { color: cictatColors.carbon, fontWeight: '700' },
  infoSubvalor: { color: cictatColors.textSecondary },
  limpiezaHighlight: { color: cictatColors.terracotta, fontWeight: '800' },

  docsSeccion: { gap: spacing.xs + 2 },
  sinDocs: { color: cictatColors.textSecondary, fontStyle: 'italic' },
  docsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.carbon,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    maxWidth: 320,
  },
  docChipPressed: { opacity: 0.75 },
  docTextos: { flexShrink: 1 },
  docTipo: { color: cictatColors.textSecondary, fontWeight: '800' },
  docNombre: { color: cictatColors.carbon, fontWeight: '700' },

  motivoCaja: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FDF2F0',
    borderColor: cictatColors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  motivoCajaAutoColision: {
    backgroundColor: cictatColors.warningSoft,
    borderColor: cictatColors.warning,
  },
  motivoEtiqueta: { color: cictatColors.carbon, fontWeight: '800', letterSpacing: 0.5 },
  motivoTexto: { color: cictatColors.carbon, fontWeight: '600' },

  accionesFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: cictatColors.borderSoft,
    paddingTop: spacing.md,
  },
  btnAprobar: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
  },
  btnRechazar: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.danger,
  },
  btnCancelar: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
  },

  dialog: {
    backgroundColor: cictatColors.background,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    maxWidth: 480,
    width: '92%',
    alignSelf: 'center',
  },
  dialogTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  dialogContent: { gap: spacing.sm },
  dialogSubtitulo: { color: cictatColors.textSecondary },
  dialogInput: { backgroundColor: cictatColors.surfaceElevated },
  docModalBox: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs + 2,
    alignItems: 'flex-start',
  },
});
