/**
 * /solicitud/nueva — Pantalla placeholder limpia lista para la Fase 5
 * (Formulario de Solicitud de Reserva).
 *
 * Recibe `espacioId`, `fecha` y opcionalmente `horaInicio` / `horaFin`.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { ETIQUETA_ROL } from '@/domain/models';
import { formatearFechaLarga } from '@/domain/usecases';
import { AuthScreenContainer } from '@/presentation/components/auth/AuthLayout';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { useAuth } from '@/presentation/context/AuthContext';
import { normalizarParametro } from '@/presentation/controllers/useAuthController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

export default function NuevaSolicitudPlaceholderScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const raw = useLocalSearchParams<{
    espacioId?: string;
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
  }>();

  const espacioId = normalizarParametro(raw.espacioId);
  const fecha = normalizarParametro(raw.fecha);
  const horaInicio = normalizarParametro(raw.horaInicio);
  const horaFin = normalizarParametro(raw.horaFin);

  const volverAlEspacio = () => {
    if (espacioId) {
      router.replace({ pathname: '/espacio/[id]', params: { id: espacioId } });
      return;
    }
    router.replace('/');
  };

  return (
    <AuthScreenContainer etiquetaVolver="Calendario" onVolver={volverAlEspacio} maxWidth={580}>
      <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="calendar-edit" size={32} color={cictatColors.carbon} />
        </View>

        <BrushTitle text="Nueva Solicitud de Reserva" highlight="Reserva" size="md" />

        <Text variant="bodyMedium" style={styles.descripcion}>
          Tu sesión y permisos han sido verificados correctamente. Esta pantalla está lista para el
          formulario completo de captura de la Fase 5.
        </Text>

        <View style={styles.resumenBox}>
          <View style={styles.fila}>
            <Text variant="labelSmall" style={styles.etiqueta}>
              SOLICITANTE AUTENTICADO
            </Text>
            <Text variant="bodyMedium" style={styles.valor}>
              {perfil?.nombre_completo ?? user?.email ?? 'Sesión activa'}
              {perfil ? ` · ${ETIQUETA_ROL[perfil.rol]}` : ''}
              {perfil?.matricula ? ` (${perfil.matricula})` : ''}
            </Text>
          </View>

          {espacioId ? (
            <View style={styles.fila}>
              <Text variant="labelSmall" style={styles.etiqueta}>
                ID DEL ESPACIO
              </Text>
              <Text variant="bodyMedium" style={styles.valor}>
                {espacioId}
              </Text>
            </View>
          ) : null}

          {fecha ? (
            <View style={styles.fila}>
              <Text variant="labelSmall" style={styles.etiqueta}>
                FECHA SELECCIONADA
              </Text>
              <Text variant="bodyMedium" style={styles.valor}>
                {formatearFechaLarga(fecha)} ({fecha})
              </Text>
            </View>
          ) : null}

          {horaInicio && horaFin ? (
            <View style={styles.fila}>
              <Text variant="labelSmall" style={styles.etiqueta}>
                BLOQUE HORARIO
              </Text>
              <Text variant="bodyMedium" style={styles.valor}>
                {horaInicio} a {horaFin} hrs (+ 1 h de limpieza)
              </Text>
            </View>
          ) : null}
        </View>

        <Button
          mode="contained"
          icon="arrow-left"
          onPress={volverAlEspacio}
          buttonColor={cictatColors.terracotta}
          textColor="#FFFFFF"
          style={styles.boton}
          labelStyle={styles.botonLabel}
        >
          Volver al calendario del espacio
        </Button>
      </View>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md + 2,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.ochre,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descripcion: { color: cictatColors.textSecondary },
  resumenBox: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  fila: { gap: 2 },
  etiqueta: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  valor: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  boton: { borderRadius: radius.md, marginTop: spacing.xs },
  botonLabel: { fontWeight: '800' },
});
