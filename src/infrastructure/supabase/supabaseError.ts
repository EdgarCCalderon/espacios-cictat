/**
 * Infraestructura — Normalización de errores de Supabase / PostgREST.
 *
 * Regla: NUNCA se muestra un "error desconocido". Siempre se extraen
 * `message`, `details`, `hint` y `code` (y el status HTTP) para que el
 * usuario/desarrollador vea la causa real: permisos (RLS/GRANT), red,
 * esquema, etc.
 */

export interface ErrorInfo {
  contexto: string;
  mensaje: string;
  detalles: string | null;
  hint: string | null;
  code: string | null;
  status: number | null;
  /** Volcado completo (JSON con sangría) para mostrar/copiar en pantallas de diagnóstico. */
  json: string;
}

/** Error de repositorio que conserva toda la información diagnóstica. */
export class RepositorioError extends Error implements ErrorInfo {
  readonly contexto: string;
  readonly mensaje: string;
  readonly detalles: string | null;
  readonly hint: string | null;
  readonly code: string | null;
  readonly status: number | null;
  readonly json: string;

  constructor(info: ErrorInfo) {
    super(info.mensaje);
    this.name = 'RepositorioError';
    this.contexto = info.contexto;
    this.mensaje = info.mensaje;
    this.detalles = info.detalles;
    this.hint = info.hint;
    this.code = info.code;
    this.status = info.status;
    this.json = info.json;
  }
}

interface ErrorCrudo {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  name?: unknown;
  stack?: unknown;
}

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : String(v);
  return s.trim().length > 0 ? s : null;
};

const HINT_RED =
  'Sin respuesta del servidor. Revisa tu conexión a internet y que EXPO_PUBLIC_SUPABASE_URL sea correcta.';

const HINT_PERMISOS =
  'Permiso denegado. Revisa los GRANT y las políticas RLS de la tabla para los roles anon/authenticated.';

/**
 * Convierte cualquier valor (PostgrestError, Error, string, objeto…) en `ErrorInfo`.
 * `status` es el código HTTP de la respuesta, si se conoce (0 ⇒ fallo de red).
 */
export const describirError = (
  contexto: string,
  err: unknown,
  status?: number | null,
  statusText?: string | null,
): ErrorInfo => {
  const e: ErrorCrudo = typeof err === 'object' && err !== null ? (err as ErrorCrudo) : { message: err };

  const code = texto(e.code);
  let mensaje = texto(e.message);
  if (!mensaje) {
    mensaje =
      status && status > 0
        ? `HTTP ${status}${statusText ? ' ' + statusText : ''} sin mensaje del servidor`
        : status === 0
          ? 'No se pudo contactar al servidor'
          : texto(err) ?? 'La respuesta de Supabase no incluyó información del error';
  }

  let hint = texto(e.hint);
  if (!hint) {
    if (status === 0) hint = HINT_RED;
    else if (code === '42501' || status === 401 || status === 403) hint = HINT_PERMISOS;
  }

  const detalles = texto(e.details);

  const json = JSON.stringify(
    {
      contexto,
      message: mensaje,
      details: detalles,
      hint,
      code,
      status: status ?? null,
      statusText: statusText ?? null,
      ...(texto(e.name) ? { name: texto(e.name) } : {}),
    },
    null,
    2,
  );

  return { contexto, mensaje, detalles, hint, code, status: status ?? null, json };
};

/** Lanza un `RepositorioError` completo si la respuesta de Supabase trae `error`. */
export const lanzarSiError = (
  contexto: string,
  respuesta: { error: unknown; status?: number; statusText?: string },
): void => {
  if (!respuesta.error) return;
  throw new RepositorioError(
    describirError(contexto, respuesta.error, respuesta.status, respuesta.statusText),
  );
};

/** Garantiza un `ErrorInfo` a partir de lo capturado en un `catch`. */
export const errorInfoDesde = (contexto: string, err: unknown): ErrorInfo =>
  err instanceof RepositorioError ? err : describirError(contexto, err, null);
