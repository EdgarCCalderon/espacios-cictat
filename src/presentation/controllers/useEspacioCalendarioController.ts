/**
 * Hook controlador — Detalle de un espacio + calendario en tiempo real.
 * (pantalla `app/espacio/[id].tsx`)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Espacio, ISODate, SolicitudReservaCalendario } from '@/domain/models';
import type { EstadoEnVivo } from '@/domain/repositories';
import {
  aFechaISOLocal,
  alternarBloque,
  construirMatrizHoraria,
  formatearMinutos,
  rangoVigente,
  sumarDias,
  type RangoSeleccion,
} from '@/domain/usecases';
import { errorInfoDesde, type ErrorInfo } from '@/infrastructure/repositories';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { catalogoCalendarioController as controller } from './CatalogoCalendarioController';

const POLLING_FALLBACK_MS = 30_000;
/** Días mostrados en el selector de fecha (hoy + 29). */
export const DIAS_SELECTOR = 30;

export function useEspacioCalendarioController(espacioId: string | undefined) {
  // Fecha "hoy" estable durante la vida de la pantalla; se refresca con el reloj de abajo.
  const [ahora, setAhora] = useState(() => new Date());
  const hoyISO = aFechaISOLocal(ahora);

  const [espacio, setEspacio] = useState<Espacio | null>(null);
  const [cargandoEspacio, setCargandoEspacio] = useState(true);
  const [errorEspacio, setErrorEspacio] = useState<ErrorInfo | null>(null);

  const [fechaISO, setFechaISO] = useState<ISODate>(() => sumarDias(aFechaISOLocal(new Date()), 1));
  const [reservas, setReservas] = useState<SolicitudReservaCalendario[]>([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);
  const [errorReservas, setErrorReservas] = useState<ErrorInfo | null>(null);

  const [seleccion, setSeleccion] = useState<RangoSeleccion | null>(null);
  const [avisoSeleccion, setAvisoSeleccion] = useState<string | null>(null);

  const [estadoVivo, setEstadoVivo] = useState<EstadoEnVivo>('conectando');
  const [detalleVivo, setDetalleVivo] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  // Reloj: refresca "ahora" cada minuto (la regla de 24 h depende de la hora actual).
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Carga del espacio ──────────────────────────────────────────────────────
  const cargarEspacio = useCallback(
    async (silencioso = false) => {
      if (!espacioId) return;
      if (!silencioso) setCargandoEspacio(true);
      try {
        setEspacio(await controller.obtenerEspacioPorId(espacioId));
        setErrorEspacio(null);
      } catch (err) {
        console.error('[Espacio] Error al consultar el espacio:', err);
        setErrorEspacio(errorInfoDesde('No se pudo cargar el espacio', err));
      } finally {
        setCargandoEspacio(false);
      }
    },
    [espacioId],
  );

  // ── Carga de reservas (espacio + fecha) ────────────────────────────────────
  const reqRef = useRef(0);
  const cargarReservas = useCallback(
    async (silencioso = false) => {
      if (!espacioId) return;
      const id = ++reqRef.current;
      if (!silencioso) setCargandoReservas(true);
      try {
        const data = await controller.obtenerReservasPorEspacioYFecha(espacioId, fechaISO);
        if (id !== reqRef.current) return; // respuesta obsoleta (cambió la fecha)
        setReservas(data);
        setErrorReservas(null);
        setUltimaActualizacion(new Date());
      } catch (err) {
        if (id !== reqRef.current) return;
        console.error('[Calendario] Error al consultar reservas:', err);
        setErrorReservas(errorInfoDesde('No se pudo cargar el calendario de reservas', err));
      } finally {
        if (id === reqRef.current) setCargandoReservas(false);
      }
    },
    [espacioId, fechaISO],
  );

  useEffect(() => {
    void cargarEspacio();
  }, [cargarEspacio]);

  useEffect(() => {
    setSeleccion(null);
    setAvisoSeleccion(null);
    setReservas([]);
    void cargarReservas();
  }, [cargarReservas]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  const recargarEspacio = useDebouncedCallback(() => void cargarEspacio(true), 300);
  const recargarReservas = useDebouncedCallback(() => void cargarReservas(true), 300);

  useEffect(() => {
    if (!espacioId) return;
    return controller.suscribirCambiosEnVivo({
      tablas: ['solicitudes_reservas', 'espacios'],
      espacioId,
      onCambio: (c) => (c.tabla === 'espacios' ? recargarEspacio() : recargarReservas()),
      onEstado: (estado, detalle) => {
        setEstadoVivo(estado);
        setDetalleVivo(detalle ?? null);
        // Al (re)conectar se pudo perder algún evento: sincroniza.
        if (estado === 'en_vivo') recargarReservas();
      },
    });
  }, [espacioId, recargarEspacio, recargarReservas]);

  useEffect(() => {
    if (estadoVivo !== 'error') return;
    const id = setInterval(() => {
      void cargarReservas(true);
      void cargarEspacio(true);
    }, POLLING_FALLBACK_MS);
    return () => clearInterval(id);
  }, [estadoVivo, cargarReservas, cargarEspacio]);

  // ── Matriz y selección ─────────────────────────────────────────────────────
  const bloques = useMemo(
    () => construirMatrizHoraria(reservas, fechaISO, ahora),
    [reservas, fechaISO, ahora],
  );

  // Si un bloque elegido deja de estar disponible (otro usuario lo ocupó), se descarta.
  useEffect(() => {
    if (!rangoVigente(bloques, seleccion)) {
      setSeleccion(null);
      setAvisoSeleccion('El horario que habías elegido acaba de ocuparse. Elige otro bloque.');
    }
  }, [bloques, seleccion]);

  const alternar = useCallback(
    (indice: number) => {
      setAvisoSeleccion(null);
      setSeleccion((actual) => alternarBloque(bloques, actual, indice));
    },
    [bloques],
  );

  const limpiarSeleccion = useCallback(() => {
    setSeleccion(null);
    setAvisoSeleccion(null);
  }, []);

  const resumenSeleccion = useMemo(() => {
    if (!seleccion) return null;
    const elegidos = bloques.slice(seleccion.desde, seleccion.hasta + 1);
    if (elegidos.length === 0) return null;
    const inicioMin = elegidos[0].inicioMin;
    const finMin = elegidos[elegidos.length - 1].finMin;
    return {
      inicioMin,
      finMin,
      etiqueta: `${formatearMinutos(inicioMin)} – ${formatearMinutos(finMin)}`,
      horas: elegidos.length,
      bloquesConPendientes: elegidos.filter((b) => b.estado === 'pendiente').length,
      maxPendientes: Math.max(0, ...elegidos.map((b) => b.pendientes)),
    };
  }, [bloques, seleccion]);

  const hayBloquesReservables = bloques.some((b) => b.dentroDeVentana && b.anticipacionSuficiente);

  const dias = useMemo(
    () => Array.from({ length: DIAS_SELECTOR }, (_, i) => sumarDias(hoyISO, i)),
    [hoyISO],
  );

  return {
    espacio,
    cargandoEspacio,
    errorEspacio,
    fechaISO,
    setFechaISO,
    dias,
    hoyISO,
    bloques,
    cargandoReservas,
    errorReservas,
    hayBloquesReservables,
    seleccion,
    resumenSeleccion,
    avisoSeleccion,
    alternar,
    limpiarSeleccion,
    estadoVivo,
    detalleVivo,
    ultimaActualizacion,
    recargar: () => {
      void cargarEspacio();
      void cargarReservas();
    },
  };
}
