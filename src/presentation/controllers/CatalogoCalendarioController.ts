/**
 * Presentación (Controlador MVC) — Catálogo y calendario en tiempo real.
 *
 * `CatalogoCalendarioController` es la fachada que la Vista usa para obtener
 * datos: no conoce Supabase, sólo los puertos del dominio. Los hooks
 * `useCatalogoController` / `useEspacioCalendarioController` (archivos
 * hermanos) añaden el estado de React encima de esta clase.
 */
import type { Espacio, ISODate, SolicitudReservaCalendario, UUID } from '@/domain/models';
import type {
  ICambiosEnVivoGateway,
  IEspacioRepository,
  ISolicitudReservaRepository,
  OpcionesSuscripcion,
} from '@/domain/repositories';
import { repositorios } from '@/infrastructure/repositories';

export interface CatalogoCalendarioDeps {
  espacios: IEspacioRepository;
  solicitudes: ISolicitudReservaRepository;
  cambiosEnVivo: ICambiosEnVivoGateway;
}

export class CatalogoCalendarioController {
  constructor(private readonly deps: CatalogoCalendarioDeps) {}

  /** `public.espacios` ordenado por `codigo_espacio` ASC. */
  obtenerEspaciosCatalogo(): Promise<Espacio[]> {
    return this.deps.espacios.listarCatalogo();
  }

  obtenerEspacioPorId(id: UUID): Promise<Espacio | null> {
    return this.deps.espacios.obtenerPorId(id);
  }

  /**
   * `public.solicitudes_reservas` filtrado por `espacio_id`, `fecha_evento` y
   * `estado IN ('pendiente','aprobada')`.
   */
  obtenerReservasPorEspacioYFecha(
    espacioId: UUID,
    fechaISO: ISODate,
  ): Promise<SolicitudReservaCalendario[]> {
    return this.deps.solicitudes.listarActivasPorEspacioYFecha(espacioId, fechaISO);
  }

  /**
   * Suscripción Realtime a `espacios` y/o `solicitudes_reservas`.
   * Devuelve la función para cancelarla (llamar en el cleanup del efecto).
   */
  suscribirCambiosEnVivo(opciones: OpcionesSuscripcion): () => void {
    return this.deps.cambiosEnVivo.suscribir(opciones);
  }
}

/** Instancia por defecto (composición con la infraestructura Supabase). */
export const catalogoCalendarioController = new CatalogoCalendarioController({
  espacios: repositorios.espacios,
  solicitudes: repositorios.solicitudes,
  cambiosEnVivo: repositorios.cambiosEnVivo,
});
