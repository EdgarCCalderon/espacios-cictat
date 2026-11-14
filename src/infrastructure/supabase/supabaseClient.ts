/**
 * Infraestructura — Cliente singleton de Supabase.
 *
 * Compatible con Expo Web (incluido el renderizado estático/SSR de Expo
 * Router, donde `window` no existe) y con iOS/Android (AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
/** `true` durante el pre-renderizado estático en Node (expo export / SSR). */
const isServer = isWeb && typeof window === 'undefined';

// En nativo, `URL`/`URLSearchParams` de Hermes están incompletos para supabase-js.
// En web se usa la implementación nativa del navegador (no se debe sobrescribir).
if (!isWeb) {
  require('react-native-url-polyfill/auto');
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** URL a la que se conecta el cliente (para diagnóstico en UI). */
export const supabaseUrl = SUPABASE_URL;

/** Versión enmascarada de la URL/llave, segura para mostrar en consola/UI. */
export const supabaseDiagnostico = {
  url: SUPABASE_URL || '(vacía → usando placeholder)',
  keyPrefix: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 15) + '…' : '(vacía)',
  keyLength: SUPABASE_ANON_KEY.length,
  keyFormat: SUPABASE_ANON_KEY.startsWith('sb_publishable_')
    ? 'sb_publishable'
    : SUPABASE_ANON_KEY.startsWith('eyJ')
      ? 'jwt_legacy_anon'
      : SUPABASE_ANON_KEY
        ? 'desconocido'
        : 'vacía',
};

if (!isServer) {
  console.log('[Espacios CICTAT] Supabase →', supabaseDiagnostico);
}

/** Indica si las variables de entorno fueron configuradas (ver `.env.example`). */
export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

if (!isSupabaseConfigured && !isServer) {
  console.warn(
    '[Espacios CICTAT] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y reinicia Metro (npx expo start -c).',
  );
}

/** Almacenamiento no-op para el entorno de servidor (sin window ni localStorage). */
const memoryStorage = {
  getItem: (_key: string) => Promise.resolve<string | null>(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
};

const resolveStorage = () => {
  if (!isWeb) return AsyncStorage;
  if (isServer) return memoryStorage;
  return window.localStorage;
};

let client: SupabaseClient | undefined;

const createSupabaseClient = (): SupabaseClient =>
  createClient(
    // Valores de reserva para que la app no truene al importar sin .env;
    // las peticiones fallarán con un error controlado y la UI lo mostrará.
    SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
    {
      auth: {
        storage: resolveStorage(),
        autoRefreshToken: !isServer,
        persistSession: !isServer,
        // Sólo en web se procesan tokens en la URL (magic link / OAuth redirect).
        detectSessionInUrl: isWeb && !isServer,
      },
    },
  );

/** Obtiene (o crea perezosamente) la instancia única del cliente. */
export const getSupabaseClient = (): SupabaseClient => {
  if (!client) client = createSupabaseClient();
  return client;
};

export const supabase = getSupabaseClient();

// En móvil, el refresco automático del token sólo debe correr con la app en
// primer plano (recomendación oficial de Supabase para React Native).
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
