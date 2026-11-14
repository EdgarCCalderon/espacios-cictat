/**
 * Vista 3 del Panel Administrativo — Gestión del Catálogo de Espacios y Mantenimiento.
 *
 * Permite al administrador:
 *  - Habilitar o poner en mantenimiento cada Sala (1–6) o Cubículo (7–9) en tiempo real.
 *  - Editar la capacidad, equipamiento incluido y reglamento de cualquier unidad.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import type { Espacio, UUID } from '@/domain/models';
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
  const [errorCapacidad, setErrorCapacidad] = useState<string | null>(null);

  const abrirEdicion = (espacio: Espacio) => {
    setEditando(espacio);
    setCapacidadTxt(String(espacio.capacidad));
    setEquipamientoTxt(espacio.equipamiento_incluido ?? '');
    setReglamentoTxt(espacio.reglamento ?? '');
    setErrorCapacidad(null);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const cap = Number.parseInt(capacidadTxt.trim(), 10);
    if (!Number.isFinite(cap) || cap < 1 || cap > 200) {
      setErrorCapacidad('Ingresa una capacidad válida (entre 1 y 200 personas).');
      return;
    }

    const ok = await onActualizarEspacio(editando.id, {
      capacidad: cap,
      equipamiento_incluido: equipamientoTxt.trim() || null,
      reglamento: reglamentoTxt.trim() || null,
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
          <Dialog.Content style={styles.dialogContent}>
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
          </Dialog.Content>
          <Dialog.Actions>
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
              buttonColor={cictatColors.terracotta}
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
    maxWidth: 500,
    width: '92%',
    alignSelf: 'center',
  },
  dialogContent: { gap: spacing.md },
  input: { backgroundColor: cictatColors.surfaceElevated },
});
