/**
 * Caso de uso — Reglas de negocio puras del Panel de Administración (Fase 6).
 *
 * - Detección en memoria de colisiones entre solicitudes pendientes
 *   (`tieneColisionPendiente`, considerando el margen de +1h de limpieza).
 * - Construcción del `ReporteOcupacionDTO` (KPIs, ranking de espacios y
 *   distribución por rol de usuario).
 * - Formateo de folios cortos y fechas demo (>24h de anticipación).
 */
import {
  ETIQUETA_ROL,
  type DistribucionRolItem,
  type Espacio,
  type HistorialAuditoriaItem,
  type ISODate,
  type KpisReporteOcupacion,
  type ReporteOcupacionDTO,
  type RolSolicitanteReporte,
  type SolicitudAdminItem,
  type UsoEspacioItem,
  type UUID,
} from '../models';
import {
  LIMPIEZA_POR_DEFECTO_MIN,
  aFechaISOLocal,
  formatearMinutos,
  parseHoraAMinutos,
  sumarDias,
} from './calendario';

export type SolicitudAdminSinColision = Omit<
  SolicitudAdminItem,
  'tieneColisionPendiente' | 'colisionaConIds'
>;

const PREFIJO_RECHAZO_COLISION = '[RECHAZO AUTOMÁTICO POR COLISIÓN]';

/** Devuelve el minuto de fin efectivo incluyendo la hora de limpieza (+60 min). */
export const finConLimpiezaMinutos = (
  horaFin: string,
  horaFinLimpieza: string | null | undefined,
): number => {
  const finEvento = parseHoraAMinutos(horaFin) ?? 0;
  const finLimpieza = parseHoraAMinutos(horaFinLimpieza);
  if (finLimpieza !== null && finLimpieza > finEvento) return finLimpieza;
  return finEvento + LIMPIEZA_POR_DEFECTO_MIN;
};

/** Calcula la etiqueta de `hora_fin_limpieza` (ej. "11:00" → "12:00"). */
export const formatearHoraLimpieza = (
  horaFin: string,
  horaFinLimpieza: string | null | undefined,
): string => formatearMinutos(finConLimpiezaMinutos(horaFin, horaFinLimpieza));

/** Duración del evento en horas (sin contar la hora extra de limpieza). */
export const duracionEventoHoras = (horaInicio: string, horaFin: string): number => {
  const ini = parseHoraAMinutos(horaInicio);
  const fin = parseHoraAMinutos(horaFin);
  if (ini === null || fin === null || fin <= ini) return 0;
  return Number(((fin - ini) / 60).toFixed(2));
};

/**
 * Calcula en memoria para cada solicitud `pendiente` la bandera
 * `tieneColisionPendiente: boolean` indicando si existe otra solicitud
 * `pendiente` en el mismo `espacio_id` y `fecha_evento` cuyo rango
 * `[hora_inicio, hora_fin_limpieza]` se traslape.
 */
export const calcularColisionesPendientes = (
  solicitudes: readonly SolicitudAdminSinColision[],
): SolicitudAdminItem[] => {
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente');

  return solicitudes.map((actual) => {
    if (actual.estado !== 'pendiente') {
      return {
        ...actual,
        tieneColisionPendiente: false,
        colisionaConIds: [],
      };
    }

    const iniA = parseHoraAMinutos(actual.hora_inicio) ?? 0;
    const finA = finConLimpiezaMinutos(actual.hora_fin, actual.hora_fin_limpieza);

    const colisionaConIds: UUID[] = [];
    for (const otra of pendientes) {
      if (otra.id === actual.id) continue;
      if (otra.espacio_id !== actual.espacio_id || otra.fecha_evento !== actual.fecha_evento) {
        continue;
      }
      const iniB = parseHoraAMinutos(otra.hora_inicio) ?? 0;
      const finB = finConLimpiezaMinutos(otra.hora_fin, otra.hora_fin_limpieza);
      if (iniA < finB && iniB < finA) {
        colisionaConIds.push(otra.id);
      }
    }

    return {
      ...actual,
      tieneColisionPendiente: colisionaConIds.length > 0,
      colisionaConIds,
    };
  });
};

/** Detecta si una solicitud rechazada fue rechazada automáticamente por colisión. */
export const esRechazoAutomaticoPorColision = (
  solicitud: Pick<SolicitudAdminItem, 'id' | 'estado' | 'motivo_rechazo_cancelacion'>,
  historialPorSolicitud?: ReadonlySet<UUID>,
): boolean => {
  if (solicitud.estado !== 'rechazada') return false;
  if (historialPorSolicitud?.has(solicitud.id)) return true;
  const motivo = (solicitud.motivo_rechazo_cancelacion ?? '').toUpperCase();
  return (
    motivo.includes(PREFIJO_RECHAZO_COLISION) ||
    motivo.includes('RECHAZO AUTOMÁTICO') ||
    motivo.includes('RECHAZO AUTOMATICO') ||
    motivo.includes('COLISIÓN') ||
    motivo.includes('COLISION')
  );
};

/**
 * Construye el `ReporteOcupacionDTO` a partir de las solicitudes, espacios e
 * historial de auditoría dentro de `[fechaInicioISO, fechaFinISO]`.
 */
export const construirReporteOcupacion = (params: {
  fechaInicioISO: ISODate;
  fechaFinISO: ISODate;
  solicitudes: readonly SolicitudAdminItem[];
  espacios: readonly Espacio[];
  historial: readonly HistorialAuditoriaItem[];
}): ReporteOcupacionDTO => {
  const { fechaInicioISO, fechaFinISO, solicitudes, espacios, historial } = params;

  // Conjunto de solicitudes marcadas en historial con `es_rechazo_automatico_colision = true`
  const idsColisionHistorial = new Set<UUID>();
  for (const h of historial) {
    if (
      h.es_rechazo_automatico_colision ||
      (h.motivo_cambio ?? '').toUpperCase().includes(PREFIJO_RECHAZO_COLISION)
    ) {
      idsColisionHistorial.add(h.solicitud_id);
    }
  }

  // 1. KPIs Totales
  const kpis: KpisReporteOcupacion = {
    totalSolicitudes: solicitudes.length,
    aprobadas: 0,
    rechazadasManual: 0,
    rechazadasPorColisionAutomatica: 0,
    canceladas: 0,
    pendientes: 0,
  };

  for (const s of solicitudes) {
    switch (s.estado) {
      case 'aprobada':
        kpis.aprobadas += 1;
        break;
      case 'pendiente':
        kpis.pendientes += 1;
        break;
      case 'cancelada':
        kpis.canceladas += 1;
        break;
      case 'rechazada':
        if (esRechazoAutomaticoPorColision(s, idsColisionHistorial)) {
          kpis.rechazadasPorColisionAutomatica += 1;
        } else {
          kpis.rechazadasManual += 1;
        }
        break;
    }
  }

  // 2. Ranking de Uso por Espacio (Salas 1-6 y Cubículos 7-9)
  const usoInicial = espacios.map((esp) => {
    const delEspacio = solicitudes.filter((s) => s.espacio_id === esp.id);
    const aprobadasEsp = delEspacio.filter((s) => s.estado === 'aprobada');
    const horas = aprobadasEsp.reduce(
      (acc, s) => acc + duracionEventoHoras(s.hora_inicio, s.hora_fin),
      0,
    );

    return {
      espacioId: esp.id,
      codigoEspacio: esp.codigo_espacio,
      nombreEspacio: esp.nombre,
      tipoEspacio: esp.tipo_espacio,
      capacidad: esp.capacidad,
      estaActivo: esp.esta_activo,
      horasAprobadasOcupadas: Number(horas.toFixed(1)),
      numeroReservasAprobadas: aprobadasEsp.length,
      totalSolicitudesEspacio: delEspacio.length,
      porcentajeRelativo: 0,
    };
  });

  usoInicial.sort((a, b) => {
    if (b.horasAprobadasOcupadas !== a.horasAprobadasOcupadas) {
      return b.horasAprobadasOcupadas - a.horasAprobadasOcupadas;
    }
    if (b.numeroReservasAprobadas !== a.numeroReservasAprobadas) {
      return b.numeroReservasAprobadas - a.numeroReservasAprobadas;
    }
    if (b.totalSolicitudesEspacio !== a.totalSolicitudesEspacio) {
      return b.totalSolicitudesEspacio - a.totalSolicitudesEspacio;
    }
    return a.codigoEspacio.localeCompare(b.codigoEspacio);
  });

  const maxHoras = Math.max(0, ...usoInicial.map((u) => u.horasAprobadasOcupadas));
  const maxSolicitudes = Math.max(1, ...usoInicial.map((u) => u.totalSolicitudesEspacio));

  const rankingEspacios: UsoEspacioItem[] = usoInicial.map((item) => {
    const porcentaje =
      maxHoras > 0
        ? Math.round((item.horasAprobadasOcupadas / maxHoras) * 100)
        : Math.round((item.totalSolicitudesEspacio / maxSolicitudes) * 100);
    return {
      ...item,
      porcentajeRelativo: Math.min(100, Math.max(0, porcentaje)),
    };
  });

  // 3. Distribución por Tipo de Usuario (estudiante_posgrado, doctor_posgrado, publico_general)
  const conteoPorRol: Record<RolSolicitanteReporte, number> = {
    estudiante_posgrado: 0,
    doctor_posgrado: 0,
    publico_general: 0,
  };

  for (const s of solicitudes) {
    const rol = s.usuario?.rol;
    if (rol === 'estudiante_posgrado' || rol === 'doctor_posgrado' || rol === 'publico_general') {
      conteoPorRol[rol] += 1;
    } else {
      // Si una solicitud demo fue insertada bajo la cuenta del administrador, la clasificamos
      // según el tipo de espacio (cubículos → estudiante_posgrado; salas con tema docente/externo).
      if (s.espacio?.exclusivo_alumnos_posgrado) {
        conteoPorRol.estudiante_posgrado += 1;
      } else if (/doctor|seminario|coloquio|cuerpo acad/i.test(s.tema_evento)) {
        conteoPorRol.doctor_posgrado += 1;
      } else if (/externo|vinculaci|empresa/i.test(s.tema_evento)) {
        conteoPorRol.publico_general += 1;
      } else {
        conteoPorRol.estudiante_posgrado += 1;
      }
    }
  }

  const totalRoles =
    conteoPorRol.estudiante_posgrado +
    conteoPorRol.doctor_posgrado +
    conteoPorRol.publico_general;

  const rolesOrden: RolSolicitanteReporte[] = [
    'estudiante_posgrado',
    'doctor_posgrado',
    'publico_general',
  ];

  const distribucionPorRol: DistribucionRolItem[] = rolesOrden.map((rol) => {
    const conteo = conteoPorRol[rol];
    const porcentaje = totalRoles > 0 ? Math.round((conteo / totalRoles) * 100) : 0;
    return {
      rol,
      etiqueta: ETIQUETA_ROL[rol],
      conteo,
      porcentaje,
    };
  });

  return {
    fechaInicioISO,
    fechaFinISO,
    kpis,
    rankingEspacios,
    distribucionPorRol,
    bitacoraReciente: [...historial],
  };
};

/** Genera un folio corto legible a partir del UUID (ej. "#4F9A1C2B"). */
export const formatearFolioCorto = (id: UUID): string =>
  `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/** Fecha `mañana + 2 días` (hoy + 3 días) para cumplir holgadamente las >24h de anticipación. */
export const obtenerFechaDemoValidada = (ahora: Date = new Date()): ISODate =>
  sumarDias(aFechaISOLocal(ahora), 3);
