/**
 * Aplicación — GeneradorReportePDFService
 *
 * Genera el Informe Oficial y Estadístico de Ocupación y Gestión
 * de Espacios CICTAT (UJAT) en formato PDF imprimible y exportable,
 * con soporte para Web (window.open + print) y Móvil (expo-print + expo-sharing).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { ReporteOcupacionDTO } from '@/domain/models';
import { formatearFolioCorto } from '@/domain/usecases';

import { LOGO_SIPV_DATA_URI, LOGO_UJAT_DATA_URI } from './logosInstitucionales';

/**
 * Formatea una fecha YYYY-MM-DD en formato legible formal (ej. 15 de marzo de 2026).
 */
function formatearFechaTexto(fechaISO: string): string {
  if (!fechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return fechaISO;
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const [año, mes, dia] = fechaISO.split('-');
  const mesIndex = parseInt(mes, 10) - 1;
  return `${parseInt(dia, 10)} de ${meses[mesIndex] ?? mes} de ${año}`;
}

/**
 * Genera el documento HTML completo y auto-contenido del Informe Estadístico CICTAT.
 */
export function generarHTMLReporteEstadisticas(
  reporte: ReporteOcupacionDTO,
  nombreEncargado?: string,
): string {
  const fechaGeneracion = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const horaGeneracion = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const periodoInicio = formatearFechaTexto(reporte.fechaInicioISO);
  const periodoFin = formatearFechaTexto(reporte.fechaFinISO);

  const kpis = reporte.kpis;
  const tasaAprobacion =
    kpis.totalSolicitudes > 0
      ? Math.round((kpis.aprobadas / kpis.totalSolicitudes) * 100)
      : 0;

  const totalHorasAprobadas = reporte.rankingEspacios.reduce(
    (acc, cur) => acc + cur.horasAprobadasOcupadas,
    0,
  );

  const totalReservasAprobadas = reporte.rankingEspacios.reduce(
    (acc, cur) => acc + cur.numeroReservasAprobadas,
    0,
  );

  // Filas del ranking de espacios
  const filasRanking = reporte.rankingEspacios
    .map((item, idx) => {
      const tipoEtiqueta =
        item.tipoEspacio === 'cubiculo_estudio'
          ? 'Cubículo Posgrado'
          : 'Sala CICTAT';
      return `
      <tr>
        <td style="text-align: center; font-weight: bold; color: #1C8443;">#${idx + 1}</td>
        <td>
          <strong>${item.codigoEspacio} · ${item.nombreEspacio}</strong>
          <div style="font-size: 11px; color: #71717A;">${tipoEtiqueta} (Capacidad: ${item.capacidad} personas)</div>
        </td>
        <td style="text-align: center; font-weight: bold; color: #18181B;">${item.horasAprobadasOcupadas} hrs</td>
        <td style="text-align: center;">${item.numeroReservasAprobadas}</td>
        <td style="text-align: center;">${item.totalSolicitudesEspacio}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; background: #E4E4E7; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.max(item.porcentajeRelativo, item.totalSolicitudesEspacio > 0 ? 8 : 0))}%; background: ${item.tipoEspacio === 'cubiculo_estudio' ? '#41AD49' : '#1C8443'}; height: 100%; border-radius: 4px;"></div>
            </div>
            <span style="font-size: 11px; font-weight: bold; color: #18181B; min-width: 35px; text-align: right;">${item.porcentajeRelativo}%</span>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Filas de distribución por rol
  const filasDistribucion = reporte.distribucionPorRol
    .map((d) => {
      return `
      <tr>
        <td><strong>${d.etiqueta}</strong></td>
        <td style="text-align: center; font-weight: bold;">${d.conteo} solicitudes</td>
        <td style="text-align: center; font-weight: bold; color: #1C8443;">${d.porcentaje}%</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; background: #E4E4E7; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.max(d.porcentaje, d.conteo > 0 ? 6 : 0))}%; background: #1C8443; height: 100%; border-radius: 4px;"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');

  // Filas de bitácora reciente
  const filasBitacora =
    reporte.bitacoraReciente.length > 0
      ? reporte.bitacoraReciente
          .slice(0, 15)
          .map((b) => {
            const fechaB = new Date(b.fecha_cambio).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const transicion = `${(b.estado_anterior ?? 'nueva').toUpperCase()} → ${b.estado_nuevo.toUpperCase()}`;
            const tipoRechazo = b.es_rechazo_automatico_colision
              ? '<span class="badge-colision">Rechazo Automático por Colisión</span>'
              : '<span class="badge-manual">Movimiento Administrativo</span>';

            return `
        <tr>
          <td style="font-weight: bold; font-family: monospace; font-size: 11px;">${formatearFolioCorto(b.solicitud_id)}</td>
          <td style="font-size: 11px; color: #52525B;">${fechaB}</td>
          <td><span class="badge-transicion">${transicion}</span></td>
          <td>${tipoRechazo}</td>
          <td style="font-size: 11px; color: #27272A;">${b.motivo_cambio || 'Sin motivo adicional'}</td>
        </tr>
      `;
          })
          .join('')
      : `<tr><td colspan="5" style="text-align: center; color: #71717A; padding: 16px;">No se registraron movimientos de bitácora en el periodo analizado.</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe Oficial y Estadístico de Ocupación — CICTAT</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #18181B;
      background: #FFFFFF;
      padding: 16px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }

    /* Barra Web para acciones rápidas */
    .barra-web {
      background: #18181B;
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .barra-web-btn {
      background: #1C8443;
      color: #FFFFFF;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .barra-web-btn-sec {
      background: #3F3F46;
      color: #FFFFFF;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }

    /* Encabezado Formal */
    .header-institucional {
      border-bottom: 2.5px solid #1C8443;
      padding-bottom: 10px;
      margin-bottom: 14px;
      text-align: center;
    }
    .header-superior {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      margin-bottom: 8px;
    }
    .header-logo-col {
      flex: 0 0 27.5%;
      max-width: 210px;
      display: flex;
      align-items: center;
    }
    .header-logo-col.izq {
      justify-content: flex-start;
    }
    .header-logo-col.der {
      justify-content: flex-end;
    }
    .header-logo-ujat {
      width: 100%;
      max-width: 168px;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .header-logo-sipv {
      width: 100%;
      max-width: 205px;
      height: auto;
      display: block;
      object-fit: contain;
    }
    .header-textos {
      flex: 1;
      min-width: 0;
      text-align: center;
      padding: 0 4px;
    }
    .header-textos h1 {
      font-size: 13px;
      font-weight: 800;
      color: #1C8443;
      letter-spacing: 0.3px;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .header-textos h2 {
      font-size: 11px;
      font-weight: 700;
      color: #27272A;
      line-height: 1.25;
      margin-top: 2px;
    }
    .header-textos h3 {
      font-size: 10px;
      font-weight: 600;
      color: #71717A;
      line-height: 1.25;
      margin-top: 2px;
    }
    .badge-reporte {
      display: inline-block;
      background: #E4F0E7;
      border: 1px solid #1C8443;
      color: #1C8443;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 5px 16px;
      border-radius: 6px;
      text-align: center;
    }

    /* Banda informativa */
    .meta-banda {
      background: #F4F4F5;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 11px;
      color: #27272A;
    }

    /* KPIs Clave */
    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .kpi-card {
      background: #FAFAFA;
      border: 1px solid #E4E4E7;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .kpi-card.destacado {
      background: #E4F0E7;
      border-color: #1C8443;
    }
    .kpi-card.alerta {
      background: #FFFBEB;
      border-color: #D97706;
    }
    .kpi-titulo {
      font-size: 9.5px;
      font-weight: 800;
      color: #52525B;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 4px;
    }
    .kpi-valor {
      font-size: 20px;
      font-weight: 900;
      color: #18181B;
      line-height: 1.1;
    }
    .kpi-card.destacado .kpi-valor {
      color: #1C8443;
    }
    .kpi-card.alerta .kpi-valor {
      color: #D97706;
    }
    .kpi-desc {
      font-size: 9px;
      color: #71717A;
      margin-top: 3px;
    }

    /* Secciones y Tablas */
    .seccion {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .seccion-header {
      background: #1C8443;
      color: #FFFFFF;
      font-size: 11.5px;
      font-weight: 800;
      padding: 6px 12px;
      border-radius: 4px 4px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border: 1px solid #E4E4E7;
      border-top: none;
    }
    th {
      background: #F4F4F5;
      color: #27272A;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border-bottom: 1px solid #E4E4E7;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #F4F4F5;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #FAFAFA;
    }

    /* Badges */
    .badge-transicion {
      background: #F4F4F5;
      border: 1px solid #D4D4D8;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 700;
      color: #18181B;
    }
    .badge-colision {
      background: #FFFBEB;
      color: #B45309;
      border: 1px solid #FDE68A;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 9.5px;
      font-weight: 700;
    }
    .badge-manual {
      background: #F4F4F5;
      color: #52525B;
      border: 1px solid #E4E4E7;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 9.5px;
      font-weight: 600;
    }

    /* Firmas */
    .seccion-firmas {
      margin-top: 26px;
      display: flex;
      justify-content: space-around;
      gap: 30px;
      page-break-inside: avoid;
    }
    .bloque-firma {
      flex: 1;
      text-align: center;
      padding-top: 40px;
    }
    .linea-firma {
      border-top: 1.5px solid #18181B;
      margin-bottom: 6px;
      width: 85%;
      margin-left: auto;
      margin-right: auto;
    }
    .firma-cargo {
      font-size: 10px;
      color: #71717A;
      margin-top: 2px;
    }

    /* Pie de página */
    .pie-documento {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #E4E4E7;
      font-size: 9.5px;
      color: #71717A;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>

  <!-- Barra Superior Web (Oculta al Imprimir) -->
  <div class="barra-web no-print">
    <div>
      <strong>Informe Estadístico de Ocupación — CICTAT · UJAT</strong>
      <div style="font-size: 11px; opacity: 0.85;">Periodo: ${periodoInicio} al ${periodoFin}</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="barra-web-btn" onclick="window.print()">
        <span>🖨️</span> Imprimir / Guardar como PDF
      </button>
      <button class="barra-web-btn-sec" onclick="window.close()">
        Cerrar
      </button>
    </div>
  </div>

  <!-- Encabezado Formal Institucional -->
  <div class="header-institucional">
    <div class="header-superior">
      <div class="header-logo-col izq">
        <img class="header-logo-ujat" src="${LOGO_UJAT_DATA_URI}" alt="Universidad Juárez Autónoma de Tabasco" />
      </div>
      <div class="header-textos">
        <h1>Universidad Juárez Autónoma de Tabasco</h1>
        <h2>Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT)</h2>
        <h3>Sistema Central de Gestión y Asignación de Espacios</h3>
      </div>
      <div class="header-logo-col der">
        <img class="header-logo-sipv" src="${LOGO_SIPV_DATA_URI}" alt="Secretaría de Investigación, Posgrado y Vinculación" />
      </div>
    </div>
    <div class="badge-reporte">
      INFORME EJECUTIVO DE OCUPACIÓN · GESTIÓN DE ESPACIOS
    </div>
  </div>

  <!-- Banda Informativa del Reporte -->
  <div class="meta-banda">
    <div><strong>PERIODO EVALUADO:</strong> ${periodoInicio} al ${periodoFin}</div>
    <div><strong>FECHA DE EMISIÓN:</strong> ${fechaGeneracion}, ${horaGeneracion} hrs</div>
    <div><strong>RESPONSABLE:</strong> ${nombreEncargado || 'Encargado Administrativo CICTAT'}</div>
  </div>

  <!-- 1. Tarjetas de KPIs Ejecutivos -->
  <div class="kpis-grid">
    <div class="kpi-card">
      <div class="kpi-titulo">Total Solicitudes</div>
      <div class="kpi-valor">${kpis.totalSolicitudes}</div>
      <div class="kpi-desc">Periodo analizado</div>
    </div>
    <div class="kpi-card destacado">
      <div class="kpi-titulo">Aprobadas</div>
      <div class="kpi-valor">${kpis.aprobadas}</div>
      <div class="kpi-desc">Tasa éxito: ${tasaAprobacion}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-titulo">Pendientes</div>
      <div class="kpi-valor">${kpis.pendientes}</div>
      <div class="kpi-desc">Por dictaminar</div>
    </div>
    <div class="kpi-card alerta">
      <div class="kpi-titulo">Colisión Auto</div>
      <div class="kpi-valor">${kpis.rechazadasPorColisionAutomatica}</div>
      <div class="kpi-desc">Descarte por traslape</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-titulo">Rechazo Manual</div>
      <div class="kpi-valor">${kpis.rechazadasManual}</div>
      <div class="kpi-desc">Dictamen administrativo</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-titulo">Canceladas</div>
      <div class="kpi-valor">${kpis.canceladas}</div>
      <div class="kpi-desc">Liberadas por usuario</div>
    </div>
  </div>

  <!-- 2. Tabla de Ranking y Ocupación por Espacio -->
  <div class="seccion">
    <div class="seccion-header">
      <span>1. Métricas de Ocupación y Demanda por Espacio Físico</span>
      <span style="font-size: 10px; font-weight: 500;">Total Aprobadas: ${totalHorasAprobadas} hrs / ${totalReservasAprobadas} eventos</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">Pos.</th>
          <th>Espacio / Sala</th>
          <th style="width: 90px; text-align: center;">Horas Aprobadas</th>
          <th style="width: 80px; text-align: center;">Reservas</th>
          <th style="width: 80px; text-align: center;">Solicitudes</th>
          <th style="width: 140px;">Intensidad de Uso</th>
        </tr>
      </thead>
      <tbody>
        ${filasRanking}
      </tbody>
    </table>
  </div>

  <!-- 3. Distribución por Perfil de Usuario -->
  <div class="seccion">
    <div class="seccion-header">
      <span>2. Distribución de Solicitantes por Perfil Académico</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Tipo de Usuario</th>
          <th style="width: 130px; text-align: center;">Total Solicitudes</th>
          <th style="width: 100px; text-align: center;">Participación</th>
          <th style="width: 180px;">Proporción</th>
        </tr>
      </thead>
      <tbody>
        ${filasDistribucion}
      </tbody>
    </table>
  </div>

  <!-- 4. Bitácora de Auditoría Reciente -->
  <div class="seccion">
    <div class="seccion-header">
      <span>3. Muestra de Auditoría y Movimientos de Estado Recientes</span>
      <span style="font-size: 10px; font-weight: 500;">Últimos registros</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 80px;">Folio</th>
          <th style="width: 130px;">Fecha y Hora</th>
          <th style="width: 140px;">Transición de Estado</th>
          <th style="width: 160px;">Mecanismo</th>
          <th>Motivo o Dictamen Registrado</th>
        </tr>
      </thead>
      <tbody>
        ${filasBitacora}
      </tbody>
    </table>
  </div>

  <!-- Sección de Firmas de Validación y Entrega -->
  <div class="seccion-firmas">
    <div class="bloque-firma">
      <div class="linea-firma"></div>
      <strong>${nombreEncargado || 'Lic. Encargado de Gestión y Logística'}</strong><br />
      <span class="firma-cargo">Encargado de Espacios y Laboratorios CICTAT</span>
    </div>
    <div class="bloque-firma">
      <div class="linea-firma"></div>
      <strong>Dirección y Coordinación de Investigación</strong><br />
      <span class="firma-cargo">Centro de Investigación de Ciencia y Tecnología Aplicada de Tabasco (CICTAT) · UJAT</span>
    </div>
  </div>

  <!-- Pie de Documento -->
  <div class="pie-documento">
    Documento emitido formalmente por el Sistema Central de Gestión de Espacios CICTAT · Universidad Juárez Autónoma de Tabasco (UJAT).
    La información estadística presentada refleja el registro en tiempo real de reservaciones, desinfecciones preventivas (+1 hora) y resolución de traslapes en base de datos.
  </div>

</body>
</html>
  `.trim();
}

/**
 * Exporta el informe estadístico en formato PDF para visualización, impresión o descarga.
 * - En Web: abre una ventana emergente lista para imprimir o guardar como PDF.
 * - En Móvil: genera el binario PDF con expo-print y abre el menú nativo con expo-sharing.
 */
export async function exportarReporteEstadisticasPDF(
  reporte: ReporteOcupacionDTO,
  nombreEncargado?: string,
): Promise<void> {
  const html = generarHTMLReporteEstadisticas(reporte, nombreEncargado);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const ventana = window.open('', '_blank');
      if (ventana) {
        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();
        ventana.focus();
        return;
      }
    }
    return;
  }

  // En Móvil (iOS / Android)
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Exportar Informe Estadístico CICTAT',
      UTI: 'com.adobe.pdf',
    });
  } else {
    await Print.printAsync({ uri });
  }
}

export const generadorReportePDFService = {
  generarHTMLReporteEstadisticas,
  exportarReporteEstadisticasPDF,
};

export default generadorReportePDFService;
