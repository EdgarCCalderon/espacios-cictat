/**
 * Caso de uso — Reglas puras de autenticación (sin React ni Supabase).
 */
import { ETIQUETA_ROL, type RolUsuario } from '../models';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

export const DEPENDENCIA_COMUNIDAD_UJAT = 'CICTAT - UJAT';
export const DOMINIO_ALUMNOS = 'alumno.ujat.mx';
export const DOMINIO_DOCTORES = 'ujat.mx';
/** Mínimo de Supabase Auth por defecto. */
export const PASSWORD_MIN = 6;

export type RolComunidadUJAT = Extract<RolUsuario, 'estudiante_posgrado' | 'doctor_posgrado'>;

export const esRolComunidadUJAT = (v: unknown): v is RolComunidadUJAT =>
  v === 'estudiante_posgrado' || v === 'doctor_posgrado';

// ─────────────────────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────────────────────

export const normalizarMatricula = (m: string): string => m.trim().toUpperCase();

export const normalizarCorreo = (c: string): string => c.trim().toLowerCase();

/**
 * Correo institucional a usar:
 *  - si el usuario escribió un correo (con "@"), se respeta;
 *  - si sólo hay matrícula → `matricula@alumno.ujat.mx` (estudiantes) o
 *    `matricula@ujat.mx` (doctores).
 */
export const derivarCorreoInstitucional = (matricula: string, rol: RolComunidadUJAT): string => {
  const m = normalizarMatricula(matricula).toLowerCase();
  if (!m) return '';
  return `${m}@${rol === 'estudiante_posgrado' ? DOMINIO_ALUMNOS : DOMINIO_DOCTORES}`;
};

export const resolverCorreoInstitucional = (
  correoIngresado: string | undefined,
  matricula: string,
  rol: RolComunidadUJAT,
): string => {
  const c = (correoIngresado ?? '').trim();
  if (c.includes('@')) return normalizarCorreo(c);
  // El usuario escribió sólo el usuario ("222h17001") sin dominio
  if (c.length > 0) return derivarCorreoInstitucional(c, rol);
  return derivarCorreoInstitucional(matricula, rol);
};

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones (devuelven mensaje de error o null)
// ─────────────────────────────────────────────────────────────────────────────

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validarCorreo = (c: string): string | null => {
  const v = c.trim();
  if (!v) return 'Escribe tu correo electrónico.';
  return REGEX_CORREO.test(v) ? null : 'Escribe un correo válido (ej. nombre@dominio.com).';
};

export const validarPassword = (p: string): string | null => {
  if (!p) return 'Escribe tu contraseña.';
  return p.length >= PASSWORD_MIN ? null : `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
};

export const validarConfirmacion = (p: string, confirmacion: string): string | null =>
  p === confirmacion ? null : 'Las contraseñas no coinciden.';

export const validarMatricula = (m: string): string | null => {
  const v = normalizarMatricula(m);
  if (!v) return 'Escribe tu matrícula UJAT.';
  if (!/^[A-Z0-9]{6,15}$/.test(v)) return 'La matrícula debe tener de 6 a 15 letras o números (ej. 222H17001).';
  return null;
};

export const validarNombre = (n: string): string | null => {
  const v = n.trim().replace(/\s+/g, ' ');
  if (v.length < 3) return 'Escribe tu nombre completo.';
  return v.includes(' ') ? null : 'Incluye nombre y apellido.';
};

export const validarTelefono = (t: string): string | null => {
  const digitos = t.replace(/\D/g, '');
  if (!digitos) return 'Escribe un teléfono de contacto.';
  return digitos.length >= 8 && digitos.length <= 15 ? null : 'Escribe un teléfono válido (mínimo 8 dígitos).';
};

export const validarTextoRequerido = (v: string, mensaje: string): string | null =>
  v.trim().length >= 2 ? null : mensaje;

export const limpiarNombre = (n: string): string => n.trim().replace(/\s+/g, ' ');

// ─────────────────────────────────────────────────────────────────────────────
// Redirección posterior al login
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿`ruta` es una ruta interna segura para redirigir? Evita open-redirects
 * (`//evil.com`, `https://…`, `javascript:`) y bucles hacia `/auth`.
 */
export const esRutaInternaSegura = (ruta: string | null | undefined): ruta is string => {
  if (!ruta) return false;
  if (!ruta.startsWith('/') || ruta.startsWith('//')) return false;
  if (/[\\\r\n\t]|:\/\//.test(ruta)) return false;
  if (ruta === '/auth' || ruta.startsWith('/auth/') || ruta.startsWith('/auth?')) return false;
  return true;
};

export const etiquetaRol = (rol: RolUsuario): string => ETIQUETA_ROL[rol];
