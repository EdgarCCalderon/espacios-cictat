/**
 * Capa de Dominio — Errores de autenticación.
 *
 * Cada fallo conocido tiene un `codigo` estable (la UI decide qué hacer con
 * él) y un `mensaje` en español listo para mostrar. `detalleTecnico` conserva
 * el message/details/hint/code original para fallos inesperados.
 */

export type CodigoErrorAuth =
  | 'validacion'
  | 'credenciales_invalidas'
  | 'correo_sin_confirmar'
  | 'usuario_existente'
  | 'password_debil'
  | 'registro_deshabilitado'
  | 'limite_solicitudes'
  | 'sin_conexion'
  | 'rol_no_coincide'
  | 'perfil_incompleto'
  | 'perfil_duplicado'
  | 'desconocido';

export class ErrorAuth extends Error {
  readonly codigo: CodigoErrorAuth;
  readonly detalleTecnico: string | null;
  /** Errores de validación por campo (nombre del campo → mensaje). */
  readonly campos: Record<string, string> | null;

  constructor(
    codigo: CodigoErrorAuth,
    mensaje: string,
    detalleTecnico: string | null = null,
    campos: Record<string, string> | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorAuth';
    this.codigo = codigo;
    this.detalleTecnico = detalleTecnico;
    this.campos = campos;
  }
}

/** Forma serializable que consume la UI. */
export interface ErrorAuthInfo {
  codigo: CodigoErrorAuth;
  mensaje: string;
  detalleTecnico: string | null;
  campos: Record<string, string> | null;
}

export const aErrorAuthInfo = (e: ErrorAuth): ErrorAuthInfo => ({
  codigo: e.codigo,
  mensaje: e.message,
  detalleTecnico: e.detalleTecnico,
  campos: e.campos,
});
