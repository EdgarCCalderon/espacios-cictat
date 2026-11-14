/**
 * Presentación — Estado global de autenticación.
 *
 * Escucha la sesión de Supabase Auth y carga automáticamente el registro de
 * `perfiles_usuarios` asociado al usuario autenticado.
 */
import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { PerfilUsuario } from '@/domain/models';
import { repositorios } from '@/infrastructure/repositories';
import { isSupabaseConfigured, supabase } from '@/infrastructure/supabase/supabaseClient';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  perfil: PerfilUsuario | null;
  /** `true` mientras se resuelve la sesión inicial o se carga el perfil. */
  isLoading: boolean;
  /** Último error al cargar el perfil (p. ej. RLS o tabla inexistente). */
  perfilError: string | null;
  isAuthenticated: boolean;
  /** Rol `estudiante_posgrado` (los administradores también acceden a espacios exclusivos: ver `puedeAccederAEspacio`). */
  isEstudiantePosgrado: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isPerfilLoading, setIsPerfilLoading] = useState(false);
  const requestRef = useRef(0);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // 1) Sesión inicial + suscripción a cambios de autenticación.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsSessionLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch((err: unknown) => console.warn('[Auth] getSession falló:', err))
      .finally(() => {
        if (mounted) setIsSessionLoading(false);
      });

    // Importante: no ejecutar llamadas async a Supabase dentro del callback
    // (puede bloquear el lock interno de auth). Sólo se actualiza el estado;
    // la carga del perfil ocurre en el efecto dependiente de `userId`.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setIsSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // 2) Carga del perfil cada vez que cambia el usuario autenticado.
  const loadPerfil = useCallback(async (id: string | null) => {
    const requestId = ++requestRef.current;

    if (!id) {
      setPerfil(null);
      setPerfilError(null);
      setIsPerfilLoading(false);
      return;
    }

    setIsPerfilLoading(true);
    try {
      const data = await repositorios.perfiles.obtenerPorId(id);
      if (requestId !== requestRef.current) return; // respuesta obsoleta
      setPerfil(data);
      setPerfilError(data ? null : 'El usuario no tiene registro en perfiles_usuarios.');
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setPerfil(null);
      setPerfilError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === requestRef.current) setIsPerfilLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPerfil(userId);
  }, [userId, loadPerfil]);

  const refreshPerfil = useCallback(async () => {
    let targetUserId = userId;
    if (!targetUserId && isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        targetUserId = data.session.user.id;
      }
    }
    await loadPerfil(targetUserId);
  }, [loadPerfil, userId]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error && !/session.*missing|not authenticated/i.test(error.message)) {
      throw new Error(`No se pudo cerrar sesión: ${error.message}`);
    }
    setSession(null);
    setPerfil(null);
    setPerfilError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const rol = perfil?.rol;
    return {
      user,
      session,
      perfil,
      isLoading: isSessionLoading || isPerfilLoading,
      perfilError,
      isAuthenticated: !!user,
      isEstudiantePosgrado: rol === 'estudiante_posgrado',
      isAdmin: rol === 'administrador',
      signOut,
      refreshPerfil,
    };
  }, [user, session, perfil, isSessionLoading, isPerfilLoading, perfilError, signOut, refreshPerfil]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Hook de acceso al contexto de autenticación. */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
};
