/**
 * Capa de Dominio — Modelos de "Espacios CICTAT".
 *
 * Estos tipos espejean las tablas y enums de la base de datos en Supabase
 * (PostgreSQL), verificados contra el esquema real. Son agnósticos de
 * framework: no importan nada de React, React Native ni Supabase.
 *
 * Convenciones:
 *  - `uuid`        → string
 *  - `timestamptz` → string ISO-8601 (p. ej. "2026-11-11T23:10:13-06:00")
 *  - `date`        → string "YYYY-MM-DD"
 *  - `time`        → string "HH:mm:ss"
 *  - Columnas NULLables → `T | null`
 */

// ─────────────────────────────────────────────────────────────────────────────
// Alias primitivos semánticos
// ─────────────────────────────────────────────────────────────────────────────

export type UUID = string;
/** timestamptz en formato ISO-8601. */
export type ISODateTime = string;
/** date en formato "YYYY-MM-DD". */
export type ISODate = string;
/** time en formato "HH:mm" o "HH:mm:ss". */
export type ISOTime = string;

// ─────────────────────────────────────────────────────────────────────────────
// Enums (espejo de los tipos ENUM de PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

export type RolUsuario =
  | 'estudiante_posgrado'
  | 'doctor_posgrado'
  | 'publico_general'
  | 'administrador';

export type TipoEspacio = 'sala_posgrado' | 'cubiculo_estudio';

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export type TipoDocumento =
  | 'credencial_posgrado'
  | 'ine_externo'
  | 'formato_pdf_prellenado';

/** Listas en tiempo de ejecución (útiles para selects, validaciones y filtros). */
export const ROLES_USUARIO: readonly RolUsuario[] = [
  'estudiante_posgrado',
  'doctor_posgrado',
  'publico_general',
  'administrador',
] as const;

export const TIPOS_ESPACIO: readonly TipoEspacio[] = ['sala_posgrado', 'cubiculo_estudio'] as const;

export const ESTADOS_SOLICITUD: readonly EstadoSolicitud[] = [
  'pendiente',
  'aprobada',
  'rechazada',
  'cancelada',
] as const;

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = [
  'credencial_posgrado',
  'ine_externo',
  'formato_pdf_prellenado',
] as const;

/** Etiquetas legibles (UI) de cada rol. */
export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  estudiante_posgrado: 'Alumno de Posgrado',
  doctor_posgrado: 'Doctor de Posgrado',
  publico_general: 'Público General',
  administrador: 'Administrador',
};

// ─────────────────────────────────────────────────────────────────────────────
// Entidades
// ─────────────────────────────────────────────────────────────────────────────

/** Tabla `perfiles_usuarios` (1:1 con `auth.users`). */
export interface PerfilUsuario {
  /** PK y FK → auth.users.id */
  id: UUID;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  /** Matrícula UJAT (sólo comunidad de posgrado). */
  matricula: string | null;
  telefono: string | null;
  /** Dependencia / institución de procedencia (p. ej. "DACyTI - CICTAT" o una empresa externa). */
  dependencia_procedencia: string | null;
  created_at: ISODateTime;
}

/** Fila a insertar en `perfiles_usuarios` al activar/registrar una cuenta. */
export type NuevoPerfilUsuario = Pick<
  PerfilUsuario,
  | 'id'
  | 'nombre_completo'
  | 'correo'
  | 'rol'
  | 'matricula'
  | 'telefono'
  | 'dependencia_procedencia'
>

/** Tabla `espacios` — salas de posgrado y cubículos de estudio. */
export interface Espacio {
  id: UUID;
  /** Código institucional único (p. ej. "SALA-01", "CUB-07"). */
  codigo_espacio: string;
  nombre: string;
  tipo_espacio: TipoEspacio;
  capacidad: number;
  /** Texto libre: "Proyector, laptop y extensión eléctrica incluidos." */
  equipamiento_incluido: string | null;
  reglamento: string | null;
  /** Si es `true`, sólo alumnos de posgrado (y administradores) pueden reservarlo. */
  exclusivo_alumnos_posgrado: boolean;
  imagen_url: string | null;
  /** `false` ⇒ "En Mantenimiento". */
  esta_activo: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Tabla `solicitudes_reservas`. */
export interface SolicitudReserva {
  id: UUID;
  /** FK → perfiles_usuarios.id (solicitante). */
  usuario_id: UUID;
  /** FK → espacios.id */
  espacio_id: UUID;
  /** Día del evento ("YYYY-MM-DD"). */
  fecha_evento: ISODate;
  hora_inicio: ISOTime;
  hora_fin: ISOTime;
  /** hora_fin + margen de limpieza; el espacio queda bloqueado hasta aquí. */
  hora_fin_limpieza: ISOTime | null;
  tema_evento: string;
  estado: EstadoSolicitud;
  created_at: ISODateTime;
}

/**
 * Proyección PÚBLICA de una solicitud: sólo lo necesario para pintar el
 * calendario. No incluye `usuario_id` ni `tema_evento` (datos personales).
 */
export type SolicitudReservaCalendario = Pick<
  SolicitudReserva,
  'id' | 'espacio_id' | 'fecha_evento' | 'hora_inicio' | 'hora_fin' | 'hora_fin_limpieza' | 'estado'
>;

/** Tabla `documentos_solicitud` — archivos adjuntos (columnas confirmadas). */
export interface DocumentoSolicitud {
  id: UUID;
  /** FK → solicitudes_reservas.id */
  solicitud_id: UUID;
  tipo_documento: TipoDocumento;
  nombre_archivo: string;
  created_at: ISODateTime;
}

/** Tabla `historial_estados_solicitud` — bitácora de auditoría. */
export interface HistorialEstadoSolicitud {
  id: UUID;
  /** FK → solicitudes_reservas.id */
  solicitud_id: UUID;
  /** `null` cuando es la creación de la solicitud. */
  estado_anterior: EstadoSolicitud | null;
  estado_nuevo: EstadoSolicitud;
  /** FK → perfiles_usuarios.id */
  cambiado_por: UUID | null;
  comentario: string | null;
  created_at: ISODateTime;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de escritura (columnas generadas por la BD se omiten)
// ─────────────────────────────────────────────────────────────────────────────

type ColumnasGeneradas = 'id' | 'created_at' | 'updated_at';

export type NuevoEspacio = Omit<Espacio, ColumnasGeneradas>;
export type ActualizarEspacio = Partial<NuevoEspacio>;

export type NuevaSolicitudReserva = Omit<
  SolicitudReserva,
  'id' | 'created_at' | 'estado' | 'hora_fin_limpieza'
>;

export type ActualizarPerfilUsuario = Partial<Omit<PerfilUsuario, 'id' | 'created_at' | 'rol' | 'correo'>>;

export type NuevoDocumentoSolicitud = Omit<DocumentoSolicitud, 'id' | 'created_at'>;

// ─────────────────────────────────────────────────────────────────────────────
// Agregados de lectura (joins frecuentes)
// ─────────────────────────────────────────────────────────────────────────────

export interface SolicitudReservaDetalle extends SolicitudReserva {
  espacio: Pick<Espacio, 'id' | 'codigo_espacio' | 'nombre' | 'tipo_espacio' | 'capacidad'>;
  solicitante: Pick<PerfilUsuario, 'id' | 'nombre_completo' | 'correo' | 'rol'>;
  documentos: DocumentoSolicitud[];
}
