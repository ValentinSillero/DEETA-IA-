// Después de iniciar sesión solo se vuelve a destinos internos conocidos (por
// ahora, el enlace de invitación). Evita redirecciones abiertas a otros sitios.
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\/invitacion\/[\w-]{20,100}$/.test(value) ? value : null;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`;
}
