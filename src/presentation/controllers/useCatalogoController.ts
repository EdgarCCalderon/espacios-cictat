/**
 * Hook controlador — Catálogo digital de espacios (pantalla `app/index.tsx`).
 * Carga el catálogo, lo mantiene sincronizado vía Realtime y expone filtros.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Espacio } from '@/domain/models';
import type { EstadoEnVivo } from '@/domain/repositories';
import { filtrarCatalogo, ordenarParaCatalogo, type FiltroCatalogo } from '@/domain/usecases';
import { errorInfoDesde, type ErrorInfo } from '@/infrastructure/repositories';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { catalogoCalendarioController as controller } from './CatalogoCalendarioController';

/** Si Realtime falla, se refresca por polling cada tanto para no quedar desactualizado. */
const POLLING_FALLBACK_MS = 30_000;

type ModoCarga = 'inicial' | 'manual' | 'silencioso';

export function useCatalogoController() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [filtro, setFiltro] = useState<FiltroCatalogo>('todos');
  const [estadoVivo, setEstadoVivo] = useState<EstadoEnVivo>('conectando');
  const [detalleVivo, setDetalleVivo] = useState<string | null>(null);

  const cargar = useCallback(async (modo: ModoCarga = 'manual') => {
    if (modo === 'inicial') setCargando(true);
    if (modo === 'manual') setRefrescando(true);
    try {
      const data = await controller.obtenerEspaciosCatalogo();
      setEspacios(data);
      setError(null);
    } catch (err) {
      console.error('[Catálogo] Error al consultar espacios:', err);
      setError(errorInfoDesde('No se pudo cargar el catálogo de espacios', err));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  const recargarSilencioso = useDebouncedCallback(() => void cargar('silencioso'), 300);

  // Carga inicial
  useEffect(() => {
    void cargar('inicial');
  }, [cargar]);

  // Realtime: cambios en `espacios` (alta, mantenimiento, capacidad…)
  useEffect(() => {
    const cancelar = controller.suscribirCambiosEnVivo({
      tablas: ['espacios'],
      onCambio: recargarSilencioso,
      onEstado: (estado, detalle) => {
        setEstadoVivo(estado);
        setDetalleVivo(detalle ?? null);
      },
    });
    return cancelar;
  }, [recargarSilencioso]);

  // Respaldo: sólo si Realtime está caído
  useEffect(() => {
    if (estadoVivo !== 'error') return;
    const id = setInterval(() => void cargar('silencioso'), POLLING_FALLBACK_MS);
    return () => clearInterval(id);
  }, [estadoVivo, cargar]);

  const ordenados = useMemo(() => ordenarParaCatalogo(espacios), [espacios]);
  const visibles = useMemo(() => filtrarCatalogo(ordenados, filtro), [ordenados, filtro]);
  const conteos = useMemo(
    () => ({
      todos: ordenados.length,
      salas: filtrarCatalogo(ordenados, 'salas').length,
      cubiculos: filtrarCatalogo(ordenados, 'cubiculos').length,
    }),
    [ordenados],
  );

  return {
    espacios: visibles,
    conteos,
    filtro,
    setFiltro,
    cargando,
    refrescando,
    error,
    estadoVivo,
    detalleVivo,
    recargar: () => cargar('manual'),
  };
}
