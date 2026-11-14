/**
 * Presentación (Controlador MVC) — Panel de Administración y Control (Fase 6).
 *
 * Orquesta los repositorios de `solicitudes_reservas`, `espacios`,
 * `documentos_solicitud` e `historial_estados_solicitud` con las reglas puras
 * de dominio (`calcularColisionesPendientes`, `construirReporteOcupacion`).
 *
 * Manejo de errores: todas las operaciones de repositorio propagan
 * `RepositorioError` con `message`, `details`, `hint` y `code` reales de
 * PostgREST, sin ocultar nunca la causa.
 */
import type {
  Espacio,
  EstadoDictamen,
  EstadoSolicitud,
  HistorialAuditoriaItem,
  ISODate,
  NuevoDocumentoSolicitud,
  ReporteOcupacionDTO,
  SolicitudAdminItem,
  SolicitudReserva,
  UUID,
} from '@/domain/models';
import type {
  IDocumentoSolicitudRepository,
  IEspacioRepository,
  IHistorialSolicitudRepository,
  ISolicitudReservaRepository,
} from '@/domain/repositories';
import {
  calcularColisionesPendientes,
  construirReporteOcupacion,
  obtenerFechaDemoValidada,
} from '@/domain/usecases/panelAdmin';
import { repositorios } from '@/infrastructure/repositories';

export interface PanelAdminControllerDeps {
  solicitudes: ISolicitudReservaRepository;
  espacios: IEspacioRepository;
  documentos: IDocumentoSolicitudRepository;
  historial: IHistorialSolicitudRepository;
}

export interface ResultadoDictamenAdmin {
  solicitudActualizada: SolicitudReserva;
  solicitudesRecargadas: SolicitudAdminItem[];
}

export interface ResultadoDemoAdmin {
  creadas: SolicitudReserva[];
  fechaDemoISO: ISODate;
  salaColisionNombre: string;
}

export class PanelAdminController {
  private readonly solicitudes: ISolicitudReservaRepository;
  private readonly espacios: IEspacioRepository;
  private readonly documentos: IDocumentoSolicitudRepository;
  private readonly historial: IHistorialSolicitudRepository;

  constructor(deps: PanelAdminControllerDeps) {
    this.solicitudes = deps.solicitudes;
    this.espacios = deps.espacios;
    this.documentos = deps.documentos;
    this.historial = deps.historial;
  }

  // ── 1. Bandeja de solicitudes con detección de colisiones en memoria ────────

  async listarSolicitudesAdmin(filtroEstado?: EstadoSolicitud): Promise<SolicitudAdminItem[]> {
    const filas = await this.solicitudes.listarParaAdmin(filtroEstado);
    return calcularColisionesPendientes(filas);
  }

  // ── 2. Dictamen (aprobar / rechazar / cancelar) + recarga post-trigger ─────

  async dictaminarSolicitud(
    solicitudId: UUID,
    adminId: UUID,
    nuevoEstado: EstadoDictamen,
    motivo?: string,
  ): Promise<ResultadoDictamenAdmin> {
    if (!solicitudId.trim()) {
      throw new Error('Falta el identificador de la solicitud a dictaminar.');
    }
    if (!adminId.trim()) {
      throw new Error('No se identificó la sesión del administrador.');
    }

    const motivoLimpio = motivo?.trim() ? motivo.trim() : null;
    if ((nuevoEstado === 'rechazada' || nuevoEstado === 'cancelada') && !motivoLimpio) {
      throw new Error(
        nuevoEstado === 'rechazada'
          ? 'Escribe el motivo del rechazo antes de confirmar.'
          : 'Escribe el motivo de la cancelación antes de confirmar.',
      );
    }

    const solicitudActualizada = await this.solicitudes.dictaminar({
      solicitudId,
      adminId,
      nuevoEstado,
      motivo: motivoLimpio,
      fechaDictamenISO: new Date().toISOString(),
    });

    // Al pasar a 'aprobada', el trigger SQL `trg_after_solicitud_reserva` en
    // Supabase bloquea hasta `hora_fin_limpieza` (+1h) y rechaza en cascada las
    // solicitudes pendientes en colisión. Recargamos de inmediato.
    const solicitudesRecargadas = await this.listarSolicitudesAdmin();

    return {
      solicitudActualizada,
      solicitudesRecargadas,
    };
  }

  // ── 3. Gestión del catálogo de espacios y mantenimiento ────────────────────

  async listarEspaciosAdmin(): Promise<Espacio[]> {
    return this.espacios.listarCatalogo();
  }

  async actualizarEspacioCatalogo(
    espacioId: UUID,
    datos: Partial<Espacio>,
  ): Promise<Espacio> {
    if (datos.capacidad !== undefined && (!Number.isFinite(datos.capacidad) || datos.capacidad < 1)) {
      throw new Error('La capacidad del espacio debe ser un número mayor o igual a 1.');
    }
    return this.espacios.actualizar(espacioId, datos);
  }

  async toggleEstadoEspacio(espacioId: UUID, estaActivo: boolean): Promise<Espacio> {
    return this.espacios.actualizar(espacioId, { esta_activo: estaActivo });
  }

  // ── 4. Reporte de ocupación, KPIs y bitácora de auditoría ──────────────────

  async generarReporteOcupacion(
    fechaInicioISO: ISODate,
    fechaFinISO: ISODate,
  ): Promise<ReporteOcupacionDTO> {
    const [filasSolicitudes, espacios] = await Promise.all([
      this.solicitudes.listarParaReporte(fechaInicioISO, fechaFinISO),
      this.espacios.listarCatalogo(),
    ]);

    const solicitudesConColision = calcularColisionesPendientes(filasSolicitudes);
    const idsSolicitudes = solicitudesConColision.map((s) => s.id);

    let historial: HistorialAuditoriaItem[] = [];
    try {
      const [porSolicitudes, reciente] = await Promise.all([
        this.historial.listarPorSolicitudes(idsSolicitudes),
        this.historial.listarReciente(40),
      ]);
      const mapa = new Map<UUID, HistorialAuditoriaItem>();
      for (const h of [...porSolicitudes, ...reciente]) {
        mapa.set(h.id, h);
      }
      historial = Array.from(mapa.values()).sort((a, b) =>
        b.fecha_cambio.localeCompare(a.fecha_cambio),
      );
    } catch (err) {
      console.warn('[PanelAdminController] No se pudo leer historial_estados_solicitud:', err);
    }

    return construirReporteOcupacion({
      fechaInicioISO,
      fechaFinISO,
      solicitudes: solicitudesConColision,
      espacios,
      historial,
    });
  }

  // ── 5. Generador de datos demo (independiente de la Fase 5) ─────────────────

  async generarDatosDemoParaPruebas(adminUserId: UUID): Promise<ResultadoDemoAdmin> {
    if (!adminUserId.trim()) {
      throw new Error('Debes tener sesión activa de Administrador para generar datos demo.');
    }

    const espacios = await this.espacios.listarCatalogo();
    if (espacios.length === 0) {
      throw new Error('No hay espacios registrados en public.espacios.');
    }

    // Buscamos Sala 1 (SALA-01) para las 2 solicitudes en colisión y un segundo espacio
    // (Cubículo 7 o Sala 2) para la tercera solicitud sin colisión.
    const sala1 =
      espacios.find((e) => e.codigo_espacio.toUpperCase() === 'SALA-01') ??
      espacios.find((e) => e.tipo_espacio === 'sala_posgrado') ??
      espacios[0];

    const otroEspacio =
      espacios.find((e) => e.codigo_espacio.toUpperCase() === 'CUB-07') ??
      espacios.find((e) => e.id !== sala1.id) ??
      sala1;

    const fechaDemoISO = obtenerFechaDemoValidada(new Date());

    // Insertamos las 3 solicitudes en estado 'pendiente':
    //  1) Sala 1: 09:00 a 11:00 (limpieza hasta 12:00)
    //  2) Sala 1: 10:00 a 12:00 (limpieza hasta 13:00) → ¡Colisión real con la #1!
    //  3) Cubículo 7 / Sala 2: 11:00 a 13:00 (limpieza hasta 14:00) → Sin colisión
    const s1 = await this.solicitudes.crearDemo({
      usuario_id: adminUserId,
      espacio_id: sala1.id,
      fecha_evento: fechaDemoISO,
      hora_inicio: '09:00:00',
      hora_fin: '11:00:00',
      hora_fin_limpieza: '12:00:00',
      tema_evento: '[DEMO COLISIÓN A] Examen predoctoral de Ciencias de la Computación',
    });

    const s2 = await this.solicitudes.crearDemo({
      usuario_id: adminUserId,
      espacio_id: sala1.id,
      fecha_evento: fechaDemoISO,
      hora_inicio: '10:00:00',
      hora_fin: '12:00:00',
      hora_fin_limpieza: '13:00:00',
      tema_evento: '[DEMO COLISIÓN B] Seminario de Investigación del Cuerpo Académico IA',
    });

    const s3 = await this.solicitudes.crearDemo({
      usuario_id: adminUserId,
      espacio_id: otroEspacio.id,
      fecha_evento: fechaDemoISO,
      hora_inicio: '11:00:00',
      hora_fin: '13:00:00',
      hora_fin_limpieza: '14:00:00',
      tema_evento: '[DEMO ESTUDIO POSGRADO]Asesoría y revisión de tesis de maestría DACyTI',
    });

    const creadas = [s1, s2, s3];

    // Documentos dummy en `public.documentos_solicitud`
    const docsDummy: NuevoDocumentoSolicitud[] = [
      {
        solicitud_id: s1.id,
        tipo_documento: 'formato_pdf_prellenado',
        nombre_archivo: `Formato_Solicitud_${sala1.codigo_espacio}_ColisionA.pdf`,
        storage_path: `demo/${s1.id}/Formato_Solicitud_ColisionA.pdf`,
        mime_type: 'application/pdf',
      },
      {
        solicitud_id: s1.id,
        tipo_documento: 'credencial_posgrado',
        nombre_archivo: 'Credencial_UJAT_Posgrado_222H17001.pdf',
        storage_path: `demo/${s1.id}/Credencial_UJAT_Posgrado.pdf`,
        mime_type: 'application/pdf',
      },
      {
        solicitud_id: s2.id,
        tipo_documento: 'formato_pdf_prellenado',
        nombre_archivo: `Formato_Solicitud_${sala1.codigo_espacio}_ColisionB.pdf`,
        storage_path: `demo/${s2.id}/Formato_Solicitud_ColisionB.pdf`,
        mime_type: 'application/pdf',
      },
      {
        solicitud_id: s3.id,
        tipo_documento: 'credencial_posgrado',
        nombre_archivo: `Credencial_Posgrado_${otroEspacio.codigo_espacio}.pdf`,
        storage_path: `demo/${s3.id}/Credencial_Posgrado.pdf`,
        mime_type: 'application/pdf',
      },
    ];

    try {
      await this.documentos.crearVarios(docsDummy);
    } catch (err) {
      // Si las políticas RLS de documentos_solicitud aún restringen el insert directo,
      // conservamos las 3 solicitudes recién creadas para no bloquear la prueba de colisión.
      console.warn('[PanelAdminController] Aviso al insertar documentos dummy:', err);
    }

    return {
      creadas,
      fechaDemoISO,
      salaColisionNombre: `${sala1.codigo_espacio} · ${sala1.nombre}`,
    };
  }

  // ── Auxiliar: abrir o resolver URL de un documento adjunto ─────────────────

  async obtenerUrlDocumento(storagePath: string): Promise<string | null> {
    return this.documentos.obtenerUrlDescarga(storagePath);
  }
}

/** Instancia única del controlador administrativo conectada a Supabase. */
export const panelAdminController = new PanelAdminController({
  solicitudes: repositorios.solicitudes,
  espacios: repositorios.espacios,
  documentos: repositorios.documentos,
  historial: repositorios.historial,
});
