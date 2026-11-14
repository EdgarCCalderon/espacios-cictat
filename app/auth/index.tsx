/**
 * /auth → redirige al selector de acceso preservando parámetros de redirección.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { normalizarParametro } from '@/presentation/controllers/useAuthController';

export default function AuthIndex() {
  const raw = useLocalSearchParams<{ returnTo?: string; espacioId?: string; fecha?: string }>();
  const params: Record<string, string> = {};
  const returnTo = normalizarParametro(raw.returnTo);
  const espacioId = normalizarParametro(raw.espacioId);
  const fecha = normalizarParametro(raw.fecha);

  if (returnTo) params.returnTo = returnTo;
  if (espacioId) params.espacioId = espacioId;
  if (fecha) params.fecha = fecha;

  return <Redirect href={{ pathname: '/auth/selector', params }} />;
}
