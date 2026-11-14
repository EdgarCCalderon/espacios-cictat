/**
 * A-02: Login Institucional Comunidad UJAT (/auth/ujat).
 *
 * Soporta `rol = 'estudiante_posgrado'` (@alumno.ujat.mx) y
 * `rol = 'doctor_posgrado'` (@ujat.mx), con modo "Ya tengo cuenta activa"
 * y "Primer ingreso con mi Matrícula".
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import {
  DOMINIO_ALUMNOS,
  DOMINIO_DOCTORES,
  derivarCorreoInstitucional,
  esRolComunidadUJAT,
  resolverCorreoInstitucional,
  type RolComunidadUJAT,
} from '@/domain/usecases/autenticacion';
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

type ModoUJAT = 'login' | 'primer_ingreso';

export default function UjatAuthScreen() {
  const rawParams = useLocalSearchParams<{
    rol?: string;
    espacioId?: string;
    returnTo?: string;
    fecha?: string;
  }>();

  const rolParam = normalizarParametro(rawParams.rol);
  const rol: RolComunidadUJAT = esRolComunidadUJAT(rolParam) ? rolParam : 'estudiante_posgrado';
  const esEstudiante = rol === 'estudiante_posgrado';
  const dominio = esEstudiante ? DOMINIO_ALUMNOS : DOMINIO_DOCTORES;

  const returnTo = normalizarParametro(rawParams.returnTo);
  const espacioId = normalizarParametro(rawParams.espacioId);
  const fecha = normalizarParametro(rawParams.fecha);

  const {
    cargando,
    error,
    mensajeConfirmacion,
    errorCampo,
    limpiarMensajes,
    autenticarComunidadUJAT,
  } = useAuthController({ returnTo, espacioId, fecha });

  const [modo, setModo] = useState<ModoUJAT>('login');
  const [matricula, setMatricula] = useState('');
  const [correoPersonalizado, setCorreoPersonalizado] = useState<string | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const correoMostrado = useMemo(() => {
    if (correoPersonalizado !== null) return correoPersonalizado;
    return derivarCorreoInstitucional(matricula, rol);
  }, [correoPersonalizado, matricula, rol]);

  const cambiarModo = (nuevoModo: ModoUJAT) => {
    setModo(nuevoModo);
    limpiarMensajes();
  };

  const onChangeMatricula = (valor: string) => {
    setMatricula(valor.toUpperCase());
    if (error) limpiarMensajes();
  };

  const onChangeCorreo = (valor: string) => {
    const limpio = valor.trim();
    if (!limpio) {
      setCorreoPersonalizado(null);
    } else {
      setCorreoPersonalizado(valor);
    }
    if (error) limpiarMensajes();
  };

  const enviar = async () => {
    const correoFinal = resolverCorreoInstitucional(correoMostrado, matricula, rol);
    const res = await autenticarComunidadUJAT({
      rol,
      matricula,
      correoInstitucional: correoFinal,
      password,
      nombreCompleto: modo === 'primer_ingreso' ? nombreCompleto : undefined,
      primerIngreso: modo === 'primer_ingreso',
    });

    if (!res.ok && res.error.codigo === 'perfil_incompleto') {
      setModo('primer_ingreso');
    }
  };

  const errMatricula = errorCampo('matricula');
  const errCorreo = errorCampo('correo');
  const errNombre = errorCampo('nombreCompleto');
  const errPassword = errorCampo('password');

  const sugerirPrimerIngreso =
    modo === 'login' &&
    error &&
    (error.codigo === 'credenciales_invalidas' || error.codigo === 'perfil_incompleto');

  return (
    <AuthScreenContainer etiquetaVolver="Perfiles">
      {/* Encabezado adaptable según rol */}
      <View style={styles.header}>
        <View style={[styles.rolBadge, esEstudiante ? styles.rolBadgeOchre : styles.rolBadgeTerra]}>
          <MaterialCommunityIcons
            name={esEstudiante ? 'school' : 'account-tie'}
            size={16}
            color={esEstudiante ? cictatColors.carbon : '#FFFFFF'}
          />
          <Text
            variant="labelMedium"
            style={esEstudiante ? styles.rolBadgeTextoCarbon : styles.rolBadgeTextoBlanco}
          >
            {esEstudiante
              ? `Estudiante de Posgrado · @${dominio}`
              : `Doctor de Posgrado · @${dominio}`}
          </Text>
        </View>

        <BrushTitle
          text={esEstudiante ? 'Acceso Posgrado UJAT' : 'Acceso Docente UJAT'}
          highlight="UJAT"
          size="lg"
        />

        <Text variant="bodyMedium" style={styles.subtitulo}>
          {esEstudiante
            ? 'Ingresa con tu matrícula institucional para reservar las Salas 1 a 6 y desbloquear los Cubículos de Estudio 7, 8 y 9.'
            : 'Ingresa con tu clave o matrícula institucional para solicitar reservas en las Salas de Posgrado 1 a 6.'}
        </Text>
      </View>

      {/* Selector superior: Ya tengo cuenta activa vs Primer ingreso con mi Matrícula */}
      <View style={styles.tabsWrap} accessibilityRole="tablist">
        <Pressable
          onPress={() => cambiarModo('login')}
          accessibilityRole="tab"
          accessibilityState={{ selected: modo === 'login' }}
          style={[styles.tab, modo === 'login' && styles.tabActiva]}
        >
          <MaterialCommunityIcons
            name="login"
            size={17}
            color={modo === 'login' ? '#FFFFFF' : cictatColors.carbon}
          />
          <Text
            variant="labelMedium"
            style={[styles.tabTexto, modo === 'login' && styles.tabTextoActivo]}
          >
            Ya tengo cuenta activa
          </Text>
        </Pressable>

        <Pressable
          onPress={() => cambiarModo('primer_ingreso')}
          accessibilityRole="tab"
          accessibilityState={{ selected: modo === 'primer_ingreso' }}
          style={[styles.tab, modo === 'primer_ingreso' && styles.tabActiva]}
        >
          <MaterialCommunityIcons
            name="account-plus-outline"
            size={17}
            color={modo === 'primer_ingreso' ? '#FFFFFF' : cictatColors.carbon}
          />
          <Text
            variant="labelMedium"
            style={[styles.tabTexto, modo === 'primer_ingreso' && styles.tabTextoActivo]}
          >
            Primer ingreso con mi Matrícula
          </Text>
        </Pressable>
      </View>

      <AuthErrorBanner
        error={error}
        accionTexto={
          sugerirPrimerIngreso ? 'Cambiar a «Primer ingreso con mi Matrícula»' : undefined
        }
        onAccion={sugerirPrimerIngreso ? () => cambiarModo('primer_ingreso') : undefined}
      />

      <AuthConfirmacionBanner
        mensaje={mensajeConfirmacion}
        onIrALogin={() => cambiarModo('login')}
      />

      {/* Tarjeta de formulario */}
      <View style={[styles.formCard, getTerracottaShadow({ border: 'structural' })]}>
        {modo === 'primer_ingreso' ? (
          <View style={styles.avisoModo}>
            <MaterialCommunityIcons
              name="star-four-points-outline"
              size={18}
              color={cictatColors.carbon}
            />
            <Text variant="bodySmall" style={styles.avisoModoTexto}>
              Activación institucional: escribe tu matrícula, tu nombre completo y define tu
              contraseña para crear tu perfil en DACyTI - CICTAT.
            </Text>
          </View>
        ) : null}

        {/* 1. Matrícula UJAT */}
        <View style={styles.campoWrap}>
          <TextInput
            mode="outlined"
            label={esEstudiante ? 'Matrícula UJAT *' : 'Matrícula / Clave UJAT *'}
            placeholder={esEstudiante ? 'Ej. 222H17001' : 'Ej. DOC10452'}
            value={matricula}
            onChangeText={onChangeMatricula}
            autoCapitalize="characters"
            autoCorrect={false}
            error={!!errMatricula}
            disabled={cargando}
            left={<TextInput.Icon icon="card-account-details-outline" />}
            style={styles.input}
          />
          {errMatricula ? (
            <HelperText type="error" visible padding="none">
              {errMatricula}
            </HelperText>
          ) : (
            <HelperText type="info" visible padding="none" style={styles.helperInfo}>
              Se autocompleta tu correo institucional @{dominio} al escribir tu matrícula.
            </HelperText>
          )}
        </View>

        {/* 2. Correo Institucional (autocompletado pero editable) */}
        <View style={styles.campoWrap}>
          <TextInput
            mode="outlined"
            label="Correo Institucional *"
            placeholder={`usuario@${dominio}`}
            value={correoMostrado}
            onChangeText={onChangeCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!errCorreo}
            disabled={cargando}
            left={<TextInput.Icon icon="email-outline" />}
            right={
              correoPersonalizado !== null ? (
                <TextInput.Icon
                  icon="refresh"
                  onPress={() => setCorreoPersonalizado(null)}
                  forceTextInputFocus={false}
                />
              ) : undefined
            }
            style={styles.input}
          />
          {errCorreo ? (
            <HelperText type="error" visible padding="none">
              {errCorreo}
            </HelperText>
          ) : null}
        </View>

        {/* 3. Nombre Completo (visible en Primer ingreso) */}
        {modo === 'primer_ingreso' ? (
          <View style={styles.campoWrap}>
            <TextInput
              mode="outlined"
              label="Nombre Completo *"
              placeholder="Ej. María Fernanda Gómez Pérez"
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

        {/* 4. Contraseña */}
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
          icon={modo === 'primer_ingreso' ? 'account-check' : 'login'}
          onPress={() => void enviar()}
          loading={cargando}
          disabled={cargando}
          buttonColor={cictatColors.terracotta}
          textColor="#FFFFFF"
          style={[styles.cta, getTerracottaShadow({ border: 'structural', intensity: 1.25 })]}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {modo === 'primer_ingreso'
            ? 'Activar Matrícula e Ingresar'
            : 'Iniciar Sesión Institucional'}
        </Button>
      </View>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm + 2 },
  rolBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: cictatColors.carbon,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
  },
  rolBadgeOchre: { backgroundColor: cictatColors.ochre },
  rolBadgeTerra: { backgroundColor: cictatColors.terracotta },
  rolBadgeTextoCarbon: { color: cictatColors.carbon, fontWeight: '800' },
  rolBadgeTextoBlanco: { color: '#FFFFFF', fontWeight: '800' },
  subtitulo: { color: cictatColors.textSecondary },

  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: cictatColors.surface,
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  tabActiva: {
    backgroundColor: cictatColors.carbon,
  },
  tabTexto: {
    color: cictatColors.carbon,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  tabTextoActivo: {
    color: '#FFFFFF',
  },

  formCard: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },
  avisoModo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: cictatColors.ochreSoft,
    borderColor: cictatColors.ochre,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoModoTexto: {
    flex: 1,
    color: cictatColors.carbon,
    fontWeight: '600',
  },
  campoWrap: { gap: 2 },
  input: { backgroundColor: cictatColors.surfaceElevated },
  helperInfo: { color: cictatColors.textSecondary },

  cta: { borderRadius: radius.md, marginTop: spacing.xs },
  ctaContent: { paddingVertical: spacing.xs + 2 },
  ctaLabel: { fontWeight: '800', fontSize: 15 },
});
