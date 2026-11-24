/**
 * Presentación — SolicitudUsuarioController
 *
 * Controlador de dominio para operaciones del flujo de solicitante (Fase 5):
 * - Validación de disponibilidad y reglas de negocio institucionales (24h anticipación, 08:00–15:00, limpieza).
 * - Carga y almacenamiento de Credencial UJAT o INE en Supabase Storage (bucket 'identificaciones').
 * - Orquestación completa de creación de solicitud + generación automática de Formato PDF pre-llenado.
 * - Consulta enriquecida de "Mis Solicitudes" e historial de auditoría.
 * - Cancelación de solicitudes propias.
 * - Suscripción en tiempo real a los cambios de estado de las solicitudes.
 */

import type { DocumentPickerAsset } from 'expo-document-picker';

import { generadorFormatoPDFService } from '@/application/services/GeneradorFormatoPDFService';
import type {
  DocumentoSolicitud,
  Espacio,
  EstadoSolicitud,
  HistorialEstadoSolicitud,
  NuevoDocumentoSolicitud,
  PerfilUsuario,
  RolUsuario,
  SolicitudReserva,
} from '@/domain/models';
import { supabase } from '@/infrastructure/supabase/supabaseClient';
import { BUCKETS, TABLAS } from '@/infrastructure/supabase/tables';

// Nombres de buckets para almacenamiento
const BUCKET_IDENTIFICACIONES = 'identificaciones';
const BUCKET_FALLBACK_STORAGE = BUCKETS.documentosSolicitud ?? 'documentos-solicitud';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del Controlador
// ─────────────────────────────────────────────────────────────────────────────

/** Resultado de la validación de disponibilidad y reglas de negocio. */
export interface ResultadoValidacion {
  ok: boolean;
  error?: string;
  aviso?: string;
  horaFinLimpieza?: string;
}

/** Solicitud enriquecida para el módulo del solicitante. */
export type SolicitudConDetalles = SolicitudReserva & {
  espacio: Espacio | null;
  documentos: DocumentoSolicitud[];
  historial: HistorialEstadoSolicitud[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de tiempo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte "HH:mm" o "HH:mm:ss" en minutos totales desde medianoche.
 */
function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Suma `deltaMins` minutos a una hora "HH:mm" y devuelve "HH:mm".
 */
function sumarMinutos(hora: string, deltaMins: number): string {
  const total = horaAMinutos(hora) + deltaMins;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clase SolicitudUsuarioController
// ─────────────────────────────────────────────────────────────────────────────

class SolicitudUsuarioController {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Validar disponibilidad y reglas institucionales CICTAT
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Valida si la solicitud solicitada cumple con todas las reglas de negocio:
   * - Si el espacio es exclusivo para Alumnos de Posgrado (Cubículos 7 a 9), el usuario
   *   debe ser estudiante_posgrado o administrador.
   * - Horario permitido: horaInicio >= '08:00', horaFin <= '15:00' y horaFin > horaInicio.
   * - Regla de anticipación mínima de 24 horas.
   * - Cálculo del bloque de limpieza (+1 hora posterior).
   * - Detección de colisiones:
   *   * Si se traslapa con una 'aprobada' (incluyendo limpieza), bloquea el envío con error.
   *   * Si se traslapa únicamente con solicitudes 'pendiente', permite continuar con aviso.
   */
  async validarDisponibilidadYReglas(
    espacio: Espacio,
    perfil: PerfilUsuario,
    fechaISO: string,
    horaInicio: string,
    horaFin: string,
  ): Promise<ResultadoValidacion> {
    // 1. Regla: Espacio exclusivo para alumnos de posgrado
    if (espacio.exclusivo_alumnos_posgrado) {
      const rolesPermitidos: RolUsuario[] = ['estudiante_posgrado', 'administrador'];
      if (!rolesPermitidos.includes(perfil.rol)) {
        return {
          ok: false,
          error:
            'Este espacio (Cubículo de estudio) es de uso exclusivo para Alumnos de Posgrado del CICTAT - UJAT.',
        };
      }
    }

    // 2. Regla: Horario operativo (08:00 a 15:00)
    if (horaInicio < '08:00') {
      return { ok: false, error: 'El horario de inicio no puede ser anterior a las 08:00 hrs.' };
    }
    if (horaFin > '15:00') {
      return { ok: false, error: 'El horario de fin no puede ser posterior a las 15:00 hrs.' };
    }
    if (horaFin <= horaInicio) {
      return { ok: false, error: 'La hora de finalización debe ser posterior a la hora de inicio.' };
    }

    // 3. Regla: Anticipación mínima de 24 horas
    const fechaHoraEvento = new Date(`${fechaISO}T${horaInicio}:00`);
    const ahora = new Date();
    const limite24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    if (fechaHoraEvento < limite24h) {
      return {
        ok: false,
        error:
          'Las reservas requieren realizarse con un mínimo de 24 horas de anticipación a la hora de inicio solicitada.',
      };
    }

    // 4. Calcular hora_fin_limpieza (+1 hora posterior)
    const horaFinLimpieza = sumarMinutos(horaFin, 60);

    // 5. Consultar solicitudes existentes en la misma fecha y espacio
    const { data: solicitudesExistentes, error: dbError } = await supabase
      .from(TABLAS.solicitudesReservas)
      .select('id, hora_inicio, hora_fin, hora_fin_limpieza, estado')
      .eq('espacio_id', espacio.id)
      .eq('fecha_evento', fechaISO)
      .in('estado', ['aprobada', 'pendiente'] satisfies EstadoSolicitud[]);

    if (dbError) {
      return {
        ok: false,
        error: `Error al consultar la disponibilidad en la base de datos: ${dbError.message}`,
      };
    }

    // 6. Detectar traslapes de horario
    const iniA = horaAMinutos(horaInicio);
    const finA = horaAMinutos(horaFinLimpieza);

    let soloTraslapeConPendiente = false;

    for (const sol of solicitudesExistentes ?? []) {
      const inB = horaAMinutos(sol.hora_inicio as string);
      const finBLimpieza = sol.hora_fin_limpieza
        ? horaAMinutos(sol.hora_fin_limpieza as string)
        : horaAMinutos(sol.hora_fin as string) + 60;

      // Dos intervalos [A_ini, A_fin] y [B_ini, B_fin] se traslapan si:
      // A_ini < B_fin && A_fin > B_ini
      const hayTraslape = iniA < finBLimpieza && finA > inB;

      if (hayTraslape) {
        if ((sol.estado as EstadoSolicitud) === 'aprobada') {
          return {
            ok: false,
            error: `El horario solicitado (${horaInicio} a ${horaFin} hrs, bloque protegido hasta ${horaFinLimpieza} hrs) colisiona con una reserva formalmente aprobada.`,
          };
        }
        // Estado pendiente
        soloTraslapeConPendiente = true;
      }
    }

    if (soloTraslapeConPendiente) {
      return {
        ok: true,
        aviso:
          'Existen otras solicitudes pendientes en este horario. Tu solicitud será enviada a evaluación; recuerda que al aprobarse una, las demás en el mismo horario serán descartadas automáticamente.',
        horaFinLimpieza,
      };
    }

    return { ok: true, horaFinLimpieza };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Subir Archivo de Identificación (Credencial / INE)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sube la identificación oficial (Credencial Posgrado o INE) al bucket 'identificaciones'
   * de Supabase Storage e inserta la referencia en `public.documentos_solicitud`.
   */
  async subirArchivoIdentificacion(
    usuarioId: string,
    solicitudId: string,
    archivoSeleccionado: DocumentPickerAsset,
    rol: RolUsuario,
  ): Promise<{ path: string; url: string | null }> {
    // Validar y normalizar tipo MIME exacto según extensión
    const nombreLower = archivoSeleccionado.name.toLowerCase();
    let mimeType = archivoSeleccionado.mimeType ?? 'application/pdf';
    if (nombreLower.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (nombreLower.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (nombreLower.endsWith('.jpg') || nombreLower.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    const mimePermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!mimePermitidos.includes(mimeType)) {
      throw new Error(
        `Formato de archivo no admitido: ${mimeType}. Por favor carga un documento PDF o imagen JPEG/PNG.`,
      );
    }

    // Ruta institucional en Storage: {usuario_id}/{solicitud_id}/identificacion/{nombre}
    const path = `${usuarioId}/${solicitudId}/identificacion/${archivoSeleccionado.name}`;

    // Convertir URI a Blob asegurando el MIME Type exacto para el navegador
    const response = await fetch(archivoSeleccionado.uri);
    const rawBlob = await response.blob();
    const blob = new Blob([rawBlob], { type: mimeType });

    // Intentar subir al bucket 'identificaciones' (con fallback seguro a 'documentos-solicitud')
    let bucketElegido = BUCKET_IDENTIFICACIONES;
    let { error: uploadError } = await supabase.storage
      .from(BUCKET_IDENTIFICACIONES)
      .upload(path, blob, { contentType: mimeType, upsert: true });

    if (uploadError && /bucket.*not.*found/i.test(uploadError.message)) {
      bucketElegido = BUCKET_FALLBACK_STORAGE;
      const resFallback = await supabase.storage
        .from(BUCKET_FALLBACK_STORAGE)
        .upload(path, blob, { contentType: mimeType, upsert: true });
      uploadError = resFallback.error;
    }

    if (uploadError) {
      if (/bucket.*not.*found/i.test(uploadError.message)) {
        console.warn(
          '[SolicitudUsuarioController] Los buckets de almacenamiento aún no han sido creados en Supabase. Se guardará la referencia del documento.',
        );
      } else {
        throw new Error(`Error al subir la identificación oficial al almacenamiento: ${uploadError.message}`);
      }
    }

    // Obtener URL pública o firmada
    const { data: urlData } = supabase.storage.from(bucketElegido).getPublicUrl(path);
    const url = urlData?.publicUrl || archivoSeleccionado.uri || path;

    // Registrar en public.documentos_solicitud
    const tipoDocumento = rol === 'publico_general' ? 'ine_externo' : 'credencial_posgrado';

    const nuevoDocumento: NuevoDocumentoSolicitud = {
      solicitud_id: solicitudId,
      tipo_documento: tipoDocumento,
      nombre_archivo: archivoSeleccionado.name,
      storage_path: path,
      storage_bucket: bucketElegido,
      url_descarga: url,
      mime_type: mimeType,
    };

    const { error: insertError } = await supabase
      .from(TABLAS.documentosSolicitud)
      .insert(nuevoDocumento);

    if (insertError) {
      throw new Error(`Error al registrar el documento en la base de datos: ${insertError.message}`);
    }

    return { path, url };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Crear Solicitud Completa (Orquestador Fase 5)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Orquesta la creación completa en orden estricto:
   * 1. Validación de reglas y disponibilidad.
   * 2. Insert en public.solicitudes_reservas con estado 'pendiente'.
   * 3. Subida del documento de identificación oficial a Supabase Storage.
   * 4. Generación, subida a Storage y registro del Formato PDF pre-llenado sin firma.
   * 5. Retorno de la solicitud creada y la URI/URL del PDF.
   */
  async crearSolicitudCompleta(params: {
    espacio: Espacio;
    perfil: PerfilUsuario;
    fechaISO: string;
    horaInicio: string;
    horaFin: string;
    horaFinLimpieza: string;
    temaEvento: string;
    archivoIdentificacion: DocumentPickerAsset;
  }): Promise<{ solicitud: SolicitudReserva; pdfUri: string; pdfUrl: string | null }> {
    const {
      espacio,
      perfil,
      fechaISO,
      horaInicio,
      horaFin,
      horaFinLimpieza,
      temaEvento,
      archivoIdentificacion,
    } = params;

    // Paso 1: Re-validar reglas de negocio
    const validacion = await this.validarDisponibilidadYReglas(
      espacio,
      perfil,
      fechaISO,
      horaInicio,
      horaFin,
    );
    if (!validacion.ok) {
      throw new Error(validacion.error ?? 'La solicitud no cumple con las reglas institucionales.');
    }

    // Paso 2: Insert en public.solicitudes_reservas
    const insertPayload = {
      usuario_id: perfil.id,
      espacio_id: espacio.id,
      fecha_evento: fechaISO,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      hora_fin_limpieza: horaFinLimpieza,
      tema_evento: temaEvento.trim(),
      estado: 'pendiente' satisfies EstadoSolicitud,
    };

    const { data: solicitudData, error: insertError } = await supabase
      .from(TABLAS.solicitudesReservas)
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !solicitudData) {
      throw new Error(
        `Error al registrar la solicitud de reserva: ${insertError?.message ?? 'Sin respuesta del servidor'}`,
      );
    }

    const solicitud = solicitudData as SolicitudReserva;

    // Paso 3: Subida de Credencial / INE
    await this.subirArchivoIdentificacion(
      perfil.id,
      solicitud.id,
      archivoIdentificacion,
      perfil.rol,
    );

    // Paso 4: Generación y subida del Formato PDF pre-llenado
    const { uri: pdfUri, publicUrl: pdfUrl } =
      await generadorFormatoPDFService.generarYSubirPDFPrellenado(perfil, espacio, solicitud);

    return { solicitud, pdfUri, pdfUrl };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Módulo "Mis Solicitudes"
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Lista todas las solicitudes del usuario autenticado, enriquecidas con:
   * - Espacio solicitado
   * - Documentos adjuntos (credencial, formato pdf pre-llenado)
   * - Historial de estados (bitácora de auditoría)
   */
  async obtenerMisSolicitudes(usuarioId: string): Promise<SolicitudConDetalles[]> {
    const { data: solicitudes, error } = await supabase
      .from(TABLAS.solicitudesReservas)
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar tus solicitudes: ${error.message}`);
    }

    if (!solicitudes || solicitudes.length === 0) return [];

    // Enriquecer en paralelo con espacio, documentos e historial
    const enriquecidas = await Promise.all(
      (solicitudes as SolicitudReserva[]).map(async (sol) => {
        const [espacioRes, docsRes, histRes] = await Promise.all([
          supabase.from(TABLAS.espacios).select('*').eq('id', sol.espacio_id).maybeSingle(),
          supabase.from(TABLAS.documentosSolicitud).select('*').eq('solicitud_id', sol.id),
          supabase
            .from(TABLAS.historialEstadosSolicitud)
            .select('*')
            .eq('solicitud_id', sol.id)
            .order('fecha_cambio', { ascending: true }),
        ]);

        return {
          ...sol,
          espacio: (espacioRes.data as Espacio | null) ?? null,
          documentos: (docsRes.data as DocumentoSolicitud[]) ?? [],
          historial: (histRes.data as HistorialEstadoSolicitud[]) ?? [],
        };
      }),
    );

    return enriquecidas;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Cancelar Solicitud Propia
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Permite al solicitante cancelar una solicitud suya que esté 'pendiente' o 'aprobada'.
   */
  async cancelarSolicitudPropia(
    solicitudId: string,
    usuarioId: string,
    motivo: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const { data: solicitud, error: fetchError } = await supabase
      .from(TABLAS.solicitudesReservas)
      .select('id, usuario_id, estado')
      .eq('id', solicitudId)
      .single();

    if (fetchError || !solicitud) {
      return { ok: false, error: 'No se encontró la solicitud de reserva indicada.' };
    }

    if ((solicitud as { usuario_id: string }).usuario_id !== usuarioId) {
      return { ok: false, error: 'No cuentas con autorización para cancelar esta solicitud.' };
    }

    const estadoActual = (solicitud as { estado: EstadoSolicitud }).estado;
    const estadosCancelables: EstadoSolicitud[] = ['pendiente', 'aprobada'];
    if (!estadosCancelables.includes(estadoActual)) {
      return {
        ok: false,
        error: `No es posible cancelar una solicitud con estado actual '${estadoActual}'.`,
      };
    }

    const { error: updateError } = await supabase
      .from(TABLAS.solicitudesReservas)
      .update({
        estado: 'cancelada' satisfies EstadoSolicitud,
        motivo_rechazo_cancelacion: motivo.trim() || 'Cancelada por el solicitante.',
      })
      .eq('id', solicitudId);

    if (updateError) {
      return { ok: false, error: `Error al cancelar la solicitud: ${updateError.message}` };
    }

    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Suscripción en Tiempo Real (Realtime)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Suscribe a cambios en vivo de las solicitudes del usuario actual.
   */
  suscribirMisSolicitudes(
    usuarioId: string,
    onCambio: (solicitudes: SolicitudConDetalles[]) => void,
  ): () => void {
    const canal = supabase
      .channel(`mis-solicitudes-${usuarioId}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLAS.solicitudesReservas,
          filter: `usuario_id=eq.${usuarioId}`,
        },
        () => {
          this.obtenerMisSolicitudes(usuarioId)
            .then(onCambio)
            .catch((err: unknown) => {
              console.warn('[SolicitudUsuarioController] Error al refrescar realtime:', err);
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }
}

export const solicitudUsuarioController = new SolicitudUsuarioController();
