/**
 * Infraestructura — Implementaciones Supabase de los repositorios de dominio.
 *
 * Todas las consultas pasan por `lanzarSiError`, de modo que un fallo de red o
 * de permisos siempre llega a la UI con message/details/hint/code reales.
 */
import type { User } from '@supabase/supabase-js';

import { ErrorAuth } from '@/domain/errors/ErrorAuth';
import type {
  DocumentoSolicitud,
  Espacio,
  EstadoSolicitud,
  HistorialAuditoriaItem,
  ISODate,
  NuevoDocumentoSolicitud,
  NuevoPerfilUsuario,
  PerfilUsuario,
  SolicitudReserva,
  SolicitudReservaCalendario,
  UUID,
} from '@/domain/models';
import type {
  CambioEnVivo,
  EntradaCrearSolicitudDemo,
  IAutenticacionGateway,
  ICambiosEnVivoGateway,
  IDocumentoSolicitudRepository,
  IEspacioRepository,
  IHistorialSolicitudRepository,
  IPerfilRepository,
  ISolicitudReservaRepository,
  MetadataRegistro,
  OpcionesSuscripcion,
  ParametrosDictamenSolicitud,
  ResultadoRegistro,
  UsuarioAuth,
} from '@/domain/repositories';
import type { SolicitudAdminSinColision } from '@/domain/usecases/panelAdmin';
import { supabase } from '../supabase/supabaseClient';
import { lanzarSiError } from '../supabase/supabaseError';
import { BUCKETS, TABLAS } from '../supabase/tables';

export { RepositorioError, describirError, errorInfoDesde } from '../supabase/supabaseError';
export type { ErrorInfo } from '../supabase/supabaseError';

// ─────────────────────────────────────────────────────────────────────────────
// Perfiles
// ─────────────────────────────────────────────────────────────────────────────

export class SupabasePerfilRepository implements IPerfilRepository {
  async obtenerPorId(id: UUID): Promise<PerfilUsuario | null> {
    const res = await supabase.from(TABLAS.perfilesUsuarios).select('*').eq('id', id).maybeSingle();
    lanzarSiError('No se pudo cargar el perfil (perfiles_usuarios)', res);
    return (res.data as PerfilUsuario | null) ?? null;
  }

  async crear(perfil: NuevoPerfilUsuario): Promise<PerfilUsuario> {
    const res = await supabase.from(TABLAS.perfilesUsuarios).insert(perfil).select().single();
    if (res.error && res.error.code === '23505') {
      // Reintento o condición de carrera: si la fila ya es de este usuario, se reutiliza.
      const existente = await this.obtenerPorId(perfil.id);
      if (existente) return existente;
    }
    lanzarSiError('No se pudo crear el perfil (perfiles_usuarios)', res);
    return res.data as PerfilUsuario;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación (Supabase Auth)
// ─────────────────────────────────────────────────────────────────────────────

const metadataDe = (user: User): Partial<MetadataRegistro> =>
  (user.user_metadata ?? {}) as Partial<MetadataRegistro>;

const aUsuarioAuth = (user: User): UsuarioAuth => ({
  id: user.id,
  correo: user.email ?? null,
  metadata: metadataDe(user),
});

/** Traduce un `AuthError` de Supabase a un `ErrorAuth` de dominio con mensaje en español. */
export const mapearErrorAuth = (err: unknown): ErrorAuth => {
  const e = (typeof err === 'object' && err !== null ? err : { message: String(err) }) as {
    message?: string;
    code?: string;
    status?: number;
    name?: string;
  };
  const message = e.message ?? '';
  const code = e.code ?? '';
  const detalle = JSON.stringify(
    { name: e.name ?? null, code: e.code ?? null, status: e.status ?? null, message },
    null,
    2,
  );

  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /network request failed|failed to fetch/i.test(message)) {
    return new ErrorAuth(
      'sin_conexion',
      'No se pudo contactar al servidor. Revisa tu conexión a internet e inténtalo de nuevo.',
      detalle,
    );
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new ErrorAuth('credenciales_invalidas', 'Usuario o contraseña incorrectos.', detalle);
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new ErrorAuth(
      'correo_sin_confirmar',
      'Tu correo aún no está confirmado. Abre el mensaje de confirmación que te enviamos y vuelve a intentarlo.',
      detalle,
    );
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already been registered/i.test(message)) {
    return new ErrorAuth('usuario_existente', 'Ya existe una cuenta con ese correo.', detalle);
  }
  if (code === 'weak_password' || /password should be|weak password/i.test(message)) {
    return new ErrorAuth('password_debil', `La contraseña es muy débil. ${message}`.trim(), detalle, {
      password: 'Elige una contraseña más segura.',
    });
  }
  if (code === 'signup_disabled' || /signups not allowed|signup is disabled/i.test(message)) {
    return new ErrorAuth(
      'registro_deshabilitado',
      'El registro de nuevas cuentas está deshabilitado en Supabase (Auth → Providers → Email).',
      detalle,
    );
  }
  if (e.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return new ErrorAuth(
      'limite_solicitudes',
      'Demasiados intentos en poco tiempo. Espera unos minutos e inténtalo de nuevo.',
      detalle,
    );
  }
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(message)) {
    return new ErrorAuth('validacion', 'El servidor rechazó ese correo electrónico por no ser válido.', detalle, {
      correo: 'Correo no aceptado.',
    });
  }
  return new ErrorAuth('desconocido', message || 'Error de autenticación sin descripción del servidor.', detalle);
};

export class SupabaseAutenticacionGateway implements IAutenticacionGateway {
  async iniciarSesion(correo: string, password: string): Promise<UsuarioAuth> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password });
    if (error) throw mapearErrorAuth(error);
    if (!data.user) throw new ErrorAuth('desconocido', 'Supabase no devolvió el usuario autenticado.');
    return aUsuarioAuth(data.user);
  }

  async registrar(
    correo: string,
    password: string,
    metadata: MetadataRegistro,
  ): Promise<ResultadoRegistro> {
    const { data, error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: { data: { ...metadata } },
    });
    if (error) throw mapearErrorAuth(error);
    if (!data.user) throw new ErrorAuth('desconocido', 'Supabase no devolvió el usuario registrado.');

    // Con confirmación de correo activa, un correo ya registrado NO devuelve error:
    // devuelve un usuario "falso" sin identidades (anti-enumeración).
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new ErrorAuth('usuario_existente', 'Ya existe una cuenta con ese correo.');
    }
    return { usuario: aUsuarioAuth(data.user), sesionActiva: !!data.session };
  }

  async cerrarSesion(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error && !/session.*missing|not authenticated/i.test(error.message)) {
      throw mapearErrorAuth(error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Espacios
// ─────────────────────────────────────────────────────────────────────────────

export class SupabaseEspacioRepository implements IEspacioRepository {
  async listarCatalogo(): Promise<Espacio[]> {
    const res = await supabase
      .from(TABLAS.espacios)
      .select('*')
      .order('codigo_espacio', { ascending: true });
    lanzarSiError('No se pudo consultar el catálogo (espacios)', res);
    return (res.data ?? []) as Espacio[];
  }

  async obtenerPorId(id: UUID): Promise<Espacio | null> {
    const res = await supabase.from(TABLAS.espacios).select('*').eq('id', id).maybeSingle();
    lanzarSiError('No se pudo consultar el espacio (espacios)', res);
    return (res.data as Espacio | null) ?? null;
  }

  async actualizar(espacioId: UUID, datos: Partial<Espacio>): Promise<Espacio> {
    const payload: Record<string, unknown> = {
      ...datos,
      updated_at: new Date().toISOString(),
    };
    delete payload.id;
    delete payload.created_at;

    const res = await supabase
      .from(TABLAS.espacios)
      .update(payload)
      .eq('id', espacioId)
      .select('*')
      .single();
    lanzarSiError('No se pudo actualizar el espacio (espacios)', res);
    return res.data as Espacio;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Solicitudes de reserva (proyección pública + operaciones administrativas)
// ─────────────────────────────────────────────────────────────────────────────

/** Columnas mínimas para el calendario público: sin `usuario_id` ni `tema_evento`. */
const COLUMNAS_CALENDARIO =
  'id,espacio_id,fecha_evento,hora_inicio,hora_fin,hora_fin_limpieza,estado';

/** Proyección completa administrativa con joins anidados. */
const SELECT_ADMIN_ANIDADO =
  '*, usuario:perfiles_usuarios!usuario_id(*), espacio:espacios!espacio_id(*), documentos:documentos_solicitud(*)';

const normalizarFilaSolicitudAdmin = (raw: Record<string, unknown>): SolicitudAdminSinColision => {
  const usuarioRaw = raw.usuario;
  const espacioRaw = raw.espacio;
  const docsRaw = raw.documentos;

  const usuario = (Array.isArray(usuarioRaw) ? usuarioRaw[0] : usuarioRaw) as PerfilUsuario | null;
  const espacio = (Array.isArray(espacioRaw) ? espacioRaw[0] : espacioRaw) as Espacio | null;
  const documentos = (Array.isArray(docsRaw) ? docsRaw : []) as DocumentoSolicitud[];

  return {
    id: String(raw.id),
    usuario_id: String(raw.usuario_id),
    espacio_id: String(raw.espacio_id),
    fecha_evento: String(raw.fecha_evento),
    hora_inicio: String(raw.hora_inicio),
    hora_fin: String(raw.hora_fin),
    hora_fin_limpieza: raw.hora_fin_limpieza ? String(raw.hora_fin_limpieza) : null,
    tema_evento: String(raw.tema_evento ?? ''),
    estado: (raw.estado as EstadoSolicitud) ?? 'pendiente',
    evaluado_por_admin_id: raw.evaluado_por_admin_id ? String(raw.evaluado_por_admin_id) : null,
    fecha_dictamen: raw.fecha_dictamen ? String(raw.fecha_dictamen) : null,
    motivo_rechazo_cancelacion: raw.motivo_rechazo_cancelacion
      ? String(raw.motivo_rechazo_cancelacion)
      : null,
    created_at: String(raw.created_at),
    usuario: usuario ?? null,
    espacio: espacio ?? null,
    documentos,
  };
};

export class SupabaseSolicitudReservaRepository implements ISolicitudReservaRepository {
  async listarActivasPorEspacioYFecha(
    espacioId: UUID,
    fechaISO: ISODate,
  ): Promise<SolicitudReservaCalendario[]> {
    const res = await supabase
      .from(TABLAS.solicitudesReservas)
      .select(COLUMNAS_CALENDARIO)
      .eq('espacio_id', espacioId)
      .eq('fecha_evento', fechaISO)
      .in('estado', ['pendiente', 'aprobada'])
      .order('hora_inicio', { ascending: true });
    lanzarSiError('No se pudo consultar las reservas (solicitudes_reservas)', res);
    return (res.data ?? []) as SolicitudReservaCalendario[];
  }

  async listarParaAdmin(filtroEstado?: EstadoSolicitud): Promise<SolicitudAdminSinColision[]> {
    let query = supabase
      .from(TABLAS.solicitudesReservas)
      .select(SELECT_ADMIN_ANIDADO)
      .order('fecha_evento', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (filtroEstado) {
      query = query.eq('estado', filtroEstado);
    }

    const res = await query;
    lanzarSiError('No se pudo listar las solicitudes para administración (solicitudes_reservas)', res);
    const filas = (res.data ?? []) as Record<string, unknown>[];
    return filas.map(normalizarFilaSolicitudAdmin);
  }

  async listarParaReporte(
    fechaInicioISO: ISODate,
    fechaFinISO: ISODate,
  ): Promise<SolicitudAdminSinColision[]> {
    const res = await supabase
      .from(TABLAS.solicitudesReservas)
      .select(SELECT_ADMIN_ANIDADO)
      .gte('fecha_evento', fechaInicioISO)
      .lte('fecha_evento', fechaFinISO)
      .order('fecha_evento', { ascending: true })
      .order('hora_inicio', { ascending: true });

    lanzarSiError('No se pudo consultar las solicitudes del reporte (solicitudes_reservas)', res);
    const filas = (res.data ?? []) as Record<string, unknown>[];
    return filas.map(normalizarFilaSolicitudAdmin);
  }

  async dictaminar(params: ParametrosDictamenSolicitud): Promise<SolicitudReserva> {
    const res = await supabase
      .from(TABLAS.solicitudesReservas)
      .update({
        estado: params.nuevoEstado,
        evaluado_por_admin_id: params.adminId,
        fecha_dictamen: params.fechaDictamenISO,
        motivo_rechazo_cancelacion: params.motivo,
      })
      .eq('id', params.solicitudId)
      .select('*')
      .single();

    lanzarSiError('No se pudo dictaminar la solicitud (solicitudes_reservas)', res);
    return res.data as SolicitudReserva;
  }

  async crearDemo(datos: EntradaCrearSolicitudDemo): Promise<SolicitudReserva> {
    const res = await supabase
      .from(TABLAS.solicitudesReservas)
      .insert({
        usuario_id: datos.usuario_id,
        espacio_id: datos.espacio_id,
        fecha_evento: datos.fecha_evento,
        hora_inicio: datos.hora_inicio,
        hora_fin: datos.hora_fin,
        hora_fin_limpieza: datos.hora_fin_limpieza,
        tema_evento: datos.tema_evento,
        estado: 'pendiente',
      })
      .select('*')
      .single();

    lanzarSiError('No se pudo insertar la solicitud demo (solicitudes_reservas)', res);
    return res.data as SolicitudReserva;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentos de Solicitud
// ─────────────────────────────────────────────────────────────────────────────

export class SupabaseDocumentoSolicitudRepository implements IDocumentoSolicitudRepository {
  async crearVarios(documentos: readonly NuevoDocumentoSolicitud[]): Promise<DocumentoSolicitud[]> {
    if (documentos.length === 0) return [];
    const res = await supabase
      .from(TABLAS.documentosSolicitud)
      .insert([...documentos])
      .select('*');
    lanzarSiError('No se pudieron adjuntar los documentos de la solicitud (documentos_solicitud)', res);
    return (res.data ?? []) as DocumentoSolicitud[];
  }

  async obtenerUrlDescarga(storagePath: string): Promise<string | null> {
    const limpio = storagePath.trim();
    if (!limpio) return null;
    if (/^https?:\/\//i.test(limpio)) return limpio;

    const { data, error } = await supabase.storage
      .from(BUCKETS.documentosSolicitud)
      .createSignedUrl(limpio, 3600);

    if (!error && data?.signedUrl) return data.signedUrl;

    const pub = supabase.storage.from(BUCKETS.documentosSolicitud).getPublicUrl(limpio);
    return pub.data.publicUrl || null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial de Estados de Solicitud (Bitácora de Auditoría)
// ─────────────────────────────────────────────────────────────────────────────

const SELECT_HISTORIAL =
  '*, solicitud:solicitudes_reservas(id,fecha_evento,hora_inicio,hora_fin,tema_evento,espacio_id), usuario:perfiles_usuarios!cambiado_por_usuario_id(id,nombre_completo,correo,rol)';

export class SupabaseHistorialSolicitudRepository implements IHistorialSolicitudRepository {
  async listarReciente(limite = 50): Promise<HistorialAuditoriaItem[]> {
    const res = await supabase
      .from(TABLAS.historialEstadosSolicitud)
      .select(SELECT_HISTORIAL)
      .order('fecha_cambio', { ascending: false })
      .limit(limite);
    lanzarSiError('No se pudo consultar la bitácora de auditoría (historial_estados_solicitud)', res);
    return (res.data ?? []) as HistorialAuditoriaItem[];
  }

  async listarPorSolicitudes(solicitudIds: readonly UUID[]): Promise<HistorialAuditoriaItem[]> {
    if (solicitudIds.length === 0) return [];
    const res = await supabase
      .from(TABLAS.historialEstadosSolicitud)
      .select(SELECT_HISTORIAL)
      .in('solicitud_id', [...solicitudIds])
      .order('fecha_cambio', { ascending: false });
    lanzarSiError('No se pudo consultar el historial de las solicitudes (historial_estados_solicitud)', res);
    return (res.data ?? []) as HistorialAuditoriaItem[];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime (postgres_changes)
// ─────────────────────────────────────────────────────────────────────────────

export class SupabaseCambiosEnVivoGateway implements ICambiosEnVivoGateway {
  suscribir({ tablas, espacioId, onCambio, onEstado }: OpcionesSuscripcion): () => void {
    // Nombre único: evita colisiones al montar/desmontar pantallas (StrictMode, navegación).
    const nombre = `vivo-${tablas.join('+')}-${espacioId ?? 'todos'}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    let canal = supabase.channel(nombre);

    for (const tabla of tablas) {
      const filtro =
        tabla === 'solicitudes_reservas' && espacioId ? { filter: `espacio_id=eq.${espacioId}` } : {};
      canal = canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla, ...filtro },
        (payload) => {
          const cambio: CambioEnVivo = { tabla, evento: payload.eventType };
          onCambio(cambio);
        },
      );
    }

    onEstado?.('conectando');
    canal.subscribe((status, err) => {
      switch (status) {
        case 'SUBSCRIBED':
          onEstado?.('en_vivo');
          break;
        case 'CHANNEL_ERROR':
          onEstado?.('error', err?.message || 'Error en el canal Realtime');
          break;
        case 'TIMED_OUT':
          onEstado?.('error', 'Tiempo de espera agotado al conectar con Realtime');
          break;
        case 'CLOSED':
          onEstado?.('conectando');
          break;
      }
    });

    return () => {
      void supabase.removeChannel(canal);
    };
  }
}

/** Contenedor simple de dependencias (instancias únicas). */
export const repositorios = {
  perfiles: new SupabasePerfilRepository(),
  autenticacion: new SupabaseAutenticacionGateway(),
  espacios: new SupabaseEspacioRepository(),
  solicitudes: new SupabaseSolicitudReservaRepository(),
  documentos: new SupabaseDocumentoSolicitudRepository(),
  historial: new SupabaseHistorialSolicitudRepository(),
  cambiosEnVivo: new SupabaseCambiosEnVivoGateway(),
} as const;
