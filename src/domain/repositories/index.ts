/**
 * Capa de Dominio — Contratos de repositorios y servicios (puertos).
 *
 * La capa de infraestructura (Supabase) implementa estas interfaces; los casos
 * de uso y controladores dependen SÓLO de estos contratos (inversión de
 * dependencias), nunca del cliente de Supabase directamente.
 */
import type {
  Espacio,
  ISODate,
  NuevoPerfilUsuario,
  PerfilUsuario,
  SolicitudReservaCalendario,
  UUID,
} from '../models';

export interface IPerfilRepository {
  obtenerPorId(id: UUID): Promise<PerfilUsuario | null>;
  /**
   * Inserta la fila de `perfiles_usuarios` del usuario autenticado.
   * Si ya existía (condición de carrera / reintento) devuelve la existente.
   */
  crear(perfil: NuevoPerfilUsuario): Promise<PerfilUsuario>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación (Supabase Auth)
// ─────────────────────────────────────────────────────────────────────────────

/** Datos que se guardan en `user_metadata` al registrar (permiten reconstruir el perfil). */
export interface MetadataRegistro {
  nombre_completo: string;
  rol: string;
  matricula: string | null;
  telefono: string | null;
  dependencia_procedencia: string | null;
}

export interface UsuarioAuth {
  id: UUID;
  correo: string | null;
  metadata: Partial<MetadataRegistro>;
}

export interface ResultadoRegistro {
  usuario: UsuarioAuth;
  /** `false` si Supabase exige confirmar el correo antes de dar sesión. */
  sesionActiva: boolean;
}

export interface IAutenticacionGateway {
  /** Lanza `ErrorAuth` (credenciales inválidas, correo sin confirmar, red…). */
  iniciarSesion(correo: string, password: string): Promise<UsuarioAuth>;
  /** Lanza `ErrorAuth` con `usuario_existente` si el correo ya estaba registrado. */
  registrar(correo: string, password: string, metadata: MetadataRegistro): Promise<ResultadoRegistro>;
  cerrarSesion(): Promise<void>;
}

export interface IEspacioRepository {
  /** Catálogo completo de `espacios`, ordenado por `codigo_espacio` ASC. */
  listarCatalogo(): Promise<Espacio[]>;
  obtenerPorId(id: UUID): Promise<Espacio | null>;
}

export interface ISolicitudReservaRepository {
  /**
   * Solicitudes con estado `pendiente` o `aprobada` de un espacio en una fecha.
   * Devuelve sólo la proyección pública (sin datos personales).
   */
  listarActivasPorEspacioYFecha(
    espacioId: UUID,
    fechaISO: ISODate,
  ): Promise<SolicitudReservaCalendario[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambios en vivo (Realtime)
// ─────────────────────────────────────────────────────────────────────────────

export type TablaEnVivo = 'espacios' | 'solicitudes_reservas';
export type EventoEnVivo = 'INSERT' | 'UPDATE' | 'DELETE';
export type EstadoEnVivo = 'conectando' | 'en_vivo' | 'error';

export interface CambioEnVivo {
  tabla: TablaEnVivo;
  evento: EventoEnVivo;
}

export interface OpcionesSuscripcion {
  /** Tablas a escuchar. */
  tablas: readonly TablaEnVivo[];
  /** Si se indica, los cambios de `solicitudes_reservas` se filtran por este espacio. */
  espacioId?: UUID;
  onCambio: (cambio: CambioEnVivo) => void;
  onEstado?: (estado: EstadoEnVivo, detalle?: string) => void;
}

export interface ICambiosEnVivoGateway {
  /** Devuelve la función que cancela la suscripción. */
  suscribir(opciones: OpcionesSuscripcion): () => void;
}
