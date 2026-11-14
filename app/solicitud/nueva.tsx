/**
 * app/solicitud/nueva.tsx — Formulario de Solicitud de Reserva y Carga Documental (U-01)
 *
 * Flujo de Solicitante CICTAT (DACyTI - UJAT):
 * - Resumen del espacio con especificación de equipamiento (Salas 1-6 o Cubículos 7-9).
 * - Selección y validación en tiempo real de fecha y horario (08:00 a 15:00 hrs + 1h limpieza).
 * - Captura del tema/descripción del evento.
 * - Carga obligatoria de Credencial de Posgrado UJAT o INE (PDF/Imagen) con expo-document-picker.
 * - Generación automática del formato PDF pre-llenado sin firma y redirección a confirmación.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Espacio } from '@/domain/models';
import { ETIQUETA_ROL } from '@/domain/models';
import { formatearFechaLarga, sumarDias } from '@/domain/usecases/calendario';
import { repositorios } from '@/infrastructure/repositories';
import { BrushTitle } from '@/presentation/components/common/BrushTitle';
import { useAuth } from '@/presentation/context/AuthContext';
import {
  solicitudUsuarioController,
  type ResultadoValidacion,
} from '@/presentation/controllers/SolicitudUsuarioController';
import { normalizarParametro } from '@/presentation/controllers/useAuthController';
import {
  cictatColors,
  getTerracottaShadow,
  radius,
  spacing,
} from '@/presentation/theme/cictatTheme';

const HORAS_DISPONIBLES = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
];

export default function NuevaSolicitudScreen() {
  const router = useRouter();
  const { user, perfil, isLoading: authCargando } = useAuth();
  const rawParams = useLocalSearchParams<{
    espacioId?: string;
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
  }>();

  const paramEspacioId = normalizarParametro(rawParams.espacioId);
  const paramFecha = normalizarParametro(rawParams.fecha);
  const paramHoraInicio = normalizarParametro(rawParams.horaInicio);
  const paramHoraFin = normalizarParametro(rawParams.horaFin);

  // Espacio seleccionado
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [espacioId, setEspacioId] = useState<string>(paramEspacioId || '');
  const [cargandoEspacio, setCargandoEspacio] = useState(true);

  // Campos del formulario
  const hoyISO = useMemo(() => new Date().toISOString().split('T')[0], []);
  const mananaISO = useMemo(() => sumarDias(hoyISO, 1), [hoyISO]);

  const [fecha, setFecha] = useState<string>(paramFecha || mananaISO);
  const [horaInicio, setHoraInicio] = useState<string>(paramHoraInicio || '09:00');
  const [horaFin, setHoraFin] = useState<string>(paramHoraFin || '11:00');
  const [temaEvento, setTemaEvento] = useState<string>('');

  // Archivo de identificación
  const [archivo, setArchivo] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Estado de validación en tiempo real y envío
  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);
  const [validando, setValidando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);
  const [snackError, setSnackError] = useState<string | null>(null);

  // Cargar catálogo de espacios activos
  useEffect(() => {
    let cancelado = false;
    async function cargarEspacios() {
      setCargandoEspacio(true);
      try {
        const catalogo = await repositorios.espacios.listarCatalogo();
        if (cancelado) return;
        const activos = catalogo.filter((e) => e.esta_activo);
        setEspacios(activos);
        if (!espacioId && activos.length > 0) {
          setEspacioId(activos[0].id);
        }
      } catch (err) {
        console.warn('[NuevaSolicitud] Error cargando espacios:', err);
      } finally {
        if (!cancelado) setCargandoEspacio(false);
      }
    }
    void cargarEspacios();
    return () => {
      cancelado = true;
    };
  }, []);

  const espacioSeleccionado = useMemo(() => {
    return espacios.find((e) => e.id === espacioId) ?? null;
  }, [espacios, espacioId]);

  // Validar reglas y disponibilidad en tiempo real ante cambios
  useEffect(() => {
    if (!espacioSeleccionado || !perfil || !fecha || !horaInicio || !horaFin) {
      setValidacion(null);
      return;
    }

    let cancelado = false;
    setValidando(true);

    const timer = setTimeout(() => {
      solicitudUsuarioController
        .validarDisponibilidadYReglas(espacioSeleccionado, perfil, fecha, horaInicio, horaFin)
        .then((res) => {
          if (!cancelado) {
            setValidacion(res);
            setValidando(false);
          }
        })
        .catch((err: unknown) => {
          if (!cancelado) {
            setValidacion({
              ok: false,
              error: err instanceof Error ? err.message : 'Error al validar disponibilidad',
            });
            setValidando(false);
          }
        });
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [espacioSeleccionado, perfil, fecha, horaInicio, horaFin]);

  // Selección de documento oficial
  const seleccionarDocumento = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const elegido = res.assets[0];
        // Verificar tamaño máximo: 10MB
        if (elegido.size && elegido.size > 10 * 1024 * 1024) {
          setSnackError('El archivo excede el tamaño máximo permitido de 10 MB.');
          return;
        }
        setArchivo(elegido);
      }
    } catch (err) {
      console.warn('[NuevaSolicitud] Error seleccionando documento:', err);
      setSnackError('No se pudo acceder al selector de archivos.');
    }
  }, []);

  // Enviar Solicitud y Orquestar Flujo Fase 5
  const enviarSolicitud = useCallback(async () => {
    if (!perfil) {
      setSnackError('Debes contar con un perfil de usuario activo para solicitar.');
      return;
    }
    if (!espacioSeleccionado) {
      setSnackError('Selecciona un espacio válido.');
      return;
    }
    if (!temaEvento.trim()) {
      setSnackError('Por favor describe el tema o motivo del evento.');
      return;
    }
    if (!archivo) {
      setSnackError(
        perfil.rol === 'publico_general'
          ? 'Es obligatorio adjuntar tu Identificación Oficial (INE).'
          : 'Es obligatorio adjuntar tu Credencial de Posgrado UJAT.',
      );
      return;
    }
    if (validacion && !validacion.ok) {
      setSnackError(validacion.error ?? 'La solicitud no cumple con los requisitos.');
      return;
    }

    setEnviando(true);
    setMensajeEstado('Verificando disponibilidad...');

    try {
      setMensajeEstado('Registrando solicitud en base de datos...');
      const horaFinLimpieza =
        validacion?.horaFinLimpieza ||
        `${String(Number(horaFin.split(':')[0]) + 1).padStart(2, '0')}:${horaFin.split(':')[1]}`;

      setMensajeEstado('Subiendo credencial oficial a Supabase Storage...');
      const resultado = await solicitudUsuarioController.crearSolicitudCompleta({
        espacio: espacioSeleccionado,
        perfil,
        fechaISO: fecha,
        horaInicio,
        horaFin,
        horaFinLimpieza,
        temaEvento: temaEvento.trim(),
        archivoIdentificacion: archivo,
      });

      setMensajeEstado('¡Formato oficial PDF generado exitosamente!');

      // Redirigir a confirmación pasando el id de la solicitud y uri local/remoto
      router.replace({
        pathname: '/solicitud/confirmacion',
        params: {
          solicitudId: resultado.solicitud.id,
          pdfUri: resultado.pdfUri,
        },
      });
    } catch (err) {
      console.error('[NuevaSolicitud] Error al enviar:', err);
      setSnackError(err instanceof Error ? err.message : 'Error inesperado al enviar la solicitud.');
      setEnviando(false);
      setMensajeEstado(null);
    }
  }, [
    perfil,
    espacioSeleccionado,
    temaEvento,
    archivo,
    validacion,
    horaFin,
    fecha,
    horaInicio,
    router,
  ]);

  const volverAtras = () => {
    if (paramEspacioId) {
      router.replace({ pathname: '/espacio/[id]', params: { id: paramEspacioId } });
      return;
    }
    router.replace('/');
  };

  // Verificación de autenticación
  if (!authCargando && !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centroMuro}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="account-lock-outline" size={40} color={cictatColors.carbon} />
          </View>
          <BrushTitle text="Inicio de Sesión Requerido" highlight="Requerido" size="md" />
          <Text variant="bodyMedium" style={styles.textoCentro}>
            Para enviar una solicitud formal de reserva de espacio en el CICTAT, es necesario identificarte
            con tu cuenta universitaria UJAT o tu registro externo.
          </Text>
          <Button
            mode="contained"
            icon="login"
            onPress={() => router.push('/auth/selector')}
            buttonColor={cictatColors.terracotta}
            textColor="#FFFFFF"
            style={styles.botonAuth}
            labelStyle={styles.botonLabel}
          >
            Iniciar Sesión o Registrarme
          </Button>
          <Button mode="text" onPress={volverAtras} textColor={cictatColors.carbon}>
            Volver al Catálogo
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const esSala =
    espacioSeleccionado?.tipo_espacio === 'sala_posgrado' ||
    espacioSeleccionado?.codigo_espacio.toUpperCase().startsWith('SALA');

  const horaLimpiezaEstimada =
    validacion?.horaFinLimpieza ||
    `${String(Number(horaFin.split(':')[0]) + 1).padStart(2, '0')}:${horaFin.split(':')[1]}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barra superior de navegación */}
          <View style={styles.navBar}>
            <Pressable onPress={volverAtras} style={styles.botonVolver}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={cictatColors.carbon} />
              <Text variant="labelLarge" style={styles.botonVolverTexto}>
                Volver
              </Text>
            </Pressable>
            <View style={styles.badgeSolicitud}>
              <MaterialCommunityIcons name="calendar-plus" size={16} color={cictatColors.terracotta} />
              <Text variant="labelMedium" style={styles.badgeSolicitudTexto}>
                Formulario de Reserva U-01
              </Text>
            </View>
          </View>

          {/* Título Principal */}
          <View style={styles.header}>
            <BrushTitle text="Solicitud de Reserva" highlight="Reserva" size="lg" />
            <Text variant="bodyMedium" style={styles.subtitulo}>
              División Académica de Ciencias y Tecnologías de la Información — CICTAT
            </Text>
          </View>

          {/* 1. Tarjeta Resumen del Solicitante */}
          <View style={[styles.card, getTerracottaShadow({ border: 'soft' })]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-circle" size={22} color={cictatColors.ochre} />
              <Text variant="titleMedium" style={styles.cardTitulo}>
                Datos del Solicitante
              </Text>
            </View>
            <View style={styles.gridSolicitante}>
              <View style={styles.campoDato}>
                <Text variant="labelSmall" style={styles.campoEtiqueta}>NOMBRE COMPLETO</Text>
                <Text variant="bodyMedium" style={styles.campoValor}>
                  {perfil?.nombre_completo ?? user?.email ?? 'Usuario Autenticado'}
                </Text>
              </View>
              <View style={styles.campoDato}>
                <Text variant="labelSmall" style={styles.campoEtiqueta}>TIPO DE USUARIO</Text>
                <Text variant="bodyMedium" style={styles.campoValor}>
                  {perfil ? ETIQUETA_ROL[perfil.rol] : 'Solicitante'}
                  {perfil?.matricula ? ` · Matrícula: ${perfil.matricula}` : ''}
                </Text>
              </View>
              <View style={styles.campoDato}>
                <Text variant="labelSmall" style={styles.campoEtiqueta}>CORREO ELECTRÓNICO</Text>
                <Text variant="bodyMedium" style={styles.campoValor}>
                  {perfil?.correo ?? user?.email}
                </Text>
              </View>
            </View>
          </View>

          {/* 2. Tarjeta del Espacio y Equipamiento Incluido */}
          <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="office-building" size={22} color={cictatColors.terracotta} />
              <Text variant="titleMedium" style={styles.cardTitulo}>
                Espacio Seleccionado
              </Text>
            </View>

            {/* Selector si hay múltiples espacios */}
            {cargandoEspacio ? (
              <ActivityIndicator color={cictatColors.terracotta} style={{ padding: spacing.md }} />
            ) : (
              <View style={styles.selectorEspacios}>
                {espacios.map((e) => {
                  const sel = e.id === espacioId;
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => setEspacioId(e.id)}
                      style={[
                        styles.chipEspacio,
                        sel && styles.chipEspacioActivo,
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[styles.chipEspacioTexto, sel && styles.chipEspacioTextoActivo]}
                      >
                        {e.codigo_espacio} · {e.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {espacioSeleccionado ? (
              <View style={styles.detalleEspacioBox}>
                <View style={styles.filaEspacio}>
                  <Text variant="titleMedium" style={styles.espacioNombre}>
                    {espacioSeleccionado.nombre} ({espacioSeleccionado.codigo_espacio})
                  </Text>
                  <View style={styles.badgeCapacidad}>
                    <MaterialCommunityIcons name="account-group" size={14} color={cictatColors.carbon} />
                    <Text variant="labelSmall" style={styles.badgeCapacidadTexto}>
                      Capacidad: {espacioSeleccionado.capacidad} personas
                    </Text>
                  </View>
                </View>

                {/* Nota explícita de equipamiento según el tipo de espacio */}
                <View style={styles.equipamientoBox}>
                  <MaterialCommunityIcons
                    name={esSala ? 'projector' : 'laptop'}
                    size={20}
                    color={cictatColors.ochre}
                  />
                  <Text variant="bodySmall" style={styles.equipamientoTexto}>
                    {esSala
                      ? '⚡ Equipamiento Incluido: Incluye acceso y préstamo intrínseco de Proyector, Laptop y Extensión eléctrica para tu evento.'
                      : '🔒 Cubículo de estudio exclusivo para Posgrado (5 personas): Mesa colaborativa, contactos eléctricos y climatización.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 3. Selección de Fecha y Bloque Horario */}
          <View style={[styles.card, getTerracottaShadow({ border: 'soft' })]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clock-time-four" size={22} color={cictatColors.carbon} />
              <Text variant="titleMedium" style={styles.cardTitulo}>
                Fecha y Horario de la Reserva
              </Text>
            </View>

            {/* Fecha */}
            <View style={styles.bloqueForm}>
              <Text variant="labelMedium" style={styles.inputEtiqueta}>
                FECHA DEL EVENTO (YYYY-MM-DD)
              </Text>
              <TextInput
                mode="outlined"
                value={fecha}
                onChangeText={setFecha}
                placeholder="2026-11-20"
                style={styles.textInput}
                outlineColor={cictatColors.borderSoft}
                activeOutlineColor={cictatColors.terracotta}
                textColor={cictatColors.carbon}
                left={<TextInput.Icon icon="calendar" color={cictatColors.textSecondary} />}
              />
              <HelperText type="info" visible>
                Fecha seleccionada: {formatearFechaLarga(fecha)} · Mínimo 24 horas de anticipación.
              </HelperText>
            </View>

            {/* Horas Inicio y Fin */}
            <View style={styles.filaHorarios}>
              <View style={styles.colHorario}>
                <Text variant="labelSmall" style={styles.inputEtiqueta}>HORA DE INICIO</Text>
                <View style={styles.chipsWrap}>
                  {HORAS_DISPONIBLES.slice(0, -1).map((h) => (
                    <Pressable
                      key={`ini-${h}`}
                      onPress={() => setHoraInicio(h)}
                      style={[styles.horaChip, horaInicio === h && styles.horaChipActiva]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[styles.horaChipTexto, horaInicio === h && styles.horaChipTextoActiva]}
                      >
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.colHorario}>
                <Text variant="labelSmall" style={styles.inputEtiqueta}>HORA DE FIN</Text>
                <View style={styles.chipsWrap}>
                  {HORAS_DISPONIBLES.slice(1).map((h) => (
                    <Pressable
                      key={`fin-${h}`}
                      onPress={() => setHoraFin(h)}
                      style={[styles.horaChip, horaFin === h && styles.horaChipActiva]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[styles.horaChipTexto, horaFin === h && styles.horaChipTextoActiva]}
                      >
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Bloque Institucional de Limpieza (+1 hora posterior) */}
            <View style={styles.limpiezaAviso}>
              <MaterialCommunityIcons name="broom" size={20} color={cictatColors.terracotta} />
              <View style={styles.limpiezaTextos}>
                <Text variant="labelMedium" style={styles.limpiezaTitulo}>
                  Bloque Institucional de Limpieza (+1 hora posterior)
                </Text>
                <Text variant="bodySmall" style={styles.limpiezaDesc}>
                  Tu evento terminará a las <Text style={styles.bold}>{horaFin} hrs</Text>. El espacio
                  permanecerá ocupado y bloqueado para mantenimiento y limpieza hasta las{' '}
                  <Text style={styles.bold}>{horaLimpiezaEstimada} hrs</Text>.
                </Text>
              </View>
            </View>

            {/* Estado de validación en tiempo real */}
            {validando ? (
              <View style={styles.feedbackValidando}>
                <ActivityIndicator size="small" color={cictatColors.ochre} />
                <Text variant="bodySmall" style={styles.feedbackValidandoTexto}>
                  Comprobando disponibilidad institucional...
                </Text>
              </View>
            ) : validacion ? (
              !validacion.ok ? (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color={cictatColors.danger} />
                  <Text variant="bodySmall" style={styles.errorTexto}>
                    {validacion.error}
                  </Text>
                </View>
              ) : validacion.aviso ? (
                <View style={styles.avisoBox}>
                  <MaterialCommunityIcons name="alert" size={20} color={cictatColors.ochre} />
                  <Text variant="bodySmall" style={styles.avisoTexto}>
                    {validacion.aviso}
                  </Text>
                </View>
              ) : (
                <View style={styles.exitoBox}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={cictatColors.success} />
                  <Text variant="bodySmall" style={styles.exitoTexto}>
                    Horario disponible para solicitar.
                  </Text>
                </View>
              )
            ) : null}
          </View>

          {/* 4. Tema y Descripción del Evento */}
          <View style={[styles.card, getTerracottaShadow({ border: 'soft' })]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="text-box-edit" size={22} color={cictatColors.ochre} />
              <Text variant="titleMedium" style={styles.cardTitulo}>
                Tema y Descripción del Evento *
              </Text>
            </View>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              value={temaEvento}
              onChangeText={setTemaEvento}
              placeholder="Ej. Seminario de Investigación Doctoral: Avances en Inteligencia Artificial aplicada a la Salud..."
              style={styles.textInputArea}
              outlineColor={cictatColors.borderSoft}
              activeOutlineColor={cictatColors.terracotta}
              textColor={cictatColors.carbon}
            />
            <HelperText type="info" visible>
              Este texto se imprimirá textualmente en tu Formato Oficial CICTAT pre-llenado.
            </HelperText>
          </View>

          {/* 5. Carga de Identificación Oficial (Obligatorio) */}
          <View style={[styles.card, getTerracottaShadow({ border: 'structural' })]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="card-account-details" size={22} color={cictatColors.terracotta} />
              <Text variant="titleMedium" style={styles.cardTitulo}>
                {perfil?.rol === 'publico_general'
                  ? 'Identificación Oficial INE (Obligatorio)'
                  : 'Credencial de Posgrado UJAT (Obligatorio)'}
              </Text>
            </View>

            <Text variant="bodyMedium" style={styles.idSubtitulo}>
              {perfil?.rol === 'publico_general'
                ? 'Por disposición universitaria, el público externo debe adjuntar una copia legible de su INE en formato PDF o Imagen.'
                : 'Adjunta tu credencial vigente de Alumno o Doctor de Posgrado UJAT (PDF o Imagen JPG/PNG).'}
            </Text>

            {archivo ? (
              <View style={styles.archivoSeleccionadoBox}>
                <MaterialCommunityIcons
                  name={archivo.name.endsWith('.pdf') ? 'file-pdf-box' : 'file-image'}
                  size={36}
                  color={cictatColors.terracotta}
                />
                <View style={styles.archivoInfo}>
                  <Text variant="labelLarge" style={styles.archivoNombre} numberOfLines={1}>
                    {archivo.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.archivoTamano}>
                    {archivo.size ? `${(archivo.size / 1024).toFixed(1)} KB` : 'Archivo listo'}
                  </Text>
                </View>
                <Pressable onPress={seleccionarDocumento} style={styles.botonCambiarArchivo}>
                  <Text variant="labelSmall" style={styles.botonCambiarArchivoTexto}>
                    Cambiar
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Button
                mode="outlined"
                icon="upload"
                onPress={seleccionarDocumento}
                textColor={cictatColors.carbon}
                style={styles.botonSubirDoc}
                contentStyle={styles.botonSubirDocContent}
                labelStyle={styles.botonSubirDocLabel}
              >
                {perfil?.rol === 'publico_general'
                  ? 'Subir Identificación Oficial INE (PDF o Imagen)'
                  : 'Subir Credencial de Posgrado UJAT (PDF o Imagen)'}
              </Button>
            )}
          </View>

          {/* 6. Aviso Informativo de Generación Automática del PDF */}
          <View style={styles.tarjetaAvisoPdf}>
            <MaterialCommunityIcons name="file-document-check" size={28} color={cictatColors.ochre} />
            <View style={styles.tarjetaAvisoPdfTextos}>
              <Text variant="titleSmall" style={styles.tarjetaAvisoPdfTitulo}>
                Generación Automática del Formato PDF Pre-llenado
              </Text>
              <Text variant="bodySmall" style={styles.tarjetaAvisoPdfCuerpo}>
                Al presionar <Text style={styles.bold}>"Enviar Solicitud y Generar Formato PDF"</Text>, el
                sistema construirá automáticamente tu hoja oficial con tus datos, especificaciones del
                espacio, equipamiento y la cláusula formal de responsabilidad. Podrás descargarla o imprimirla
                para llevarla firmada en físico el día de tu evento.
              </Text>
            </View>
          </View>

          {/* Estado de envío */}
          {enviando && mensajeEstado ? (
            <View style={styles.cajaEstadoEnvio}>
              <ActivityIndicator size="small" color={cictatColors.terracotta} />
              <Text variant="bodyMedium" style={styles.cajaEstadoEnvioTexto}>
                {mensajeEstado}
              </Text>
            </View>
          ) : null}

          {/* Botón CTA Principal */}
          <Button
            mode="contained"
            icon="send"
            onPress={enviarSolicitud}
            loading={enviando}
            disabled={enviando || (validacion !== null && !validacion.ok)}
            buttonColor={cictatColors.terracotta}
            textColor="#FFFFFF"
            style={[styles.botonEnviar, getTerracottaShadow({ border: 'structural', intensity: 1.4 })]}
            contentStyle={styles.botonEnviarContent}
            labelStyle={styles.botonEnviarLabel}
          >
            Enviar Solicitud y Generar Formato PDF
          </Button>

          <Text variant="bodySmall" style={styles.pieTexto}>
            CICTAT · División Académica de Ciencias y Tecnologías de la Información · DACyTI - UJAT
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={!!snackError}
        onDismiss={() => setSnackError(null)}
        duration={4500}
        action={{
          label: 'Cerrar',
          onPress: () => setSnackError(null),
        }}
      >
        {snackError}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cictatColors.background },
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: spacing.xxxl,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonVolver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cictatColors.surface,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  botonVolverTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  badgeSolicitud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: cictatColors.terracottaSoft,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.terracotta,
  },
  badgeSolicitudTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
    fontSize: 12,
  },
  header: { gap: 2 },
  subtitulo: { color: cictatColors.textSecondary },

  card: {
    backgroundColor: cictatColors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },

  gridSolicitante: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  campoDato: { gap: 2 },
  campoEtiqueta: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  campoValor: {
    color: cictatColors.carbon,
    fontWeight: '600',
  },

  selectorEspacios: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  chipEspacio: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.surface,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  chipEspacioActivo: {
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
  },
  chipEspacioTexto: {
    color: cictatColors.carbon,
    fontWeight: '600',
  },
  chipEspacioTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  detalleEspacioBox: {
    backgroundColor: cictatColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  filaEspacio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  espacioNombre: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  badgeCapacidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cictatColors.ochreSoft,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: cictatColors.ochre,
  },
  badgeCapacidadTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },
  equipamientoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: cictatColors.surfaceElevated,
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  equipamientoTexto: {
    flex: 1,
    color: cictatColors.carbon,
    fontWeight: '600',
    lineHeight: 18,
  },

  bloqueForm: { gap: 4 },
  inputEtiqueta: {
    color: cictatColors.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: cictatColors.surfaceElevated,
  },
  textInputArea: {
    backgroundColor: cictatColors.surface,
  },

  filaHorarios: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  colHorario: {
    flex: 1,
    minWidth: 140,
    gap: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  horaChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: cictatColors.surface,
    borderWidth: 1,
    borderColor: cictatColors.borderSoft,
  },
  horaChipActiva: {
    backgroundColor: cictatColors.terracotta,
    borderColor: cictatColors.carbon,
  },
  horaChipTexto: {
    color: cictatColors.carbon,
    fontWeight: '600',
  },
  horaChipTextoActiva: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  limpiezaAviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: cictatColors.terracottaSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.terracotta,
  },
  limpiezaTextos: { flex: 1, gap: 2 },
  limpiezaTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  limpiezaDesc: {
    color: cictatColors.carbon,
    lineHeight: 18,
  },
  bold: { fontWeight: '800' },

  feedbackValidando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  feedbackValidandoTexto: { color: cictatColors.textSecondary, fontStyle: 'italic' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F9DEDC',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.danger,
  },
  errorTexto: { flex: 1, color: '#410E0B', fontWeight: '700' },
  avisoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.ochreSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.ochre,
  },
  avisoTexto: { flex: 1, color: '#4A3210', fontWeight: '600' },
  exitoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E8F5E9',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.success,
  },
  exitoTexto: { flex: 1, color: '#1B5E20', fontWeight: '700' },

  idSubtitulo: {
    color: cictatColors.textSecondary,
    lineHeight: 20,
  },
  botonSubirDoc: {
    borderColor: cictatColors.carbon,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: cictatColors.surface,
  },
  botonSubirDocContent: { paddingVertical: spacing.sm },
  botonSubirDocLabel: { fontWeight: '800' },

  archivoSeleccionadoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: cictatColors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.terracotta,
  },
  archivoInfo: { flex: 1 },
  archivoNombre: { color: cictatColors.carbon, fontWeight: '800' },
  archivoTamano: { color: cictatColors.textSecondary },
  botonCambiarArchivo: {
    backgroundColor: cictatColors.surfaceElevated,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: cictatColors.carbon,
  },
  botonCambiarArchivoTexto: { color: cictatColors.carbon, fontWeight: '700' },

  tarjetaAvisoPdf: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: cictatColors.ochreSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: cictatColors.ochre,
  },
  tarjetaAvisoPdfTextos: { flex: 1, gap: 3 },
  tarjetaAvisoPdfTitulo: {
    color: cictatColors.carbon,
    fontWeight: '800',
  },
  tarjetaAvisoPdfCuerpo: {
    color: '#4A3210',
    lineHeight: 18,
  },

  cajaEstadoEnvio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: cictatColors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cictatColors.terracotta,
  },
  cajaEstadoEnvioTexto: {
    color: cictatColors.carbon,
    fontWeight: '700',
  },

  botonEnviar: {
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  botonEnviarContent: { paddingVertical: spacing.sm + 2 },
  botonEnviarLabel: { fontWeight: '800', fontSize: 16 },

  pieTexto: {
    textAlign: 'center',
    color: cictatColors.textSecondary,
    fontSize: 12,
  },

  centroMuro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
    maxWidth: 500,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: cictatColors.ochre,
    borderWidth: 2,
    borderColor: cictatColors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCentro: {
    textAlign: 'center',
    color: cictatColors.textSecondary,
  },
  botonAuth: {
    borderRadius: radius.md,
    width: '100%',
    marginTop: spacing.sm,
  },
  botonLabel: { fontWeight: '800' },
});
