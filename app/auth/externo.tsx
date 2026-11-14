/**
 * A-03: Login y Registro Público General (/auth/externo).
 *
 * Incluye pestañas con `SegmentedButtons` ("Iniciar Sesión" y "Crear Cuenta")
 * para usuarios externos (acceso a Salas 1 a 6).
 */
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import {
  AuthConfirmacionBanner,
  AuthErrorBanner,
  AuthScreenContainer,
} from '@/presentation/components/auth/AuthLayout';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import {
  normalizarParametro,
  useAuthController,
} from '@/presentation/controllers/useAuthController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

type TabExterno = 'login' | 'registro';

export default function ExternoAuthScreen() {
  const rawParams = useLocalSearchParams<{
    espacioId?: string;
    returnTo?: string;
    fecha?: string;
  }>();

  const returnTo = normalizarParametro(rawParams.returnTo);
  const espacioId = normalizarParametro(rawParams.espacioId);
  const fecha = normalizarParametro(rawParams.fecha);

  const {
    cargando,
    error,
    mensajeConfirmacion,
    errorCampo,
    limpiarMensajes,
    iniciarSesionExterno,
    registrarExterno,
  } = useAuthController({ returnTo, espacioId, fecha });

  const [tab, setTab] = useState<TabExterno>('login');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dependenciaProcedencia, setDependenciaProcedencia] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const cambiarTab = (valor: string) => {
    setTab(valor === 'registro' ? 'registro' : 'login');
    limpiarMensajes();
  };

  const enviar = async () => {
    if (tab === 'login') {
      const res = await iniciarSesionExterno({ correo, password });
      if (!res.ok && res.error.codigo === 'perfil_incompleto') {
        setTab('registro');
      }
      return;
    }

    await registrarExterno({
      nombreCompleto,
      correo,
      telefono,
      dependenciaProcedencia,
      password,
    });
  };

  const errNombre = errorCampo('nombreCompleto');
  const errCorreo = errorCampo('correo');
  const errTelefono = errorCampo('telefono');
  const errDependencia = errorCampo('dependenciaProcedencia');
  const errPassword = errorCampo('password');

  const sugerirRegistro =
    tab === 'login' &&
    error &&
    (error.codigo === 'credenciales_invalidas' || error.codigo === 'perfil_incompleto');

  return (
    <AuthScreenContainer etiquetaVolver="Perfiles">
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text variant="labelMedium" style={styles.badgeTexto}>
            Público General · Salas 1 a 6
          </Text>
        </View>

        <BrushTitle text="Acceso Público General" highlight="Público" size="lg" />
        <Text variant="bodyMedium" style={styles.subtitulo}>
          Inicia sesión o crea una cuenta para solicitar la reserva de las Salas de Posgrado 1 a 6
          en el CICTAT.
        </Text>
      </View>

      <SegmentedButtons
        value={tab}
        onValueChange={cambiarTab}
        buttons={[
          {
            value: 'login',
            label: 'Iniciar Sesión',
            icon: 'login',
          },
          {
            value: 'registro',
            label: 'Crear Cuenta',
            icon: 'account-plus-outline',
          },
        ]}
      />

      <AuthErrorBanner
        error={error}
        accionTexto={sugerirRegistro ? 'Ir a la pestaña «Crear Cuenta»' : undefined}
        onAccion={sugerirRegistro ? () => cambiarTab('registro') : undefined}
      />

      <AuthConfirmacionBanner
        mensaje={mensajeConfirmacion}
        onIrALogin={() => cambiarTab('login')}
      />

      <View style={[styles.formCard, getTerracottaShadow({ border: 'structural' })]}>
        {tab === 'registro' ? (
          <View style={styles.campoWrap}>
            <TextInput
              mode="outlined"
              label="Nombre completo *"
              placeholder="Ej. Carlos Alberto Méndez Ruiz"
              value={nombreCompleto}
              onChangeText={(v) => {
                setNombreCompleto(v);
                if (error) limpiarMensajes();
              }}
              autoCapitalize="words"
              error={!!errNombre}
              disabled={cargando}
              left={<TextInput.Icon icon="account-outline" />}
              style={styles.input}
            />
            {errNombre ? (
              <HelperText type="error" visible padding="none">
                {errNombre}
              </HelperText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.campoWrap}>
          <TextInput
            mode="outlined"
            label="Correo electrónico *"
            placeholder="nombre@dominio.com"
            value={correo}
            onChangeText={(v) => {
              setCorreo(v);
              if (error) limpiarMensajes();
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!errCorreo}
            disabled={cargando}
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
          />
          {errCorreo ? (
            <HelperText type="error" visible padding="none">
              {errCorreo}
            </HelperText>
          ) : null}
        </View>

        {tab === 'registro' ? (
          <>
            <View style={styles.campoWrap}>
              <TextInput
                mode="outlined"
                label="Teléfono de contacto *"
                placeholder="Ej. 993 312 4567"
                value={telefono}
                onChangeText={(v) => {
                  setTelefono(v);
                  if (error) limpiarMensajes();
                }}
                keyboardType="phone-pad"
                error={!!errTelefono}
                disabled={cargando}
                left={<TextInput.Icon icon="phone-outline" />}
                style={styles.input}
              />
              {errTelefono ? (
                <HelperText type="error" visible padding="none">
                  {errTelefono}
                </HelperText>
              ) : null}
            </View>

            <View style={styles.campoWrap}>
              <TextInput
                mode="outlined"
                label="Institución / Procedencia *"
                placeholder="Ej. Colegio de Investigadores de Tabasco / Empresa"
                value={dependenciaProcedencia}
                onChangeText={(v) => {
                  setDependenciaProcedencia(v);
                  if (error) limpiarMensajes();
                }}
                error={!!errDependencia}
                disabled={cargando}
                left={<TextInput.Icon icon="domain" />}
                style={styles.input}
              />
              {errDependencia ? (
                <HelperText type="error" visible padding="none">
                  {errDependencia}
                </HelperText>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.campoWrap}>
          <TextInput
            mode="outlined"
            label="Contraseña *"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) limpiarMensajes();
            }}
            secureTextEntry={!mostrarPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={!!errPassword}
            disabled={cargando}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={mostrarPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setMostrarPassword((v) => !v)}
                forceTextInputFocus={false}
              />
            }
            onSubmitEditing={() => void enviar()}
            style={styles.input}
          />
          {errPassword ? (
            <HelperText type="error" visible padding="none">
              {errPassword}
            </HelperText>
          ) : null}
        </View>

        <Button
          mode="contained"
          icon={tab === 'registro' ? 'account-check-outline' : 'login'}
          onPress={() => void enviar()}
          loading={cargando}
          disabled={cargando}
          buttonColor={cictatColors.terracotta}
          textColor="#FFFFFF"
          style={[styles.cta, getTerracottaShadow({ border: 'structural', intensity: 1.25 })]}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {tab === 'registro' ? 'Crear Cuenta e Ingresar' : 'Iniciar Sesión'}
        </Button>
      </View>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm + 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  badgeTexto: { color: cictatColors.carbon, fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },
  formCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },
  campoWrap: { gap: 2 },
  input: { backgroundColor: cictatColors.surfaceElevated },
  cta: { borderRadius: radius.md, marginTop: spacing.xs },
  ctaContent: { paddingVertical: spacing.xs + 2 },
  ctaLabel: { fontWeight: '800', fontSize: 15 },
});
