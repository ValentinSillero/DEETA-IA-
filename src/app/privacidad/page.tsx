import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda DEETA, para qué los usa y cómo podés ejercer tus derechos.",
};

// Fecha fija: se actualiza a mano cuando cambia el texto.
const UPDATED_AT = "20 de octubre de 2026";

// Este texto describe el funcionamiento real de DEETA. Si cambia lo que se
// guarda o los proveedores que intervienen, hay que actualizarlo.
export default function PrivacyPage() {
  return (
    <LegalDocument title="Política de privacidad" updatedAt={UPDATED_AT}>
      <p>Esta política explica qué información guarda DEETA, para qué la usa, con quién la comparte y qué podés hacer con ella. DEETA está en etapa Beta: el servicio puede cambiar, tener errores o interrupciones, y esta política se va a actualizar cuando cambie lo que hacemos con los datos.</p>
      <p><strong>DEETA no vende los datos personales de sus usuarios.</strong></p>
      <p>Podés comunicarte con DEETA mediante los canales de contacto disponibles en el sitio; el canal principal es WhatsApp.</p>

      <h2>1. Qué información guardamos</h2>
      <ul>
        <li><strong>Tu cuenta:</strong> nombre, email y contraseña. La contraseña se guarda cifrada (como un hash), no en texto legible.</li>
        <li><strong>Tus sesiones:</strong> cuando iniciás sesión guardamos la sesión con la dirección IP y el tipo de navegador o dispositivo desde el que entraste. La sesión dura hasta 30 días.</li>
        <li><strong>Tu negocio:</strong> nombre, rubro, ciudad, provincia, teléfono (opcional) y zona horaria.</li>
        <li><strong>Lo que registrás en DEETA:</strong> productos y precios, stock y sus movimientos, ventas y medios de pago, caja, ingresos y gastos.</li>
        <li><strong>Datos de tus clientes que cargás vos:</strong> nombre y, si los agregás, teléfono, email, notas y la cuenta corriente (fiado y pagos).</li>
        <li><strong>Tu equipo:</strong> las personas que forman parte de cada negocio y su rol, las invitaciones (con el email invitado) y un registro de acciones sensibles, como cambios de rol, de precios o de la configuración del negocio.</li>
        <li><strong>DEETA AI:</strong> las preguntas que hacés, las respuestas y datos de uso (cantidad de consultas y de procesamiento) para controlar límites.</li>
        <li><strong>Lector desde el celular:</strong> si usás el celular como lector de códigos, guardamos la conexión temporal entre ese celular y la computadora y los códigos escaneados en esa venta.</li>
      </ul>
      <p>No usamos herramientas de publicidad ni de seguimiento de terceros.</p>

      <h2>2. Para qué la usamos</h2>
      <ul>
        <li>Para que puedas usar DEETA: iniciar sesión, registrar la actividad de tu negocio y ver tus números.</li>
        <li>Para que cada negocio vea solo su información y cada persona pueda hacer solo lo que su rol permite.</li>
        <li>Para responder tus preguntas en DEETA AI.</li>
        <li>Para mantener la seguridad del servicio, investigar errores y mejorar DEETA durante la Beta.</li>
        <li>Para responderte cuando nos escribís.</li>
      </ul>

      <h2>3. Proveedores que intervienen</h2>
      <p>Para funcionar, DEETA usa estos servicios externos:</p>
      <ul>
        <li><strong>Vercel:</strong> aloja la aplicación. Sus registros técnicos pueden incluir datos de las solicitudes, como la dirección IP.</li>
        <li><strong>Neon:</strong> base de datos donde se guarda la información de DEETA. Los servidores están en Estados Unidos.</li>
        <li><strong>Groq:</strong> procesa las consultas de DEETA AI. Solo interviene cuando usás DEETA AI.</li>
      </ul>
      <p><strong>Qué se envía a Groq cuando usás DEETA AI:</strong> tu pregunta, los últimos mensajes de esa conversación y los resultados de las consultas que DEETA hace a tu negocio para poder responder. Por ejemplo, nombres de productos, cantidades vendidas, importes y, si preguntás por fiado, nombres de clientes con su saldo. No se envía tu base completa ni los teléfonos, emails o notas de tus clientes: DEETA envía solo la información necesaria para generar cada respuesta. Groq interviene únicamente cuando usás DEETA AI, y el tratamiento que hace de esa información está sujeto a sus propias políticas vigentes.</p>
      <p>Como estos proveedores operan en Estados Unidos, la información se guarda y procesa fuera de Argentina. Al usar DEETA aceptás esta transferencia, necesaria para prestar el servicio.</p>
      <p>El catálogo sugerido de productos se armó en parte con datos públicos de Open Food Facts; DEETA no envía información tuya a Open Food Facts.</p>

      <h2>4. Datos de tus clientes</h2>
      <p>Si registrás datos de tus clientes, vos decidís qué cargar y para qué. DEETA los guarda y procesa solo para prestarte el servicio. Es tu responsabilidad contar con el permiso de tus clientes cuando la ley lo requiera y mantener esos datos actualizados.</p>

      <h2>5. Cookies</h2>
      <p>DEETA usa cookies propias necesarias para funcionar: para mantener tu sesión iniciada y, si usás el celular como lector, para la conexión con la computadora. No usamos cookies de publicidad ni de análisis de terceros.</p>

      <h2>6. Cuánto tiempo guardamos la información</h2>
      <p>Guardamos la información mientras tu cuenta esté activa, para que puedas seguir usando DEETA y consultar tu historial. Las sesiones vencen a los 30 días. Si pedís la eliminación de tu cuenta, borramos o anonimizamos tus datos. Las solicitudes de eliminación se procesan en un plazo razonable, sujeto a las obligaciones legales o técnicas aplicables. Las copias de respaldo del proveedor de base de datos pueden conservar información por un período limitado.</p>

      <h2>7. Seguridad</h2>
      <p>Tomamos medidas razonables para proteger la información, entre ellas:</p>
      <ul>
        <li>conexión cifrada (HTTPS);</li>
        <li>contraseñas guardadas como hash;</li>
        <li>separación entre negocios: cada consulta se limita al negocio de la persona que la hace;</li>
        <li>permisos por rol verificados en el servidor;</li>
        <li>los enlaces de invitación y del lector desde el celular se guardan solo como hash y vencen.</li>
      </ul>
      <p>Ningún sistema es completamente seguro. Si detectamos un problema que afecte tus datos, vamos a actuar para resolverlo.</p>

      <h2>8. Tus derechos</h2>
      <p>Podés pedirnos acceder a tus datos, corregirlos, actualizarlos o eliminarlos. Muchos los podés cambiar directamente en DEETA (por ejemplo, tu nombre en Mi cuenta o los datos de tu negocio). Para realizar consultas sobre privacidad, solicitar acceso, rectificación o eliminación de tus datos, podés comunicarte con DEETA mediante los canales de contacto disponibles en el sitio.</p>
      <p><strong>Eliminación de la cuenta:</strong> por ahora DEETA no tiene un botón para eliminar la cuenta. Podés solicitar la eliminación de tu cuenta y de los datos asociados mediante los canales de contacto disponibles en DEETA.</p>
      <p>Tomamos como marco la Ley 25.326 de Protección de los Datos Personales de Argentina. La Agencia de Acceso a la Información Pública (AAIP) es el organismo de control de esa ley y podés presentar ante ella un reclamo si considerás que no respetamos tus derechos.</p>

      <h2>9. Menores de edad</h2>
      <p>DEETA está pensado para comercios y no está dirigido específicamente a menores de edad.</p>

      <h2>10. Cambios en esta política</h2>
      <p>Podemos actualizar esta política, sobre todo durante la Beta. La versión vigente es siempre la publicada en esta página, con la fecha de arriba. Si el cambio es importante, también lo vamos a comunicar por los medios de contacto disponibles.</p>
      <p>Ver también los <Link href="/terminos">Términos y condiciones</Link>.</p>
    </LegalDocument>
  );
}
