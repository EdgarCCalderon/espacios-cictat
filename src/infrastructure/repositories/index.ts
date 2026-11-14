/**
 * Infraestructura — Implementaciones Supabase de los repositorios de dominio.
 *
 * Todas las consultas pasan por `lanzarSiError`, de modo que un fallo de red o
 * de permisos siempre llega a la UI con message/details/hint/code reales.
 */
import type { User } from '@supabase/supabase-js';

import { ErrorAuth } from '@/domain/errors/ErrorAuth';
import type {
  CambioEnVivo,
  IAutenticacionGateway,
  ICambiosEnVivoGateway,
  IEspacioRepository,
  IPerfilRepository,
  ISolicitudReservaRepository,
  MetadataRegistro,
  OpcionesSuscripcion,
  ResultadoRegistro,
  UsuarioAuth,
} from '@/domain/repositories';
import type {
  Espacio,
  ISODate,
  NuevoPerfilUsuario,
  PerfilUsuario,
  SolicitudReservaCalendario,
  UUID,
} from '@/domain/models';
import { supabase } from '../supabase/supabaseClient';
import { lanzarSiError } from '../supabase/supabaseError';
import { TABLAS } from '../supabase/tables';

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Solicitudes (sólo la proyección pública que necesita el calendario)
// ─────────────────────────────────────────────────────────────────────────────

/** Columnas mínimas: sin `usuario_id` ni `tema_evento` (datos personales). */
const COLUMNAS_CALENDARIO =
  'id,espacio_id,fecha_evento,hora_inicio,hora_fin,hora_fin_limpieza,estado';

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
  cambiosEnVivo: new SupabaseCambiosEnVivoGateway(),
} as const;
