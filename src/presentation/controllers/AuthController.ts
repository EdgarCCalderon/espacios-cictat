/**
 * Presentación (Controlador MVC) — Autenticación.
 *
 * Orquesta Supabase Auth (vía `IAutenticacionGateway`) y la tabla
 * `perfiles_usuarios` (vía `IPerfilRepository`). No conoce React ni Supabase:
 * el hook `useAuthController` añade estado de UI y el refresco del AuthContext.
 *
 * Reglas clave:
 *  - NUNCA se modifica el `rol` de un perfil existente (sin escalada de privilegios).
 *  - Si el perfil existe y su rol no coincide con el acceso elegido, se cierra
 *    la sesión y se informa con claridad.
 *  - Si Supabase exige confirmar el correo, el perfil se crea en el primer
 *    inicio de sesión posterior, reconstruido desde `user_metadata`.
 */
import { ErrorAuth, aErrorAuthInfo, type ErrorAuthInfo } from '@/domain/errors/ErrorAuth';
import { ETIQUETA_ROL, type PerfilUsuario, type RolUsuario, type UUID } from '@/domain/models';
import type {
  IAutenticacionGateway,
  IPerfilRepository,
  MetadataRegistro,
  UsuarioAuth,
} from '@/domain/repositories';
import {
  DEPENDENCIA_COMUNIDAD_UJAT,
  esRolComunidadUJAT,
  limpiarNombre,
  normalizarCorreo,
  normalizarMatricula,
  resolverCorreoInstitucional,
  validarConfirmacion,
  validarCorreo,
  validarMatricula,
  validarNombre,
  validarPassword,
  validarTelefono,
  validarTextoRequerido,
  type RolComunidadUJAT,
} from '@/domain/usecases/autenticacion';
import { repositorios } from '@/infrastructure/repositories';
import { RepositorioError, describirError } from '@/infrastructure/supabase/supabaseError';

// ─────────────────────────────────────────────────────────────────────────────
// Entradas / salidas
// ─────────────────────────────────────────────────────────────────────────────

export interface EntradaUJAT {
  rol: RolComunidadUJAT;
  matricula: string;
  /** Opcional: si se omite (o sólo trae usuario sin "@") se autocompleta con el dominio UJAT. */
  correoInstitucional?: string;
  password: string;
  /** Obligatorio en "Primer ingreso". */
  nombreCompleto?: string;
  /** Modo "Primer ingreso / Activar matrícula": permite crear la cuenta. */
  primerIngreso?: boolean;
  /** Sólo se exige en primer ingreso (si se envía, debe coincidir con `password`). */
  confirmarPassword?: string;
}

export interface EntradaLoginExterno {
  correo: string;
  password: string;
}

export interface EntradaRegistroExterno {
  nombreCompleto: string;
  correo: string;
  telefono: string;
  dependenciaProcedencia: string;
  password: string;
  confirmarPassword?: string;
}

export interface EntradaAdmin {
  correo: string;
  password: string;
  /** "Registrar cuenta de Encargado (Modo Setup)". */
  crearCuentaInicial?: boolean;
  nombreCompleto?: string;
  confirmarPassword?: string;
}

export type ResultadoAuth =
  | { ok: true; estado: 'autenticado'; userId: UUID; perfil: PerfilUsuario; perfilCreado: boolean }
  | { ok: true; estado: 'confirmacion_pendiente'; mensaje: string }
  | { ok: false; error: ErrorAuthInfo };

export interface AuthControllerDeps {
  gateway: IAutenticacionGateway;
  perfiles: IPerfilRepository;
}

interface DatosPerfil {
  nombre?: string;
  matricula: string | null;
  telefono: string | null;
  dependencia: string | null;
}

type Campos = Record<string, string>;

const errorValidacion = (campos: Campos): ErrorAuth =>
  new ErrorAuth('validacion', 'Revisa los campos marcados.', null, campos);

/** Une validaciones: sólo conserva las que fallan. */
const recolectar = (pares: [string, string | null][]): Campos => {
  const out: Campos = {};
  for (const [campo, msg] of pares) if (msg) out[campo] = msg;
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────

export class AuthController {
  private readonly gateway: IAutenticacionGateway;
  private readonly perfiles: IPerfilRepository;

  constructor(deps: AuthControllerDeps) {
    this.gateway = deps.gateway;
    this.perfiles = deps.perfiles;
  }

  // ── 1. Comunidad UJAT (estudiante / doctor de posgrado) ─────────────────────

  autenticarComunidadUJAT(entrada: EntradaUJAT): Promise<ResultadoAuth> {
    return this.ejecutar(async () => {
      if (!esRolComunidadUJAT(entrada.rol)) {
        throw new ErrorAuth('validacion', 'Rol no válido para la comunidad UJAT.');
      }
      const esPrimerIngreso = Boolean(entrada.primerIngreso ?? entrada.nombreCompleto?.trim());
      const correo = resolverCorreoInstitucional(entrada.correoInstitucional, entrada.matricula, entrada.rol);
      const campos = recolectar([
        ['matricula', validarMatricula(entrada.matricula)],
        ['correo', validarCorreo(correo)],
        ['password', validarPassword(entrada.password)],
        ...(esPrimerIngreso
          ? ([
              ['nombreCompleto', validarNombre(entrada.nombreCompleto ?? '')],
              [
                'confirmarPassword',
                entrada.confirmarPassword === undefined
                  ? null
                  : validarConfirmacion(entrada.password, entrada.confirmarPassword),
              ],
            ] as [string, string | null][])
          : []),
      ]);
      if (Object.keys(campos).length > 0) throw errorValidacion(campos);

      const matricula = normalizarMatricula(entrada.matricula);
      const nombre = entrada.nombreCompleto ? limpiarNombre(entrada.nombreCompleto) : undefined;
      const metadata: MetadataRegistro = {
        nombre_completo: nombre ?? '',
        rol: entrada.rol,
        matricula,
        telefono: null,
        dependencia_procedencia: DEPENDENCIA_COMUNIDAD_UJAT,
      };

      const acceso = await this.autenticarOActivar(correo, entrada.password, metadata, {
        permitirRegistro: esPrimerIngreso,
        mensajeCredenciales:
          'Matrícula, correo o contraseña incorrectos. Si es tu primera vez, cambia a «Primer ingreso con mi Matrícula».',
      });
      if (acceso.pendiente) return this.pendienteDeConfirmacion(correo);

      return this.completarSesion(
        acceso.usuario,
        entrada.rol,
        correo,
        {
          nombre,
          matricula,
          telefono: null,
          dependencia: DEPENDENCIA_COMUNIDAD_UJAT,
        },
        'Tu cuenta no tiene perfil aún. Cambia a «Primer ingreso con mi Matrícula» para completar tus datos.',
      );
    });
  }

  // ── 2. Público General ──────────────────────────────────────────────────────

  iniciarSesionExterno(entrada: EntradaLoginExterno): Promise<ResultadoAuth> {
    return this.ejecutar(async () => {
      const campos = recolectar([
        ['correo', validarCorreo(entrada.correo)],
        ['password', validarPassword(entrada.password)],
      ]);
      if (Object.keys(campos).length > 0) throw errorValidacion(campos);

      const correo = normalizarCorreo(entrada.correo);
      const acceso = await this.autenticarOActivar(
        correo,
        entrada.password,
        { nombre_completo: '', rol: 'publico_general', matricula: null, telefono: null, dependencia_procedencia: null },
        {
          permitirRegistro: false,
          mensajeCredenciales: 'Correo o contraseña incorrectos. ¿Aún no tienes cuenta? Usa la pestaña «Crear Cuenta».',
        },
      );
      if (acceso.pendiente) return this.pendienteDeConfirmacion(correo);

      return this.completarSesion(
        acceso.usuario,
        'publico_general',
        correo,
        { matricula: null, telefono: null, dependencia: null },
        'Tu cuenta no tiene perfil aún. Regístrate desde la pestaña «Crear Cuenta» para completar tus datos.',
      );
    });
  }

  registrarExterno(entrada: EntradaRegistroExterno): Promise<ResultadoAuth> {
    return this.ejecutar(async () => {
      const campos = recolectar([
        ['nombreCompleto', validarNombre(entrada.nombreCompleto)],
        ['correo', validarCorreo(entrada.correo)],
        ['telefono', validarTelefono(entrada.telefono)],
        ['dependenciaProcedencia', validarTextoRequerido(entrada.dependenciaProcedencia, 'Indica tu institución o empresa de procedencia.')],
        ['password', validarPassword(entrada.password)],
        [
          'confirmarPassword',
          entrada.confirmarPassword === undefined
            ? null
            : validarConfirmacion(entrada.password, entrada.confirmarPassword),
        ],
      ]);
      if (Object.keys(campos).length > 0) throw errorValidacion(campos);

      const correo = normalizarCorreo(entrada.correo);
      const nombre = limpiarNombre(entrada.nombreCompleto);
      const telefono = entrada.telefono.trim();
      const dependencia = limpiarNombre(entrada.dependenciaProcedencia);

      const acceso = await this.autenticarOActivar(
        correo,
        entrada.password,
        {
          nombre_completo: nombre,
          rol: 'publico_general',
          matricula: null,
          telefono,
          dependencia_procedencia: dependencia,
        },
        { permitirRegistro: true, mensajeCredenciales: '' },
      );
      if (acceso.pendiente) return this.pendienteDeConfirmacion(correo);

      return this.completarSesion(
        acceso.usuario,
        'publico_general',
        correo,
        { nombre, matricula: null, telefono, dependencia },
        'No se pudo completar tu perfil.',
      );
    });
  }

  // ── 3. Administrador (Encargado CICTAT) ─────────────────────────────────────

  autenticarAdmin(entrada: EntradaAdmin): Promise<ResultadoAuth> {
    return this.ejecutar(async () => {
      const modoSetup = Boolean(entrada.crearCuentaInicial);
      const campos = recolectar([
        ['correo', validarCorreo(entrada.correo)],
        ['password', validarPassword(entrada.password)],
        ...(modoSetup
          ? ([
              ['nombreCompleto', validarNombre(entrada.nombreCompleto ?? '')],
              [
                'confirmarPassword',
                entrada.confirmarPassword === undefined
                  ? null
                  : validarConfirmacion(entrada.password, entrada.confirmarPassword),
              ],
            ] as [string, string | null][])
          : []),
      ]);
      if (Object.keys(campos).length > 0) throw errorValidacion(campos);

      const correo = normalizarCorreo(entrada.correo);
      const nombre = entrada.nombreCompleto ? limpiarNombre(entrada.nombreCompleto) : undefined;

      const acceso = await this.autenticarOActivar(
        correo,
        entrada.password,
        {
          nombre_completo: nombre ?? '',
          rol: 'administrador',
          matricula: null,
          telefono: null,
          dependencia_procedencia: DEPENDENCIA_COMUNIDAD_UJAT,
        },
        {
          permitirRegistro: modoSetup,
          mensajeCredenciales:
            'Correo o contraseña incorrectos. Si es la primera configuración, activa «Registrar cuenta de Encargado (Modo Setup)».',
        },
      );
      if (acceso.pendiente) return this.pendienteDeConfirmacion(correo);

      return this.completarSesion(
        acceso.usuario,
        'administrador',
        correo,
        { nombre, matricula: null, telefono: null, dependencia: DEPENDENCIA_COMUNIDAD_UJAT },
        'Esta cuenta no tiene perfil de administrador. Activa «Registrar cuenta de Encargado (Modo Setup)» para crearlo.',
      );
    });
  }

  // ── Cierre de sesión ────────────────────────────────────────────────────────

  async cerrarSesion(): Promise<{ ok: true } | { ok: false; error: ErrorAuthInfo }> {
    try {
      await this.gateway.cerrarSesion();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: this.aInfo(e) };
    }
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  /**
   * Intenta iniciar sesión; si Supabase responde "credenciales inválidas" (que
   * para Supabase significa "no existe" O "contraseña errónea") y se permite el
   * registro, intenta `signUp`. Si el correo ya existía, la causa era la contraseña.
   */
  private async autenticarOActivar(
    correo: string,
    password: string,
    metadata: MetadataRegistro,
    opciones: { permitirRegistro: boolean; mensajeCredenciales: string },
  ): Promise<{ pendiente: false; usuario: UsuarioAuth } | { pendiente: true }> {
    try {
      return { pendiente: false, usuario: await this.gateway.iniciarSesion(correo, password) };
    } catch (e) {
      if (!(e instanceof ErrorAuth) || e.codigo !== 'credenciales_invalidas') throw e;
      if (!opciones.permitirRegistro) {
        throw new ErrorAuth('credenciales_invalidas', opciones.mensajeCredenciales || e.message, e.detalleTecnico);
      }
    }

    try {
      const registro = await this.gateway.registrar(correo, password, metadata);
      if (!registro.sesionActiva) return { pendiente: true };
      return { pendiente: false, usuario: registro.usuario };
    } catch (e) {
      if (e instanceof ErrorAuth && e.codigo === 'usuario_existente') {
        throw new ErrorAuth(
          'usuario_existente',
          'Ya existe una cuenta con ese correo y la contraseña no coincide. Inicia sesión con tu contraseña actual.',
          e.detalleTecnico,
          { password: 'Contraseña incorrecta para una cuenta existente.' },
        );
      }
      throw e;
    }
  }

  /**
   * Con sesión ya activa: valida/crea la fila de `perfiles_usuarios`.
   * Si algo falla, cierra la sesión para no dejar un estado a medias.
   */
  private async completarSesion(
    usuario: UsuarioAuth,
    rolEsperado: RolUsuario,
    correo: string,
    datos: DatosPerfil,
    mensajeSinPerfil: string,
  ): Promise<ResultadoAuth> {
    try {
      const existente = await this.perfiles.obtenerPorId(usuario.id);

      if (existente) {
        if (existente.rol !== rolEsperado) {
          throw new ErrorAuth(
            'rol_no_coincide',
            `Esta cuenta está registrada como «${ETIQUETA_ROL[existente.rol]}», no como «${ETIQUETA_ROL[rolEsperado]}». Ingresa por el acceso que le corresponde.`,
          );
        }
        return { ok: true, estado: 'autenticado', userId: usuario.id, perfil: existente, perfilCreado: false };
      }

      // Sin perfil: se reconstruye con lo capturado o con el `user_metadata` del registro.
      const meta = usuario.metadata;
      const nombre = datos.nombre || meta.nombre_completo?.trim();
      if (!nombre) throw new ErrorAuth('perfil_incompleto', mensajeSinPerfil);

      const perfil = await this.perfiles.crear({
        id: usuario.id,
        nombre_completo: nombre,
        correo: usuario.correo ?? correo,
        rol: rolEsperado,
        matricula: datos.matricula ?? meta.matricula ?? null,
        telefono: datos.telefono ?? meta.telefono ?? null,
        dependencia_procedencia: datos.dependencia ?? meta.dependencia_procedencia ?? null,
      });
      return { ok: true, estado: 'autenticado', userId: usuario.id, perfil, perfilCreado: true };
    } catch (e) {
      await this.gateway.cerrarSesion().catch(() => undefined);
      throw e;
    }
  }

  private pendienteDeConfirmacion(correo: string): ResultadoAuth {
    return {
      ok: true,
      estado: 'confirmacion_pendiente',
      mensaje: `Cuenta creada. Te enviamos un correo de confirmación a ${correo}. Confírmalo y luego inicia sesión: tu perfil se completará automáticamente.`,
    };
  }

  private async ejecutar(fn: () => Promise<ResultadoAuth>): Promise<ResultadoAuth> {
    try {
      return await fn();
    } catch (e) {
      return { ok: false, error: this.aInfo(e) };
    }
  }

  /** Convierte cualquier excepción en `ErrorAuthInfo` (sin mensajes genéricos). */
  private aInfo(e: unknown): ErrorAuthInfo {
    if (e instanceof ErrorAuth) return aErrorAuthInfo(e);

    if (e instanceof RepositorioError) {
      if (e.code === '23505') {
        return aErrorAuthInfo(
          new ErrorAuth(
            'perfil_duplicado',
            'Ya existe un perfil con esa matrícula o correo. Si ya activaste tu cuenta, usa «Ya tengo cuenta activa».',
            e.json,
          ),
        );
      }
      const permisos = e.code === '42501' || e.status === 401 || e.status === 403;
      return aErrorAuthInfo(
        new ErrorAuth(
          'desconocido',
          permisos
            ? 'Tu cuenta se autenticó pero Supabase no permite crear/leer el perfil (políticas RLS de perfiles_usuarios).'
            : e.mensaje,
          e.json,
        ),
      );
    }

    const info = describirError('Autenticación', e, null);
    return aErrorAuthInfo(new ErrorAuth('desconocido', info.mensaje, info.json));
  }
}

/** Instancia única del controlador de autenticación conectada a los repositorios Supabase. */
export const authController = new AuthController({
  gateway: repositorios.autenticacion,
  perfiles: repositorios.perfiles,
});

