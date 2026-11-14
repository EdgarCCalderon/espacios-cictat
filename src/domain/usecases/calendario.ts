/**
 * Caso de uso — Matriz horaria del calendario de un espacio.
 *
 * Funciones puras (sin React ni Supabase) que cruzan los bloques de 1 hora de
 * la ventana operativa (08:00–15:00) con las solicitudes de un día y deciden
 * el estado de cada bloque.
 *
 * Reglas de negocio:
 *  - `aprobada`  → bloquea [hora_inicio, hora_fin) como OCUPADO y
 *                  [hora_fin, hora_fin_limpieza) como LIMPIEZA (por defecto +1 h).
 *  - `pendiente` → NO bloquea: se pueden enviar nuevas solicitudes sobre ese
 *                  horario, quedando sujetas a aprobación. Sólo se contabilizan.
 *  - Si una reserva aprobada termina a las 15:00, su limpieza proyecta un bloque
 *    extra 15:00–16:00 (informativo, no seleccionable).
 *  - Las reservas requieren al menos 24 h de anticipación.
 */
import type { ISODate, SolicitudReservaCalendario } from '../models';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de la ventana operativa
// ─────────────────────────────────────────────────────────────────────────────

export const VENTANA_INICIO_MIN = 8 * 60;
export const VENTANA_FIN_MIN = 15 * 60;
export const DURACION_BLOQUE_MIN = 60;
export const LIMPIEZA_POR_DEFECTO_MIN = 60;
export const ANTICIPACION_MINIMA_HORAS = 24;

export type EstadoBloque = 'libre' | 'pendiente' | 'ocupado' | 'limpieza';

export interface BloqueHorario {
  indice: number;
  inicioMin: number;
  finMin: number;
  /** "08:00 – 09:00" */
  etiqueta: string;
  estado: EstadoBloque;
  /** Solicitudes `pendiente` que se traslapan con el bloque. */
  pendientes: number;
  /** `false` para los bloques extra posteriores a las 15:00 (limpieza proyectada). */
  dentroDeVentana: boolean;
  /** `false` si el bloque inicia en menos de 24 h. */
  anticipacionSuficiente: boolean;
  /** Se puede elegir como parte de una nueva solicitud. */
  seleccionable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de hora
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un valor de hora a minutos desde la medianoche.
 * Acepta `time` ("10:00", "10:00:00", "10:00:00-06") y timestamps ISO
 * ("2026-11-20T10:00:00-06:00", interpretado en hora local del dispositivo).
 */
export const parseHoraAMinutos = (valor: string | null | undefined): number | null => {
  if (!valor) return null;
  const texto = valor.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:\s*(?:Z|[+-]\d{2}(?::?\d{2})?))?$/.exec(texto);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
};

const dos = (n: number) => String(n).padStart(2, '0');

/** 480 → "08:00" */
export const formatearMinutos = (min: number): string => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;

/** "08:00 – 09:00" */
export const formatearRango = (inicioMin: number, finMin: number): string =>
  `${formatearMinutos(inicioMin)} – ${formatearMinutos(finMin)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de fecha (SIEMPRE en hora local: toISOString() cambiaría el día
// después de las 18:00 en UTC-6)
// ─────────────────────────────────────────────────────────────────────────────

export const aFechaISOLocal = (d: Date): ISODate =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

/** "YYYY-MM-DD" → Date local a las 12:00 (evita saltos por horario de verano). */
export const desdeFechaISO = (iso: ISODate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
};

export const sumarDias = (iso: ISODate, dias: number): ISODate => {
  const d = desdeFechaISO(iso);
  d.setDate(d.getDate() + dias);
  return aFechaISOLocal(d);
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const nombreDia = (iso: ISODate, corto = false): string => {
  const n = DIAS[desdeFechaISO(iso).getDay()];
  return corto ? n.slice(0, 3) : n;
};

export const nombreMes = (iso: ISODate, corto = false): string => {
  const n = MESES[desdeFechaISO(iso).getMonth()];
  return corto ? n.slice(0, 3) : n;
};

/** "jueves 14 de noviembre de 2026" */
export const formatearFechaLarga = (iso: ISODate): string => {
  const d = desdeFechaISO(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Matriz horaria
// ─────────────────────────────────────────────────────────────────────────────

interface Intervalo {
  inicio: number;
  fin: number;
  limpiezaFin: number;
}

const normalizar = (r: SolicitudReservaCalendario): Intervalo | null => {
  const inicio = parseHoraAMinutos(r.hora_inicio);
  const fin = parseHoraAMinutos(r.hora_fin);
  if (inicio === null || fin === null || fin <= inicio) return null;
  const limpieza = parseHoraAMinutos(r.hora_fin_limpieza);
  const limpiezaFin = limpieza !== null && limpieza > fin ? limpieza : fin + LIMPIEZA_POR_DEFECTO_MIN;
  return { inicio, fin, limpiezaFin };
};

const traslapa = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && a1 > b0;

/** ¿Un bloque que inicia a `inicioMin` del día `fechaISO` cumple las 24 h de anticipación? */
export const cumpleAnticipacion = (fechaISO: ISODate, inicioMin: number, ahora: Date): boolean => {
  const d = desdeFechaISO(fechaISO);
  d.setHours(Math.floor(inicioMin / 60), inicioMin % 60, 0, 0);
  return d.getTime() - ahora.getTime() >= ANTICIPACION_MINIMA_HORAS * 3_600_000;
};

export const construirMatrizHoraria = (
  reservas: readonly SolicitudReservaCalendario[],
  fechaISO: ISODate,
  ahora: Date = new Date(),
): BloqueHorario[] => {
  const aprobadas: Intervalo[] = [];
  const pendientes: Intervalo[] = [];
  for (const r of reservas) {
    if (r.fecha_evento && r.fecha_evento !== fechaISO) continue;
    const intervalo = normalizar(r);
    if (!intervalo) continue;
    if (r.estado === 'aprobada') aprobadas.push(intervalo);
    else if (r.estado === 'pendiente') pendientes.push(intervalo);
  }

  // Hora final visible: 15:00, o más si una limpieza proyectada la rebasa (15:00–16:00).
  let finVisible = VENTANA_FIN_MIN;
  for (const a of aprobadas) {
    finVisible = Math.max(finVisible, Math.ceil(a.limpiezaFin / DURACION_BLOQUE_MIN) * DURACION_BLOQUE_MIN);
  }
  finVisible = Math.min(finVisible, 24 * 60);

  const bloques: BloqueHorario[] = [];
  for (let ini = VENTANA_INICIO_MIN, i = 0; ini < finVisible; ini += DURACION_BLOQUE_MIN, i++) {
    const fin = ini + DURACION_BLOQUE_MIN;

    const ocupado = aprobadas.some((a) => traslapa(ini, fin, a.inicio, a.fin));
    const enLimpieza = aprobadas.some((a) => traslapa(ini, fin, a.fin, a.limpiezaFin));
    const numPendientes = pendientes.filter((p) => traslapa(ini, fin, p.inicio, p.fin)).length;

    const estado: EstadoBloque = ocupado
      ? 'ocupado'
      : enLimpieza
        ? 'limpieza'
        : numPendientes > 0
          ? 'pendiente'
          : 'libre';

    const dentroDeVentana = fin <= VENTANA_FIN_MIN;
    const anticipacionSuficiente = cumpleAnticipacion(fechaISO, ini, ahora);

    bloques.push({
      indice: i,
      inicioMin: ini,
      finMin: fin,
      etiqueta: formatearRango(ini, fin),
      estado,
      pendientes: numPendientes,
      dentroDeVentana,
      anticipacionSuficiente,
      seleccionable:
        dentroDeVentana && anticipacionSuficiente && (estado === 'libre' || estado === 'pendiente'),
    });
  }
  return bloques;
};

// ─────────────────────────────────────────────────────────────────────────────
// Selección de rango contiguo
// ─────────────────────────────────────────────────────────────────────────────

export interface RangoSeleccion {
  desde: number;
  hasta: number;
}

/**
 * Siguiente selección al tocar el bloque `i`:
 *  - sin selección / bloque lejano → nueva selección de 1 bloque;
 *  - bloque adyacente seleccionable → extiende el rango;
 *  - extremo del rango → lo acorta (o lo limpia si sólo era 1 bloque).
 */
export const alternarBloque = (
  bloques: readonly BloqueHorario[],
  actual: RangoSeleccion | null,
  i: number,
): RangoSeleccion | null => {
  const b = bloques[i];
  if (!b?.seleccionable) return actual;
  if (!actual) return { desde: i, hasta: i };

  const { desde, hasta } = actual;
  if (i >= desde && i <= hasta) {
    if (desde === hasta) return null;
    if (i === desde) return { desde: desde + 1, hasta };
    if (i === hasta) return { desde, hasta: hasta - 1 };
    return { desde: i, hasta: i }; // toque en el interior: reinicia
  }
  if (i === hasta + 1 || i === desde - 1) {
    return { desde: Math.min(desde, i), hasta: Math.max(hasta, i) };
  }
  return { desde: i, hasta: i };
};

/** Un rango sigue siendo válido si todos sus bloques continúan seleccionables. */
export const rangoVigente = (bloques: readonly BloqueHorario[], r: RangoSeleccion | null): boolean => {
  if (!r) return true;
  for (let i = r.desde; i <= r.hasta; i++) if (!bloques[i]?.seleccionable) return false;
  return true;
};
