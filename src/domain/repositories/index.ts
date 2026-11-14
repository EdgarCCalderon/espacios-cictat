/**
 * Capa de Dominio — Contratos de repositorios y servicios (puertos).
 *
 * La capa de infraestructura (Supabase) implementa estas interfaces; los casos
 * de uso y controladores dependen SÓLO de estos contratos (inversión de
 * dependencias), nunca del cliente de Supabase directamente.
 */
import type {
  DocumentoSolicitud,
  Espacio,
  EstadoDictamen,
  EstadoSolicitud,
  HistorialAuditoriaItem,
  ISODate,
  ISODateTime,
  ISOTime,
  NuevoDocumentoSolicitud,
  NuevoPerfilUsuario,
  PerfilUsuario,
  SolicitudReserva,
  SolicitudReservaCalendario,
  UUID,
} from '../models';
import type { SolicitudAdminSinColision } from '../usecases/panelAdmin';

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

// ─────────────────────────────────────────────────────────────────────────────
// Espacios
// ─────────────────────────────────────────────────────────────────────────────

export interface IEspacioRepository {
  /** Catálogo completo de `espacios`, ordenado por `codigo_espacio` ASC. */
  listarCatalogo(): Promise<Espacio[]>;
  obtenerPorId(id: UUID): Promise<Espacio | null>;
  /** Actualiza campos editables de un espacio (`esta_activo`, `capacidad`, `equipamiento_incluido`, `reglamento`). */
  actualizar(espacioId: UUID, datos: Partial<Espacio>): Promise<Espacio>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Solicitudes de reserva
// ─────────────────────────────────────────────────────────────────────────────

export interface ParametrosDictamenSolicitud {
  solicitudId: UUID;
  adminId: UUID;
  nuevoEstado: EstadoDictamen;
  motivo: string | null;
  fechaDictamenISO: ISODateTime;
}

export interface EntradaCrearSolicitudDemo {
  usuario_id: UUID;
  espacio_id: UUID;
  fecha_evento: ISODate;
  hora_inicio: ISOTime;
  hora_fin: ISOTime;
  hora_fin_limpieza: ISOTime;
  tema_evento: string;
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

  /**
   * Consulta administrativa completa con relaciones anidadas (`usuario`, `espacio`, `documentos`),
   * ordenada por `fecha_evento` ASC y `hora_inicio` ASC.
   */
  listarParaAdmin(filtroEstado?: EstadoSolicitud): Promise<SolicitudAdminSinColision[]>;

  /**
   * Consulta administrativa en un rango de fechas (`[fechaInicioISO, fechaFinISO]`)
   * para reportes y estadísticas.
   */
  listarParaReporte(
    fechaInicioISO: ISODate,
    fechaFinISO: ISODate,
  ): Promise<SolicitudAdminSinColision[]>;

  /**
   * Dictamina una solicitud (`aprobada`, `rechazada` o `cancelada`).
   * El trigger SQL `trg_after_solicitud_reserva` en Supabase se encarga de
   * rechazar en cascada las solicitudes pendientes en colisión y registrar la bitácora.
   */
  dictaminar(params: ParametrosDictamenSolicitud): Promise<SolicitudReserva>;

  /** Inserta una solicitud de reserva (usado por el generador de datos demo). */
  crearDemo(datos: EntradaCrearSolicitudDemo): Promise<SolicitudReserva>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentos adjuntos y Bitácora de Auditoría
// ─────────────────────────────────────────────────────────────────────────────

export interface IDocumentoSolicitudRepository {
  crearVarios(documentos: readonly NuevoDocumentoSolicitud[]): Promise<DocumentoSolicitud[]>;
  obtenerUrlDescarga(storagePath: string): Promise<string | null>;
}

export interface IHistorialSolicitudRepository {
  listarReciente(limite?: number): Promise<HistorialAuditoriaItem[]>;
  listarPorSolicitudes(solicitudIds: readonly UUID[]): Promise<HistorialAuditoriaItem[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cambios en vivo (Realtime)
// ─────────────────────────────────────────────────────────────────────────────

export type TablaEnVivo = 'espacios' | 'solicitudes_reservas' | 'historial_estados_solicitud';
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
