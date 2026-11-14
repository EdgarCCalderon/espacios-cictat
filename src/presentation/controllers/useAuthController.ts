/**
 * Hook de presentación — Conecta `AuthController` con `AuthContext` y Expo Router.
 *
 * Orquesta:
 *  - Estado de carga (`cargando`)
 *  - Error tipado (`error: ErrorAuthInfo | null`) y errores por campo
 *  - Mensaje cuando Supabase exige confirmación de correo (`mensajeConfirmacion`)
 *  - Refresco inmediato de `AuthContext` (`refreshPerfil()`) al autenticarse
 *  - Redirección inteligente tras iniciar sesión (`returnTo`, `espacioId`, `fecha` o `/`)
 */
import { type Href, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ErrorAuthInfo } from '@/domain/errors/ErrorAuth';
import { esRutaInternaSegura } from '@/domain/usecases/autenticacion';
import { useAuth } from '../context/AuthContext';
import {
  authController,
  type EntradaAdmin,
  type EntradaLoginExterno,
  type EntradaRegistroExterno,
  type EntradaUJAT,
  type ResultadoAuth,
} from './AuthController';

export interface ParametrosRedireccionAuth {
  returnTo?: string;
  espacioId?: string;
  fecha?: string;
}

export const normalizarParametro = (valor: string | string[] | undefined): string | undefined => {
  if (Array.isArray(valor)) return valor[0]?.trim() || undefined;
  return valor?.trim() || undefined;
};

export const useAuthController = (redireccion?: ParametrosRedireccionAuth) => {
  const router = useRouter();
  const { refreshPerfil } = useAuth();

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ErrorAuthInfo | null>(null);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);

  const limpiarMensajes = useCallback(() => {
    setError(null);
    setMensajeConfirmacion(null);
  }, []);

  const redirigirTrasLogin = useCallback(
    (override?: ParametrosRedireccionAuth) => {
      const returnTo = override?.returnTo ?? redireccion?.returnTo;
      const espacioId = override?.espacioId ?? redireccion?.espacioId;
      const fecha = override?.fecha ?? redireccion?.fecha;

      if (esRutaInternaSegura(returnTo)) {
        router.replace(returnTo as Href);
        return;
      }

      if (espacioId) {
        router.replace({
          pathname: '/espacio/[id]',
          params: fecha ? { id: espacioId, fecha } : { id: espacioId },
        });
        return;
      }

      router.replace('/');
    },
    [redireccion?.espacioId, redireccion?.fecha, redireccion?.returnTo, router],
  );

  const procesarResultado = useCallback(
    async (promesa: Promise<ResultadoAuth>): Promise<ResultadoAuth> => {
      setCargando(true);
      setError(null);
      setMensajeConfirmacion(null);
      try {
        const resultado = await promesa;
        if (!resultado.ok) {
          setError(resultado.error);
          return resultado;
        }
        if (resultado.estado === 'confirmacion_pendiente') {
          setMensajeConfirmacion(resultado.mensaje);
          return resultado;
        }
        await refreshPerfil();
        redirigirTrasLogin();
        return resultado;
      } finally {
        setCargando(false);
      }
    },
    [redirigirTrasLogin, refreshPerfil],
  );

  const autenticarComunidadUJAT = useCallback(
    (entrada: EntradaUJAT) => procesarResultado(authController.autenticarComunidadUJAT(entrada)),
    [procesarResultado],
  );

  const iniciarSesionExterno = useCallback(
    (entrada: EntradaLoginExterno) => procesarResultado(authController.iniciarSesionExterno(entrada)),
    [procesarResultado],
  );

  const registrarExterno = useCallback(
    (entrada: EntradaRegistroExterno) => procesarResultado(authController.registrarExterno(entrada)),
    [procesarResultado],
  );

  const autenticarAdmin = useCallback(
    (entrada: EntradaAdmin) => procesarResultado(authController.autenticarAdmin(entrada)),
    [procesarResultado],
  );

  const errorCampo = useCallback(
    (campo: string): string | null => error?.campos?.[campo] ?? null,
    [error],
  );

  return {
    cargando,
    error,
    mensajeConfirmacion,
    errorCampo,
    limpiarMensajes,
    autenticarComunidadUJAT,
    iniciarSesionExterno,
    registrarExterno,
    autenticarAdmin,
    redirigirTrasLogin,
  };
};
