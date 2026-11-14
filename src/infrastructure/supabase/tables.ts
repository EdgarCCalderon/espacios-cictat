/**
 * Infraestructura — Nombres de tablas en Supabase (fuente única de verdad).
 * Verificados contra el esquema real del proyecto.
 */
export const TABLAS = {
  perfilesUsuarios: 'perfiles_usuarios',
  espacios: 'espacios',
  solicitudesReservas: 'solicitudes_reservas',
  documentosSolicitud: 'documentos_solicitud',
  historialEstadosSolicitud: 'historial_estados_solicitud',
} as const;

export const BUCKETS = {
  documentosSolicitud: 'documentos-solicitud',
} as const;
