/**
 * Hook de presentación — Estado reactivo y suscripción Realtime para el Panel
 * de Administración (Fase 6).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Espacio,
  EstadoDictamen,
  EstadoSolicitud,
  ISODate,
  ReporteOcupacionDTO,
  SolicitudAdminItem,
  UUID,
} from '@/domain/models';
import type { EstadoEnVivo } from '@/domain/repositories';
import { aFechaISOLocal, sumarDias } from '@/domain/usecases/calendario';
import {
  errorInfoDesde,
  repositorios,
  type ErrorInfo,
} from '@/infrastructure/repositories';
import { useAuth } from '../context/AuthContext';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { panelAdminController } from './PanelAdminController';

export type VistaPanelAdmin = 'bandeja' | 'calendario' | 'espacios' | 'reportes';
export type FiltroEstadoBandeja = EstadoSolicitud | 'todas';

export interface ConteosBandejaAdmin {
  todas: number;
  pendiente: number;
  aprobada: number;
  rechazada: number;
  cancelada: number;
  colisionesPendientes: number;
}

export const usePanelAdminController = () => {
  const { user } = useAuth();
  const adminId = user?.id ?? '';

  const hoyISO = useMemo(() => aFechaISOLocal(new Date()), []);
  const [vistaActiva, setVistaActiva] = useState<VistaPanelAdmin>('bandeja');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoBandeja>('pendiente');

  // Datos principales
  const [solicitudes, setSolicitudes] = useState<SolicitudAdminItem[]>([]);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [reporte, setReporte] = useState<ReporteOcupacionDTO | null>(null);

  // Rango de fechas del reporte (por defecto: hace 15 días hasta hoy + 15 días para cubrir demos futuras)
  const [fechaInicioReporte, setFechaInicioReporte] = useState<ISODate>(() =>
    sumarDias(hoyISO, -15),
  );
  const [fechaFinReporte, setFechaFinReporte] = useState<ISODate>(() =>
    sumarDias(hoyISO, 15),
  );

  // Fecha seleccionada en el Calendario Maestro (por defecto: hoy + 1 día)
  const [fechaCalendarioMaestro, setFechaCalendarioMaestro] = useState<ISODate>(() =>
    sumarDias(hoyISO, 1),
  );

  // Estados de carga / feedback
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [generandoDemo, setGenerandoDemo] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Estado Realtime
  const [estadoVivo, setEstadoVivo] = useState<EstadoEnVivo>('conectando');
  const [detalleVivo, setDetalleVivo] = useState<string | undefined>(undefined);

  const reqRef = useRef(0);

  const cargarTodo = useCallback(
    async (modo: 'inicial' | 'refresco' | 'silencioso' = 'silencioso') => {
      const reqId = ++reqRef.current;
      if (modo === 'inicial') setCargando(true);
      if (modo === 'refresco') setRefrescando(true);
      if (modo !== 'silencioso') setError(null);

      try {
        const [listaSolicitudes, listaEspacios, dtoReporte] = await Promise.all([
          panelAdminController.listarSolicitudesAdmin(),
          panelAdminController.listarEspaciosAdmin(),
          panelAdminController.generarReporteOcupacion(fechaInicioReporte, fechaFinReporte),
        ]);

        if (reqId !== reqRef.current) return;
        setSolicitudes(listaSolicitudes);
        setEspacios(listaEspacios);
        setReporte(dtoReporte);
        setError(null);
      } catch (e) {
        if (reqId !== reqRef.current) return;
        setError(errorInfoDesde('Panel de Administración', e));
      } finally {
        if (reqId === reqRef.current) {
          setCargando(false);
          setRefrescando(false);
        }
      }
    },
    [fechaFinReporte, fechaInicioReporte],
  );

  useEffect(() => {
    void cargarTodo('inicial');
  }, [cargarTodo]);

  // Suscripción en tiempo real a `solicitudes_reservas` y `espacios`
  const recargarDebounced = useDebouncedCallback(() => {
    void cargarTodo('silencioso');
  }, 300);

  useEffect(() => {
    const cancelar = repositorios.cambiosEnVivo.suscribir({
      tablas: ['solicitudes_reservas', 'espacios'],
      onCambio: () => recargarDebounced(),
      onEstado: (st, det) => {
        setEstadoVivo(st);
        setDetalleVivo(det);
      },
    });
    return cancelar;
  }, [recargarDebounced]);

  // Solicitudes filtradas según el tab de la Bandeja
  const solicitudesFiltradas = useMemo(() => {
    if (filtroEstado === 'todas') return solicitudes;
    return solicitudes.filter((s) => s.estado === filtroEstado);
  }, [filtroEstado, solicitudes]);

  // Conteos para badges de la Bandeja y Sidebar
  const conteos = useMemo<ConteosBandejaAdmin>(() => {
    const out: ConteosBandejaAdmin = {
      todas: solicitudes.length,
      pendiente: 0,
      aprobada: 0,
      rechazada: 0,
      cancelada: 0,
      colisionesPendientes: 0,
    };
    for (const s of solicitudes) {
      out[s.estado] += 1;
      if (s.tieneColisionPendiente) out.colisionesPendientes += 1;
    }
    return out;
  }, [solicitudes]);

  // ── Acciones ────────────────────────────────────────────────────────────────

  const dictaminarSolicitud = useCallback(
    async (solicitudId: UUID, nuevoEstado: EstadoDictamen, motivo?: string): Promise<boolean> => {
      if (!adminId) {
        setError(
          errorInfoDesde(
            'Dictamen',
            new Error('Debes iniciar sesión como Administrador para dictaminar solicitudes.'),
          ),
        );
        return false;
      }

      setProcesandoId(solicitudId);
      setError(null);
      try {
        const res = await panelAdminController.dictaminarSolicitud(
          solicitudId,
          adminId,
          nuevoEstado,
          motivo,
        );
        setSolicitudes(res.solicitudesRecargadas);

        const dto = await panelAdminController.generarReporteOcupacion(
          fechaInicioReporte,
          fechaFinReporte,
        );
        setReporte(dto);

        const msg =
          nuevoEstado === 'aprobada'
            ? 'Reserva aprobada (+1h de limpieza bloqueada y solicitudes en colisión actualizadas).'
            : nuevoEstado === 'rechazada'
              ? 'Solicitud rechazada correctamente.'
              : 'Reserva cancelada correctamente.';
        setMensajeExito(msg);
        return true;
      } catch (e) {
        setError(errorInfoDesde('Dictaminar solicitud', e));
        return false;
      } finally {
        setProcesandoId(null);
      }
    },
    [adminId, fechaFinReporte, fechaInicioReporte],
  );

  const generarDatosDemo = useCallback(async (): Promise<boolean> => {
    if (!adminId) {
      setError(
        errorInfoDesde(
          'Datos Demo',
          new Error('Inicia sesión como Administrador para insertar las solicitudes de prueba.'),
        ),
      );
      return false;
    }

    setGenerandoDemo(true);
    setError(null);
    try {
      const res = await panelAdminController.generarDatosDemoParaPruebas(adminId);
      setFiltroEstado('pendiente');
      setFechaCalendarioMaestro(res.fechaDemoISO);
      await cargarTodo('silencioso');
      setMensajeExito(
        `Se crearon 3 solicitudes demo para el ${res.fechaDemoISO} (2 en colisión en ${res.salaColisionNombre}).`,
      );
      return true;
    } catch (e) {
      setError(errorInfoDesde('Generar solicitudes demo', e));
      return false;
    } finally {
      setGenerandoDemo(false);
    }
  }, [adminId, cargarTodo]);

  const toggleEstadoEspacio = useCallback(
    async (espacioId: UUID, estaActivo: boolean): Promise<boolean> => {
      setProcesandoId(espacioId);
      setError(null);
      try {
        const actualizado = await panelAdminController.toggleEstadoEspacio(espacioId, estaActivo);
        setEspacios((prev) => prev.map((e) => (e.id === espacioId ? actualizado : e)));
        setMensajeExito(
          `${actualizado.nombre}: ${
            actualizado.esta_activo ? 'Habilitado (Disponible)' : 'Puesto en Mantenimiento'
          }.`,
        );
        return true;
      } catch (e) {
        setError(errorInfoDesde('Cambiar estado del espacio', e));
        return false;
      } finally {
        setProcesandoId(null);
      }
    },
    [],
  );

  const actualizarEspacioCatalogo = useCallback(
    async (espacioId: UUID, datos: Partial<Espacio>): Promise<boolean> => {
      setProcesandoId(espacioId);
      setError(null);
      try {
        const actualizado = await panelAdminController.actualizarEspacioCatalogo(espacioId, datos);
        setEspacios((prev) => prev.map((e) => (e.id === espacioId ? actualizado : e)));
        setMensajeExito(`Se actualizaron los datos de ${actualizado.nombre}.`);
        return true;
      } catch (e) {
        setError(errorInfoDesde('Actualizar espacio', e));
        return false;
      } finally {
        setProcesandoId(null);
      }
    },
    [],
  );

  const actualizarRangoReporte = useCallback(
    async (inicioISO: ISODate, finISO: ISODate) => {
      setFechaInicioReporte(inicioISO);
      setFechaFinReporte(finISO);
      try {
        const dto = await panelAdminController.generarReporteOcupacion(inicioISO, finISO);
        setReporte(dto);
      } catch (e) {
        setError(errorInfoDesde('Reporte de ocupación', e));
      }
    },
    [],
  );

  const obtenerUrlDocumento = useCallback(
    (storagePath: string) => panelAdminController.obtenerUrlDocumento(storagePath),
    [],
  );

  return {
    vistaActiva,
    setVistaActiva,
    filtroEstado,
    setFiltroEstado,
    solicitudes,
    solicitudesFiltradas,
    conteos,
    espacios,
    reporte,
    fechaInicioReporte,
    fechaFinReporte,
    actualizarRangoReporte,
    fechaCalendarioMaestro,
    setFechaCalendarioMaestro,
    cargando,
    refrescando,
    procesandoId,
    generandoDemo,
    error,
    limpiarError: () => setError(null),
    mensajeExito,
    limpiarMensajeExito: () => setMensajeExito(null),
    estadoVivo,
    detalleVivo,
    recargar: () => cargarTodo('refresco'),
    dictaminarSolicitud,
    generarDatosDemo,
    toggleEstadoEspacio,
    actualizarEspacioCatalogo,
    obtenerUrlDocumento,
  };
};
