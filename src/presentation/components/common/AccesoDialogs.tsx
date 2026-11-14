/**
 * Diálogos de autenticación/acceso reutilizables (catálogo y detalle).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { ETIQUETA_ROL, type RolUsuario } from '@/domain/models';
import { cictatColors, getTerracottaShadow, radius, spacing } from '../../theme/cictatTheme';

interface BaseDialogProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Acceso exclusivo para Posgrado (Cubículos 7, 8 y 9)
// ─────────────────────────────────────────────────────────────────────────────

export interface AccesoPosgradoDialogProps extends BaseDialogProps {
  /** Rol de la sesión actual (si la hay) para personalizar el mensaje. */
  rolActual?: RolUsuario | null;
  onIniciarSesion: () => void;
}

export const AccesoPosgradoDialog: React.FC<AccesoPosgradoDialogProps> = ({
  visible,
  onDismiss,
  rolActual,
  onIniciarSesion,
}) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
      <View style={styles.iconoWrap}>
        <View style={styles.icono}>
          <MaterialCommunityIcons name="lock" size={30} color={cictatColors.carbon} />
        </View>
      </View>
      <Dialog.Title style={styles.titulo}>Acceso Exclusivo para Posgrado</Dialog.Title>
      <Dialog.Content style={styles.contenido}>
        <Text variant="bodyMedium" style={styles.texto}>
          Los <Text style={styles.bold}>Cubículos 7, 8 y 9</Text>, con capacidad para{' '}
          <Text style={styles.bold}>5 personas</Text>, son de uso exclusivo para{' '}
          <Text style={styles.bold}>Estudiantes de Posgrado</Text> de la DACyTI.
        </Text>
        {rolActual ? (
          <Text variant="bodySmall" style={styles.nota}>
            Actualmente iniciaste sesión como {ETIQUETA_ROL[rolActual]}. Para reservar un cubículo
            necesitas ingresar con una cuenta de Alumno de Posgrado.
          </Text>
        ) : (
          <Text variant="bodySmall" style={styles.nota}>
            Inicia sesión con tu cuenta institucional de posgrado para consultar su disponibilidad y
            solicitarlos.
          </Text>
        )}
        <Button
          mode="contained"
          icon="school"
          onPress={onIniciarSesion}
          style={[styles.cta, getTerracottaShadow({ border: 'none' })]}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          Iniciar sesión como Alumno de Posgrado
        </Button>
        <Button mode="text" onPress={onDismiss} textColor={cictatColors.textSecondary}>
          Ahora no
        </Button>
      </Dialog.Content>
    </Dialog>
  </Portal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Se requiere iniciar sesión para solicitar una reserva
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginRequeridoDialogProps extends BaseDialogProps {
  onIniciarSesion: () => void;
}

export const LoginRequeridoDialog: React.FC<LoginRequeridoDialogProps> = ({
  visible,
  onDismiss,
  onIniciarSesion,
}) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
      <View style={styles.iconoWrap}>
        <View style={styles.icono}>
          <MaterialCommunityIcons name="account-key" size={30} color={cictatColors.carbon} />
        </View>
      </View>
      <Dialog.Title style={styles.titulo}>Inicia sesión para continuar</Dialog.Title>
      <Dialog.Content style={styles.contenido}>
        <Text variant="bodyMedium" style={styles.texto}>
          Para capturar y enviar tu solicitud de reserva debes autenticarte. Podrás consultar el
          catálogo y el calendario sin iniciar sesión.
        </Text>
        <Button
          mode="contained"
          icon="login"
          onPress={onIniciarSesion}
          style={[styles.cta, getTerracottaShadow({ border: 'none' })]}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          Iniciar sesión
        </Button>
        <Button mode="text" onPress={onDismiss} textColor={cictatColors.textSecondary}>
          Ahora no
        </Button>
      </Dialog.Content>
    </Dialog>
  </Portal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Solicitud lista (marcador de posición hasta la fase del formulario)
// ─────────────────────────────────────────────────────────────────────────────

export interface SolicitudPreparadaDialogProps extends BaseDialogProps {
  resumen: string;
}

export const SolicitudPreparadaDialog: React.FC<SolicitudPreparadaDialogProps> = ({
  visible,
  onDismiss,
  resumen,
}) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
      <View style={styles.iconoWrap}>
        <View style={styles.icono}>
          <MaterialCommunityIcons name="calendar-check" size={30} color={cictatColors.carbon} />
        </View>
      </View>
      <Dialog.Title style={styles.titulo}>Horario seleccionado</Dialog.Title>
      <Dialog.Content style={styles.contenido}>
        <Text variant="bodyMedium" style={[styles.texto, styles.bold]}>
          {resumen}
        </Text>
        <Text variant="bodySmall" style={styles.nota}>
          El formulario para capturar los datos de la solicitud se habilita en la siguiente fase del
          proyecto.
        </Text>
        <Button mode="contained" onPress={onDismiss} style={styles.cta} labelStyle={styles.ctaLabel}>
          Entendido
        </Button>
      </Dialog.Content>
    </Dialog>
  </Portal>
);

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: cictatColors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 460,
  },
  iconoWrap: { alignItems: 'center', paddingTop: spacing.xl },
  icono: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.ochre,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { textAlign: 'center', color: cictatColors.carbon, fontWeight: '800' },
  contenido: { gap: spacing.md },
  texto: { color: cictatColors.carbon, textAlign: 'center' },
  nota: { color: cictatColors.textSecondary, textAlign: 'center' },
  bold: { fontWeight: '700' },
  cta: { borderRadius: radius.md },
  ctaContent: { paddingVertical: spacing.xs },
  ctaLabel: { fontWeight: '700' },
});
