/**
 * A-04: Login Administrativo CICTAT (/auth/admin).
 *
 * Formulario exclusivo para el Encargado / Administrador del CICTAT. Incluye
 * el conmutador "Activar cuenta de Administrador inicial" (Modo Setup) para
 * registrar al encargado inicial en `perfiles_usuarios` con `rol = 'administrador'`.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, HelperText, Switch, Text, TextInput } from 'react-native-paper';

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

export default function AdminAuthScreen() {
  const rawParams = useLocalSearchParams<{
    espacioId?: string;
    returnTo?: string;
    fecha?: string;
  }>();

  const espacioId = normalizarParametro(rawParams.espacioId);
  const fecha = normalizarParametro(rawParams.fecha);
  const returnTo = normalizarParametro(rawParams.returnTo) ?? (espacioId ? undefined : '/admin');

  const {
    cargando,
    error,
    mensajeConfirmacion,
    errorCampo,
    limpiarMensajes,
    autenticarAdmin,
  } = useAuthController({ returnTo, espacioId, fecha });

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [crearCuentaInicial, setCrearCuentaInicial] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const alternarSetup = (valor?: boolean) => {
    setCrearCuentaInicial((prev) => (typeof valor === 'boolean' ? valor : !prev));
    limpiarMensajes();
  };

  const enviar = async () => {
    const res = await autenticarAdmin({
      correo,
      password,
      crearCuentaInicial,
      nombreCompleto: crearCuentaInicial ? nombreCompleto : undefined,
    });
    if (!res.ok && res.error.codigo === 'perfil_incompleto') {
      setCrearCuentaInicial(true);
    }
  };

  const errCorreo = errorCampo('correo');
  const errPassword = errorCampo('password');
  const errNombre = errorCampo('nombreCompleto');

  return (
    <AuthScreenContainer etiquetaVolver="Perfiles">
      <View style={styles.header}>
        <View style={styles.badgeAdmin}>
          <MaterialCommunityIcons name="shield-account" size={16} color={cictatColors.ochre} />
          <Text variant="labelMedium" style={styles.badgeAdminTexto}>
            Encargado / Administrador CICTAT
          </Text>
        </View>

        <BrushTitle text="Gestión Administrativa" highlight="Administrativa" size="lg" />
        <Text variant="bodyMedium" style={styles.subtitulo}>
          Acceso exclusivo para el encargado del CICTAT (aprobación de reservas, gestión de salas,
          cubículos y bitácora operativa).
        </Text>
      </View>

      <AuthErrorBanner
        error={error}
        accionTexto={
          !crearCuentaInicial &&
          error &&
          (error.codigo === 'credenciales_invalidas' || error.codigo === 'perfil_incompleto')
            ? 'Activar «Modo Setup» para cuenta inicial'
            : undefined
        }
        onAccion={() => alternarSetup(true)}
      />

      <AuthConfirmacionBanner
        mensaje={mensajeConfirmacion}
        onIrALogin={() => alternarSetup(false)}
      />

      <View style={[styles.formCard, getTerracottaShadow({ border: 'structural' })]}>
        {/* Switch: Activar cuenta de Administrador inicial (Modo Setup) */}
        <Pressable
          onPress={() => alternarSetup()}
          accessibilityRole="switch"
          accessibilityState={{ checked: crearCuentaInicial }}
          style={[styles.setupBox, crearCuentaInicial && styles.setupBoxActivo]}
        >
          <View style={styles.setupTextos}>
            <Text variant="labelLarge" style={styles.setupTitulo}>
              Activar cuenta de Administrador inicial
            </Text>
            <Text variant="bodySmall" style={styles.setupDescripcion}>
              Registrar cuenta de Encargado (Modo Setup) en perfiles_usuarios.
            </Text>
          </View>
          <Switch
            value={crearCuentaInicial}
            onValueChange={alternarSetup}
            color={cictatColors.terracotta}
          />
        </Pressable>

        {crearCuentaInicial ? (
          <View style={styles.campoWrap}>
            <TextInput
              mode="outlined"
              label="Nombre completo del Encargado *"
              placeholder="Ej. Dr. Roberto Hernández Aguilar"
              value={nombreCompleto}
              onChangeText={(v) => {
                setNombreCompleto(v);
                if (error) limpiarMensajes();
              }}
              autoCapitalize="words"
              error={!!errNombre}
              disabled={cargando}
              left={<TextInput.Icon icon="account-tie-outline" />}
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
            label="Correo institucional del Encargado *"
            placeholder="encargado.cictat@ujat.mx"
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
            left={<TextInput.Icon icon="email-lock-outline" />}
            style={styles.input}
          />
          {errCorreo ? (
            <HelperText type="error" visible padding="none">
              {errCorreo}
            </HelperText>
          ) : null}
        </View>

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
          icon={crearCuentaInicial ? 'shield-plus' : 'shield-key'}
          onPress={() => void enviar()}
          loading={cargando}
          disabled={cargando}
          buttonColor={cictatColors.terracotta}
          textColor="#FFFFFF"
          style={[styles.cta, getTerracottaShadow({ border: 'structural', intensity: 1.25 })]}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {crearCuentaInicial
            ? 'Registrar Encargado e Ingresar'
            : 'Ingresar como Administrador'}
        </Button>
      </View>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm + 2 },
  badgeAdmin: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: cictatColors.carbon,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  badgeAdminTexto: { color: '#FFFFFF', fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },
  formCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },
  setupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.borderSoft,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  setupBoxActivo: {
    backgroundColor: cictatColors.ochreSoft,
    borderColor: cictatColors.carbon,
  },
  setupTextos: { flex: 1, gap: 2 },
  setupTitulo: { color: cictatColors.carbon, fontWeight: '800' },
  setupDescripcion: { color: cictatColors.textSecondary },
  campoWrap: { gap: 2 },
  input: { backgroundColor: cictatColors.surfaceElevated },
  cta: { borderRadius: radius.md, marginTop: spacing.xs },
  ctaContent: { paddingVertical: spacing.xs + 2 },
  ctaLabel: { fontWeight: '800', fontSize: 15 },
});
