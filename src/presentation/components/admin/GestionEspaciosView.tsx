/**
 * Vista 3 del Panel Administrativo — Gestión del Catálogo de Espacios y Mantenimiento.
 *
 * Permite al administrador:
 *  - Habilitar o poner en mantenimiento cada Sala (1–6) o Cubículo (7–9) en tiempo real.
 *  - Editar la capacidad, equipamiento incluido y reglamento de cualquier unidad.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import { obtenerImagenesEspacio, type Espacio, type UUID } from '@/domain/models';
import { BadgeEstadoEspacio, BadgeExclusivo } from '../catalogo/Badges';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '../../theme/cictatTheme';

export interface GestionEspaciosViewProps {
  espacios: Espacio[];
  procesandoId: string | null;
  onToggleEstado: (espacioId: UUID, estaActivo: boolean) => Promise<boolean>;
  onActualizarEspacio: (espacioId: UUID, datos: Partial<Espacio>) => Promise<boolean>;
}

export const GestionEspaciosView: React.FC<GestionEspaciosViewProps> = ({
  espacios,
  procesandoId,
  onToggleEstado,
  onActualizarEspacio,
}) => {
  const [editando, setEditando] = useState<Espacio | null>(null);
  const [capacidadTxt, setCapacidadTxt] = useState('');
  const [equipamientoTxt, setEquipamientoTxt] = useState('');
  const [reglamentoTxt, setReglamentoTxt] = useState('');
  const [imagenes, setImagenes] = useState<string[]>(['', '', '']);
  const [errorCapacidad, setErrorCapacidad] = useState<string | null>(null);

  const abrirEdicion = (espacio: Espacio) => {
    setEditando(espacio);
    setCapacidadTxt(String(espacio.capacidad));
    setEquipamientoTxt(espacio.equipamiento_incluido ?? '');
    setReglamentoTxt(espacio.reglamento ?? '');
    const imgs = obtenerImagenesEspacio(espacio);
    setImagenes([imgs[0] ?? '', imgs[1] ?? '', imgs[2] ?? '']);
    setErrorCapacidad(null);
  };

  const seleccionarFotoJpg = async (idx: number) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/jpg'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const uri = res.assets[0].uri;
        const copia = [...imagenes];
        copia[idx] = uri;
        setImagenes(copia);
      }
    } catch (err) {
      console.warn('[GestionEspacios] Error seleccionando JPG:', err);
    }
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const cap = Number.parseInt(capacidadTxt.trim(), 10);
    if (!Number.isFinite(cap) || cap < 1 || cap > 200) {
      setErrorCapacidad('Ingresa una capacidad válida (entre 1 y 200 personas).');
      return;
    }

    const imgsLimpias = imagenes.map((s) => s.trim()).filter(Boolean);

    const ok = await onActualizarEspacio(editando.id, {
      capacidad: cap,
      equipamiento_incluido: equipamientoTxt.trim() || null,
      reglamento: reglamentoTxt.trim() || null,
      imagen_url: imgsLimpias.length > 0 ? imgsLimpias.join('||') : null,
      imagenes: imgsLimpias,
    });
    if (ok) {
      setEditando(null);
    }
  };

  const disponiblesCount = espacios.filter((e) => e.esta_activo).length;
  const mantenimientoCount = espacios.length - disponiblesCount;

  return (
    <View style={styles.contenedor}>
      {/* Resumen superior */}
      <View style={[styles.headerCard, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.headerTextos}>
          <Text variant="titleMedium" style={styles.titulo}>
            Control Operativo de Salas y Cubículos ({espacios.length} unidades)
          </Text>
          <Text variant="bodySmall" style={styles.subtitulo}>
            Activa o desactiva espacios por mantenimiento y actualiza su equipamiento o reglamento.
            Los cambios se reflejan al instante en el catálogo público vía Realtime.
          </Text>
        </View>

        <View style={styles.resumenBadges}>
          <View style={[styles.resumenChip, { backgroundColor: '#E4F0E7' }]}>
            <Text variant="labelMedium" style={{ color: cictatColors.success, fontWeight: '800' }}>
              {disponiblesCount} Disponibles
            </Text>
          </View>
          <View style={[styles.resumenChip, { backgroundColor: cictatColors.ochreSoft }]}>
            <Text variant="labelMedium" style={{ color: '#7A4E0E', fontWeight: '800' }}>
              {mantenimientoCount} En Mantenimiento
            </Text>
          </View>
        </View>
      </View>

      {/* Grilla de tarjetas de espacios */}
      <View style={styles.grid}>
        {espacios.map((esp) => {
          const procesandoEste = procesandoId === esp.id;

          return (
            <View
              key={esp.id}
              style={[
                styles.card,
                getTerracottaShadow({ border: 'structural' }),
                !esp.esta_activo && styles.cardMantenimiento,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.codigoTag}>
                  <Text variant="labelMedium" style={styles.codigoTexto}>
                    {esp.codigo_espacio}
                  </Text>
                </View>
                <BadgeEstadoEspacio activo={esp.esta_activo} />
              </View>

              <Text variant="titleLarge" style={styles.espNombre}>
                {esp.nombre}
              </Text>

              <View style={styles.metaRow}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={18}
                  color={cictatColors.ochre}
                />
                <Text variant="bodyMedium" style={styles.bold}>
                  Capacidad: {esp.capacidad} personas
                </Text>
                <Text variant="bodySmall" style={styles.subtitulo}>
                  · {esp.tipo_espacio === 'cubiculo_estudio' ? 'Cubículo de estudio' : 'Sala de posgrado'}
                </Text>
              </View>

              {esp.exclusivo_alumnos_posgrado ? <BadgeExclusivo desbloqueado /> : null}

              <View style={styles.infoBloque}>
                <Text variant="labelSmall" style={styles.infoLabel}>
                  EQUIPAMIENTO INCLUIDO
                </Text>
                <Text variant="bodySmall" style={styles.infoTexto}>
                  {esp.equipamiento_incluido || 'Sin equipamiento especificado.'}
                </Text>
              </View>

              {esp.reglamento ? (
                <View style={styles.infoBloque}>
                  <Text variant="labelSmall" style={styles.infoLabel}>
                    REGLAMENTO ESPECÍFICO
                  </Text>
                  <Text variant="bodySmall" style={styles.infoTexto} numberOfLines={2}>
                    {esp.reglamento}
                  </Text>
                </View>
              ) : null}

              {/* Controles de Mantenimiento y Edición */}
              <View style={styles.controlesFooter}>
                <View style={styles.switchWrap}>
                  <Switch
                    value={esp.esta_activo}
                    disabled={procesandoEste}
                    onValueChange={(val) => void onToggleEstado(esp.id, val)}
                    color={cictatColors.success}
                  />
                  <Text variant="labelMedium" style={styles.switchLabel}>
                    {esp.esta_activo ? 'Operativo' : 'Mantenimiento'}
                  </Text>
                </View>

                <Button
                  mode="outlined"
                  compact
                  icon="pencil-outline"
                  disabled={procesandoEste}
                  onPress={() => abrirEdicion(esp)}
                  textColor={cictatColors.carbon}
                  style={styles.btnEditar}
                  labelStyle={styles.bold}
                >
                  Editar Ficha
                </Button>
              </View>
            </View>
          );
        })}
      </View>

      {/* Modal de edición de espacio */}
      <Portal>
        <Dialog
          visible={!!editando}
          onDismiss={() => setEditando(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.titulo}>
            Editar {editando?.codigo_espacio} · {editando?.nombre}
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView
              contentContainerStyle={styles.dialogScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <View>
                <TextInput
                  mode="outlined"
                  label="Capacidad máxima (personas) *"
                  keyboardType="number-pad"
                  value={capacidadTxt}
                  onChangeText={(v) => {
                    setCapacidadTxt(v);
                    if (errorCapacidad) setErrorCapacidad(null);
                  }}
                  error={!!errorCapacidad}
                  left={<TextInput.Icon icon="account-group-outline" />}
                  style={styles.input}
                />
                {errorCapacidad ? (
                  <HelperText type="error" visible padding="none">
                    {errorCapacidad}
                  </HelperText>
                ) : null}
              </View>

              <TextInput
                mode="outlined"
                label="Equipamiento incluido"
                placeholder="Ej. Proyector HDMI, pizarrón, laptop y contactos eléctricos"
                value={equipamientoTxt}
                onChangeText={setEquipamientoTxt}
                multiline
                numberOfLines={3}
                style={styles.input}
              />

              <TextInput
                mode="outlined"
                label="Reglamento del espacio"
                placeholder="Ej. Prohibido ingresar alimentos; dejar limpio al finalizar..."
                value={reglamentoTxt}
                onChangeText={setReglamentoTxt}
                multiline
                numberOfLines={3}
                style={styles.input}
              />

              {/* Apartado para subir hasta 3 fotografías del espacio */}
              <View style={styles.seccionFotos}>
                <View style={styles.seccionFotosHeader}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={20} color={cictatColors.verde1} />
                  <View style={styles.seccionFotosTextos}>
                    <Text variant="titleSmall" style={styles.seccionFotosTitulo}>
                      Galería Fotográfica del Espacio (Hasta 3 imágenes)
                    </Text>
                    <Text variant="bodySmall" style={styles.seccionFotosSub}>
                      Solo se mostrarán al usuario cuando ingrese a la sala.
                    </Text>
                  </View>
                </View>

                <View style={styles.slotsFotosContenedor}>
                  {[0, 1, 2].map((idx) => {
                    const img = imagenes[idx];
                    const titulos = [
                      'Foto 1 (.jpg) · Vista Principal',
                      'Foto 2 (.jpg) · Pizarrón y Pantalla',
                      'Foto 3 (.jpg) · Conexiones y Capacidad',
                    ];

                    return (
                      <View key={idx} style={styles.slotFotoItem}>
                        <View style={styles.slotFotoHeader}>
                          <Text variant="labelSmall" style={styles.slotFotoTitulo}>
                            {titulos[idx]}
                          </Text>
                          {img ? (
                            <Button
                              compact
                              mode="text"
                              icon="trash-can-outline"
                              textColor={cictatColors.danger}
                              onPress={() => {
                                const copia = [...imagenes];
                                copia[idx] = '';
                                setImagenes(copia);
                              }}
                              labelStyle={styles.btnQuitarLabel}
                            >
                              Quitar
                            </Button>
                          ) : null}
                        </View>

                        {img ? (
                          <View style={styles.previewFotoWrap}>
                            <Image source={{ uri: img }} style={styles.previewFotoImg} resizeMode="cover" />
                            <View style={styles.previewBadgeJpg}>
                              <Text variant="labelSmall" style={styles.previewBadgeJpgTexto}>
                                JPG Cargado
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.slotFotoVacio}>
                            <MaterialCommunityIcons name="camera-plus-outline" size={22} color="#71717A" />
                            <Text variant="bodySmall" style={styles.slotFotoVacioTexto}>
                              Espacio reservado para archivo JPG
                            </Text>
                            <Button
                              mode="outlined"
                              compact
                              icon="upload"
                              onPress={() => void seleccionarFotoJpg(idx)}
                              style={styles.btnSubirJpg}
                              labelStyle={styles.btnSubirJpgLabel}
                              textColor={cictatColors.carbon}
                            >
                              Subir JPG
                            </Button>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setEditando(null)}
              textColor={cictatColors.textSecondary}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              icon="content-save-outline"
              loading={!!editando && procesandoId === editando.id}
              onPress={() => void guardarEdicion()}
              buttonColor={cictatColors.verde1}
              textColor="#FFFFFF"
              labelStyle={styles.bold}
            >
              Guardar Cambios
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  bold: { fontWeight: '800' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  headerTextos: { flex: 1, minWidth: 240, gap: 4 },
  titulo: { color: cictatColors.carbon, fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },
  resumenBadges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  resumenChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  card: {
    flexGrow: 1,
    flexBasis: 310,
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  cardMantenimiento: {
    backgroundColor: cictatColors.surface,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codigoTag: {
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.carbon,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  codigoTexto: { color: cictatColors.carbon, fontWeight: '800', letterSpacing: 0.7 },
  espNombre: { color: cictatColors.carbon, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },

  infoBloque: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
    gap: 2,
  },
  infoLabel: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  infoTexto: { color: cictatColors.carbon },

  controlesFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: cictatColors.borderSoft,
    paddingTop: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  switchLabel: { color: cictatColors.carbon, fontWeight: '800' },
  btnEditar: {
    borderRadius: radius.md,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
  },

  dialog: {
    backgroundColor: cictatColors.background,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    maxWidth: 540,
    width: '94%',
    alignSelf: 'center',
    maxHeight: '90%',
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    flexShrink: 1,
  },
  dialogScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  input: { backgroundColor: cictatColors.surfaceElevated },

  seccionFotos: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  seccionFotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seccionFotosTextos: { flex: 1, gap: 2 },
  seccionFotosTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  seccionFotosSub: {
    color: '#64748B',
    lineHeight: 16,
  },
  slotsFotosContenedor: { gap: spacing.sm },
  slotFotoItem: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  slotFotoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotFotoTitulo: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  btnQuitarLabel: { fontSize: 11, fontWeight: '700' },
  previewFotoWrap: {
    position: 'relative',
    height: 110,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewFotoImg: {
    width: '100%',
    height: '100%',
  },
  previewBadgeJpg: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: cictatColors.verde1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  previewBadgeJpgTexto: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  slotFotoVacio: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    gap: 4,
  },
  slotFotoVacioTexto: {
    color: '#64748B',
    fontSize: 12,
  },
  btnSubirJpg: {
    borderColor: '#94A3B8',
    borderRadius: radius.pill,
    marginTop: 2,
  },
  btnSubirJpgLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
