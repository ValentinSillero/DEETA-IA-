import type { Metadata } from "next";
import Link from "next/link";

import { Complete, LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de DEETA durante su etapa Beta.",
};

// Fecha fija: se actualiza a mano cuando cambia el texto.
const UPDATED_AT = "20 de octubre de 2026";

export default function TermsPage() {
  return (
    <LegalDocument title="Términos y condiciones" updatedAt={UPDATED_AT}>
      <h2>1. Qué es DEETA</h2>
      <p>DEETA es una aplicación web de gestión para comercios. Permite registrar productos, stock, ventas, caja, gastos, clientes y cuentas corrientes, trabajar en equipo con distintos roles, ver análisis del negocio y hacer consultas a DEETA AI, un asistente que responde con los datos que cargaste.</p>
      <p>DEETA es una herramienta de gestión. Las métricas, los análisis y las respuestas de DEETA AI son orientativos y dependen de los datos cargados: <strong>no reemplazan el asesoramiento contable, fiscal o impositivo, financiero ni legal</strong>, y no garantizamos que sean exactos en todos los casos.</p>
      <p>El responsable de DEETA es <Complete>nombre completo o razón social</Complete>, con domicilio en <Complete>domicilio o ciudad</Complete>.</p>

      <h2>2. Etapa Beta</h2>
      <p>DEETA está en etapa Beta y por ahora es gratuita. Eso significa que:</p>
      <ul>
        <li>las funciones pueden cambiar, agregarse o quitarse;</li>
        <li>puede haber errores, interrupciones o momentos sin servicio;</li>
        <li>no garantizamos disponibilidad continua ni que el servicio funcione sin fallas.</li>
      </ul>
      <p>Te recomendamos revisar la información importante y conservar los respaldos que necesites para tu negocio.</p>

      <h2>3. Tu cuenta</h2>
      <p>Para usar DEETA tenés que crear una cuenta con tu nombre, un email y una contraseña. Te pedimos que los datos sean reales.</p>
      <p>Sos responsable de cuidar tu contraseña y de lo que se haga con tu cuenta. Si creés que alguien accedió sin permiso, cambiá la contraseña y avisanos.</p>
      <p>Si sumás personas a tu negocio con el sistema de invitaciones, sos responsable de elegir a quién invitás y qué rol le das. Cada persona usa su propia cuenta.</p>

      <h2>4. Los datos que cargás</h2>
      <p>La información de tu negocio es tuya: productos, precios, ventas, caja, gastos, clientes y todo lo que registres. Nos das permiso para guardarla y procesarla solo para prestarte el servicio, como se explica en la <Link href="/privacidad">Política de privacidad</Link>.</p>
      <p>Sos responsable de que lo que cargás sea correcto y de tener derecho a cargarlo. En particular, si registrás datos de tus clientes (por ejemplo, nombre, teléfono o lo que te deben), tenés que contar con su permiso cuando la ley lo requiera.</p>
      <p>El catálogo sugerido de productos se ofrece como ayuda para cargar productos más rápido. Parte de esos datos provienen de Open Food Facts (licencia ODbL) y pueden tener errores: revisá nombres, tamaños y precios antes de vender.</p>

      <h2>5. Uso adecuado</h2>
      <p>Al usar DEETA te comprometés a no:</p>
      <ul>
        <li>usarlo para actividades ilegales o para registrar información que no tenés derecho a tratar;</li>
        <li>intentar acceder a cuentas o negocios que no son tuyos, ni vulnerar la seguridad del servicio;</li>
        <li>sobrecargar el servicio de forma intencional ni usar programas automáticos para extraer información;</li>
        <li>copiar, revender o modificar DEETA sin autorización.</li>
      </ul>
      <p>Si detectamos un uso que infringe estos términos o pone en riesgo el servicio o a otras personas, podemos suspender o limitar el acceso a la cuenta.</p>

      <h2>6. Propiedad intelectual</h2>
      <p>DEETA, su diseño, su código y su marca pertenecen a <Complete>nombre completo o razón social</Complete>. Usar el servicio no te da derechos sobre ellos. Los datos que cargás siguen siendo tuyos.</p>

      <h2>7. Responsabilidad</h2>
      <p>Trabajamos para que DEETA funcione bien y tus datos estén seguros, pero durante la Beta el servicio se ofrece “tal como está”. En la medida que lo permita la ley, no somos responsables por decisiones tomadas solo en base a los números o las respuestas de DEETA, ni por pérdidas causadas por errores, interrupciones o datos cargados de forma incorrecta.</p>

      <h2>8. Cambios en estos términos</h2>
      <p>Podemos actualizar estos términos, sobre todo mientras DEETA está en Beta. La versión vigente es siempre la publicada en esta página, con la fecha de arriba. Si el cambio es importante, también lo vamos a comunicar por los medios de contacto disponibles.</p>

      <h2>9. Baja</h2>
      <p>Podés dejar de usar DEETA cuando quieras. Para pedir la eliminación de tu cuenta y de tus datos, escribinos a <Complete>email de contacto</Complete>.</p>

      <h2>10. Contacto</h2>
      <p>Para consultas sobre estos términos: <Complete>email de contacto</Complete>.</p>
      <p>Estos términos se rigen por las leyes de la República Argentina. <Complete>jurisdicción aplicable, si querés fijarla</Complete></p>
    </LegalDocument>
  );
}
