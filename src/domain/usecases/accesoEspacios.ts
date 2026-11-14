/**
 * Caso de uso — Reglas de acceso a espacios.
 *
 * Los espacios con `exclusivo_alumnos_posgrado` (Cubículos 7, 8 y 9) son
 * visibles para todos, pero sólo se pueden consultar/reservar con sesión de
 * `estudiante_posgrado` o `administrador`.
 *
 * NOTA: esto es UX. La garantía real debe vivir en las políticas RLS de
 * `solicitudes_reservas` (INSERT).
 */
import type { Espacio, RolUsuario } from '../models';

const ROLES_CON_ACCESO_EXCLUSIVO: readonly RolUsuario[] = ['estudiante_posgrado', 'administrador'];

export const puedeAccederAEspacio = (
  espacio: Pick<Espacio, 'exclusivo_alumnos_posgrado'>,
  rol: RolUsuario | null | undefined,
): boolean => {
  if (!espacio.exclusivo_alumnos_posgrado) return true;
  return !!rol && ROLES_CON_ACCESO_EXCLUSIVO.includes(rol);
};

export type FiltroCatalogo = 'todos' | 'salas' | 'cubiculos';

export const filtrarCatalogo = (espacios: readonly Espacio[], filtro: FiltroCatalogo): Espacio[] => {
  switch (filtro) {
    case 'salas':
      return espacios.filter((e) => e.tipo_espacio === 'sala_posgrado');
    case 'cubiculos':
      return espacios.filter((e) => e.tipo_espacio === 'cubiculo_estudio');
    default:
      return [...espacios];
  }
};

/**
 * Orden de presentación: Salas (1-6) primero y luego Cubículos (7-9); dentro de
 * cada grupo, por `codigo_espacio` ASC. (El orden alfabético puro pondría
 * "CUB-07" antes que "SALA-01".)
 */
export const ordenarParaCatalogo = (espacios: readonly Espacio[]): Espacio[] =>
  [...espacios].sort((a, b) => {
    const ga = a.tipo_espacio === 'sala_posgrado' ? 0 : 1;
    const gb = b.tipo_espacio === 'sala_posgrado' ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return a.codigo_espacio.localeCompare(b.codigo_espacio, 'es', { numeric: true });
  });
