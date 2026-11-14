/**
 * Aplicación — GeneradorFormatoPDFService
 *
 * Servicio encargado de generar el Formato Oficial de Solicitud de Reserva
 * de Espacios CICTAT (DACyTI - UJAT) pre-llenado (sin firma digital),
 * subirlo a Supabase Storage y permitir su descarga o impresión nativa/web.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type {
  DocumentoSolicitud,
  Espacio,
  NuevoDocumentoSolicitud,
  PerfilUsuario,
  SolicitudReserva,
} from '@/domain/models';
import { formatearFechaLarga } from '@/domain/usecases/calendario';
import { supabase } from '@/infrastructure/supabase/supabaseClient';
import { TABLAS } from '@/infrastructure/supabase/tables';

// Nombres de buckets institucionales
const BUCKET_FORMATOS_PDF = 'formatos_pdf';
const BUCKET_FALLBACK = 'documentos-solicitud';

/**
 * Traduce el tipo de rol de usuario a una denominación formal universitaria.
 */
function obtenerEtiquetaRolFormal(rol: string): string {
  switch (rol) {
    case 'estudiante_posgrado':
      return 'Estudiante de Posgrado';
    case 'doctor_posgrado':
      return 'Doctor de Posgrado';
    case 'publico_general':
      return 'Público General';
    case 'administrador':
      return 'Administrador Institucional';
    default:
      return rol;
  }
}

/**
 * Traduce el estado de la solicitud a una etiqueta formal.
 */
function obtenerEtiquetaEstadoFormal(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'PENDIENTE DE APROBACIÓN';
    case 'aprobada':
      return 'APROBADA';
    case 'rechazada':
      return 'RECHAZADA';
    case 'cancelada':
      return 'CANCELADA';
    default:
      return estado.toUpperCase();
  }
}

/**
 * Genera la plantilla HTML institucional tamaño Carta del Formato CICTAT.
 */
export function generarHTMLFormatoCICTAT(
  usuario: PerfilUsuario,
  espacio: Espacio,
  solicitud: SolicitudReserva,
): string {
  const folioCorto = solicitud.id ? solicitud.id.slice(0, 8).toUpperCase() : 'PENDIENTE';
  const fechaRegistro = solicitud.created_at
    ? new Date(solicitud.created_at).toLocaleString('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

  const esSala =
    espacio.tipo_espacio === 'sala_posgrado' ||
    espacio.codigo_espacio.toUpperCase().startsWith('SALA');

  const textoEquipamiento = esSala
    ? 'Incluye acceso y préstamo intrínseco de: Proyector, Laptop y Extensión eléctrica.'
    : 'Cubículo de estudio exclusivo para Posgrado (5 personas): Mesa colaborativa, contactos eléctricos y climatización.';

  const horaFinLimpiezaTexto =
    solicitud.hora_fin_limpieza ||
    `${solicitud.hora_fin.split(':')[0] ? String(Number(solicitud.hora_fin.split(':')[0]) + 1).padStart(2, '0') : '16'}:${solicitud.hora_fin.split(':')[1] ?? '00'}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formato de Solicitud de Reserva - CICTAT UJAT</title>
  <style>
    @page {
      size: letter;
      margin: 15mm 18mm 15mm 18mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1C1917;
      background-color: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.35;
    }
    .header-institucional {
      text-align: center;
      border-bottom: 2.5px solid #1C1917;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-institucional h1 {
      font-size: 13pt;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1C1917;
      font-weight: 800;
    }
    .header-institucional h2 {
      font-size: 10.5pt;
      margin: 0 0 2px 0;
      font-weight: 600;
      color: #C88A32;
    }
    .header-institucional h3 {
      font-size: 9.5pt;
      margin: 0 0 8px 0;
      font-weight: 500;
      color: #57534E;
    }
    .titulo-documento {
      display: inline-block;
      background-color: #1C1917;
      color: #FAF7F2;
      padding: 5px 18px;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 4px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .meta-banda {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #FAF7F2;
      border: 1px solid #E5DEC9;
      padding: 7px 12px;
      border-radius: 4px;
      margin-bottom: 14px;
      font-size: 9.5pt;
    }
    .meta-banda strong {
      color: #1C1917;
    }
    .badge-estado {
      background-color: #C88A32;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 8.5pt;
      letter-spacing: 0.5px;
    }
    .seccion-titulo {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1C1917;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-left: 4px solid #E05A2B;
      padding-left: 8px;
      margin: 12px 0 6px 0;
    }
    table.tabla-datos {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10pt;
    }
    table.tabla-datos th,
    table.tabla-datos td {
      border: 1px solid #D6CFBF;
      padding: 6px 9px;
      vertical-align: top;
      text-align: left;
    }
    table.tabla-datos th {
      background-color: #F3EFE6;
      color: #1C1917;
      font-weight: 700;
      width: 28%;
    }
    table.tabla-datos td {
      background-color: #FFFFFF;
      color: #1C1917;
    }
    .nota-limpieza {
      color: #E05A2B;
      font-weight: 700;
      display: block;
      margin-top: 3px;
      font-size: 9pt;
    }
    .tema-caja {
      background-color: #FAF7F2;
      border: 1px solid #E5DEC9;
      border-radius: 4px;
      padding: 8px 10px;
      font-style: italic;
      color: #1C1917;
      margin-top: 2px;
      white-space: pre-wrap;
    }
    .clausula-responsabilidad {
      border: 1.5px solid #1C1917;
      background-color: #FAF7F2;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 14px 0 20px 0;
      font-size: 8.5pt;
      line-height: 1.38;
      text-align: justify;
    }
    .clausula-responsabilidad strong {
      color: #E05A2B;
      font-weight: 800;
    }
    .seccion-firmas {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .bloque-firma {
      width: 46%;
      text-align: center;
      font-size: 9pt;
    }
    .linea-firma {
      border-top: 1.5px solid #1C1917;
      margin-bottom: 6px;
      width: 100%;
    }
    .firma-cargo {
      color: #57534E;
      font-size: 8pt;
      font-style: italic;
      margin-top: 3px;
    }
    .pie-folio {
      margin-top: 18px;
      text-align: center;
      font-size: 7.5pt;
      color: #78716C;
      border-top: 1px dashed #D6CFBF;
      padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- Encabezado Institucional -->
  <div class="header-institucional">
    <h1>UNIVERSIDAD JUÁREZ AUTÓNOMA DE TABASCO</h1>
    <h2>División Académica de Ciencias y Tecnologías de la Información (DACyTI)</h2>
    <h3>Coordinación de Posgrado e Investigación — CICTAT</h3>
    <div class="titulo-documento">FORMATO OFICIAL DE SOLICITUD DE RESERVA DE ESPACIO</div>
  </div>

  <!-- Banda de Folio y Fecha -->
  <div class="meta-banda">
    <div><strong>FOLIO:</strong> CICTAT-${folioCorto}</div>
    <div><strong>FECHA DE REGISTRO:</strong> ${fechaRegistro}</div>
    <div><strong>ESTADO:</strong> <span class="badge-estado">${obtenerEtiquetaEstadoFormal(solicitud.estado)}</span></div>
  </div>

  <!-- Tabla 1: Datos del Solicitante -->
  <div class="seccion-titulo">1. Datos del Solicitante</div>
  <table class="tabla-datos">
    <tr>
      <th>Nombre Completo:</th>
      <td><strong>${usuario.nombre_completo || 'No especificado'}</strong></td>
    </tr>
    <tr>
      <th>Correo Electrónico:</th>
      <td>${usuario.correo || 'No especificado'}</td>
    </tr>
    <tr>
      <th>Teléfono de Contacto:</th>
      <td>${usuario.telefono || 'No proporcionado'}</td>
    </tr>
    <tr>
      <th>Tipo de Usuario:</th>
      <td>${obtenerEtiquetaRolFormal(usuario.rol)}</td>
    </tr>
    <tr>
      <th>Matrícula UJAT:</th>
      <td>${usuario.matricula ? usuario.matricula : 'No aplica (Público General / Externo)'}</td>
    </tr>
    <tr>
      <th>Dependencia / Procedencia:</th>
      <td>${usuario.dependencia_procedencia || 'DACyTI — Universidad Juárez Autónoma de Tabasco'}</td>
    </tr>
  </table>

  <!-- Tabla 2: Especificaciones del Espacio y Evento -->
  <div class="seccion-titulo">2. Especificaciones del Espacio y Evento Solicitado</div>
  <table class="tabla-datos">
    <tr>
      <th>Espacio Solicitado:</th>
      <td><strong>${espacio.nombre}</strong> (${espacio.codigo_espacio})</td>
    </tr>
    <tr>
      <th>Capacidad Máxima:</th>
      <td>${espacio.capacidad} personas</td>
    </tr>
    <tr>
      <th>Fecha Programada:</th>
      <td><strong>${formatearFechaLarga(solicitud.fecha_evento)}</strong> (${solicitud.fecha_evento})</td>
    </tr>
    <tr>
      <th>Horario Solicitado:</th>
      <td>
        <strong>${solicitud.hora_inicio} a ${solicitud.hora_fin} hrs</strong>
        <span class="nota-limpieza">
          * Bloque Institucional de Limpieza (+1 hora posterior): Espacio ocupado y protegido hasta las ${horaFinLimpiezaTexto} hrs.
        </span>
      </td>
    </tr>
    <tr>
      <th>Equipamiento e Infraestructura:</th>
      <td>${textoEquipamiento}</td>
    </tr>
    <tr>
      <th>Tema / Descripción del Evento:</th>
      <td>
        <div class="tema-caja">${solicitud.tema_evento || 'Sin descripción ingresada'}</div>
      </td>
    </tr>
  </table>

  <!-- Cláusula Legal Obligatoria de Responsabilidad y Deslinde -->
  <div class="clausula-responsabilidad">
    <strong>CARTA COMPROMISO Y DESLINDE DE RESPONSABILIDAD:</strong>
    Por medio de la presente, el solicitante se compromete a hacer uso adecuado de las instalaciones del CICTAT - DACyTI y a entregar el espacio puntualmente en la hora de finalización establecida para permitir el bloque institucional de limpieza. Asimismo, el solicitante asume total responsabilidad financiera y administrativa en caso de daño, desperfecto o faltante en el mobiliario, instalaciones o equipo tecnológico prestado intrínsecamente con la sala (proyector, laptop, extensión eléctrica y accesorios). Finalmente, la administración de Espacios CICTAT - UJAT se deslinda de toda responsabilidad por objetos personales, documentos o equipos olvidados o extraviados dentro de las instalaciones tras concluir la reserva.
  </div>

  <!-- Sección de Firmas Físicas (listas para firmar en físico el día del evento) -->
  <div class="seccion-firmas">
    <div class="bloque-firma">
      <div class="linea-firma"></div>
      <strong>Nombre y Firma Autógrafa del Solicitante</strong><br />
      <span class="firma-cargo">(Presentar este formato impreso el día del evento)</span>
    </div>
    <div class="bloque-firma">
      <div class="linea-firma"></div>
      <strong>Sello y Firma del Encargado de Espacios CICTAT</strong><br />
      <span class="firma-cargo">(Validación presencial DACyTI - UJAT)</span>
    </div>
  </div>

  <div class="pie-folio">
    Sistema de Gestión de Espacios CICTAT · DACyTI — UJAT · Documento generado electrónicamente sin validez de reserva hasta recabar visto bueno y firmas presenciales.
  </div>

</body>
</html>
  `.trim();
}

/**
 * Genera el archivo PDF a partir de los datos de la solicitud y lo sube al bucket de Supabase Storage.
 * Retorna la URI local y la URL pública (si está disponible).
 */
export async function generarYSubirPDFPrellenado(
  usuario: PerfilUsuario,
  espacio: Espacio,
  solicitud: SolicitudReserva,
): Promise<{ uri: string; publicUrl: string | null }> {
  const html = generarHTMLFormatoCICTAT(usuario, espacio, solicitud);
  const nombreArchivo = 'formato_solicitud_cictat.pdf';
  const storagePath = `${usuario.id}/${solicitud.id}/${nombreArchivo}`;

  let localUri = '';
  let publicUrl: string | null = null;
  let bucketUsado = BUCKET_FORMATOS_PDF;

  if (Platform.OS === 'web') {
    // En Web, creamos un blob del HTML para respaldo documental y previsualización
    const blob = new Blob([html], { type: 'text/html' });
    localUri = typeof window !== 'undefined' ? URL.createObjectURL(blob) : '';

    try {
      // Subir el respaldo HTML/PDF al storage
      let { error: uploadError } = await supabase.storage
        .from(BUCKET_FORMATOS_PDF)
        .upload(storagePath, blob, { contentType: 'text/html', upsert: true });

      if (uploadError && /bucket.*not.*found/i.test(uploadError.message)) {
        bucketUsado = BUCKET_FALLBACK;
        await supabase.storage
          .from(BUCKET_FALLBACK)
          .upload(storagePath, blob, { contentType: 'text/html', upsert: true });
      }

      const { data: urlData } = supabase.storage
        .from(bucketUsado)
        .getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl ?? null;
    } catch (e) {
      console.warn('[PDFService Web] No se pudo subir el archivo de respaldo a Storage:', e);
    }
  } else {
    // En Móvil (iOS / Android), usar expo-print para generar el binario PDF
    const printResult = await Print.printToFileAsync({
      html,
      base64: false,
    });
    localUri = printResult.uri;

    try {
      const response = await fetch(localUri);
      const pdfBlob = await response.blob();

      // Subir a Supabase Storage en bucket formatos_pdf (con fallback a documentos-solicitud)
      let { error: uploadError } = await supabase.storage
        .from(BUCKET_FORMATOS_PDF)
        .upload(storagePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError && /bucket.*not.*found/i.test(uploadError.message)) {
        bucketUsado = BUCKET_FALLBACK;
        const resFallback = await supabase.storage
          .from(BUCKET_FALLBACK)
          .upload(storagePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
          });
        uploadError = resFallback.error;
      }

      if (uploadError) {
        console.warn('[PDFService] Advertencia al subir PDF a Storage:', uploadError.message);
      } else {
        const { data: urlData } = supabase.storage.from(bucketUsado).getPublicUrl(storagePath);
        publicUrl = urlData?.publicUrl ?? null;
      }
    } catch (err) {
      console.warn('[PDFService] Error al convertir/subir PDF local a Supabase Storage:', err);
    }
  }

  // Registrar fila en public.documentos_solicitud
  try {
    // Verificar si ya existe para evitar error de clave duplicada
    const { data: existente } = await supabase
      .from(TABLAS.documentosSolicitud)
      .select('id')
      .eq('solicitud_id', solicitud.id)
      .eq('tipo_documento', 'formato_pdf_prellenado')
      .maybeSingle();

    if (!existente) {
      const nuevoDoc: NuevoDocumentoSolicitud = {
        solicitud_id: solicitud.id,
        tipo_documento: 'formato_pdf_prellenado',
        nombre_archivo: nombreArchivo,
        storage_path: storagePath,
        storage_bucket: bucketUsado,
        url_descarga: publicUrl || storagePath,
        mime_type: 'application/pdf',
      };

      await supabase.from(TABLAS.documentosSolicitud).insert(nuevoDoc);
    }
  } catch (dbErr) {
    console.warn('[PDFService] No se pudo insertar en documentos_solicitud:', dbErr);
  }

  return { uri: localUri, publicUrl };
}

/**
 * Permite abrir el menú nativo de compartir/guardar el PDF o la ventana limpia de impresión.
 */
export async function descargarOCompartirPDF(
  uriOrHtml: string,
  htmlRespaldo?: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    if (htmlRespaldo) {
      await Print.printAsync({ html: htmlRespaldo });
      return;
    }
    // Si tenemos una URL/Blob
    if (typeof window !== 'undefined') {
      window.open(uriOrHtml, '_blank');
    }
    return;
  }

  // Móvil (iOS / Android)
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable && uriOrHtml.startsWith('file://')) {
    await Sharing.shareAsync(uriOrHtml, {
      mimeType: 'application/pdf',
      dialogTitle: 'Descargar Formato Pre-llenado CICTAT',
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Si no está disponible sharing o no es file://, usar Print.printAsync nativo
    if (htmlRespaldo) {
      await Print.printAsync({ html: htmlRespaldo });
    } else {
      await Print.printAsync({ uri: uriOrHtml });
    }
  }
}

/**
 * Regenera y descarga o comparte el formato PDF de una solicitud existente.
 */
export async function regenerarYDescargarPDF(
  usuario: PerfilUsuario,
  espacio: Espacio,
  solicitud: SolicitudReserva,
): Promise<void> {
  const html = generarHTMLFormatoCICTAT(usuario, espacio, solicitud);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await descargarOCompartirPDF(uri, html);
}

export const generadorFormatoPDFService = {
  generarHTMLFormatoCICTAT,
  generarYSubirPDFPrellenado,
  descargarOCompartirPDF,
  regenerarYDescargarPDF,
};

export default generadorFormatoPDFService;
