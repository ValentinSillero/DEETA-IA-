// Contacto por WhatsApp durante la beta: número, mensajes y enlace en un solo
// lugar. Los mensajes nunca incluyen datos de la persona ni del negocio.

export const SUPPORT_TOPICS = ["question", "problem", "suggestion"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  question: "Tengo una duda",
  problem: "Encontré un problema",
  suggestion: "Quiero sugerir una mejora",
};

export const SUPPORT_TOPIC_HINTS: Record<SupportTopic, string> = {
  question: "Algo no se entiende o no sabés cómo hacerlo.",
  problem: "Algo no funcionó como esperabas.",
  suggestion: "Algo que le falta a DEETA o que harías distinto.",
};

// Secciones conocidas del panel. Solo se usa el nombre visible, nunca IDs.
const SECTIONS: Record<string, string> = {
  dashboard: "Inicio",
  vender: "Vender",
  productos: "Productos",
  ventas: "Ventas",
  caja: "Caja",
  gastos: "Gastos",
  analisis: "Análisis",
  "deeta-ai": "DEETA AI",
  configuracion: "Configuración",
};

export const LANDING_SUPPORT_MESSAGE = "Hola, estoy probando DEETA y quería comentarte...";

// Clave de sección a partir de la ruta actual (/caja/123 → "caja").
export function supportSectionKey(pathname: string | null | undefined) {
  const key = pathname?.split("/").find(Boolean);
  return key && key in SECTIONS ? key : null;
}

// Nombre visible de la sección; cualquier valor desconocido se descarta.
export function supportSectionLabel(key: string | null | undefined) {
  return key && Object.hasOwn(SECTIONS, key) ? SECTIONS[key] : null;
}

export function supportMessage(topic: SupportTopic, sectionLabel?: string | null) {
  const where = sectionLabel ? ` en la sección ${sectionLabel}` : "";
  switch (topic) {
    case "question": return `Hola, estoy usando DEETA${where} y tengo una duda: `;
    case "problem": return `Hola, encontré un problema usando DEETA${where}: `;
    case "suggestion": return `Hola, estoy probando DEETA y quería sugerir una mejora${sectionLabel ? ` para la sección ${sectionLabel}` : ""}: `;
  }
}

// Formato internacional sin "+", espacios ni guiones, como pide wa.me.
export function normalizeWhatsappNumber(raw: string | null | undefined) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function buildWhatsappLink(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// El número es público (aparece en el enlace), por eso puede ser NEXT_PUBLIC.
// Si falta o es inválido, los accesos a WhatsApp se ocultan.
export function getSupportWhatsappNumber() {
  return normalizeWhatsappNumber(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP);
}
