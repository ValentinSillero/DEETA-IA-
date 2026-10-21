// Perfil público de DEETA en X (Twitter): el canal de contacto de DEETA.
// Por defecto es @valensilleroo; NEXT_PUBLIC_SOCIAL_X lo reemplaza si hace falta
// (acepta el usuario, "deeta" o "@deeta", o la URL del perfil).

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
export const DEFAULT_X_HANDLE = "valensilleroo";

export function normalizeXProfile(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  const handle = value.startsWith("@") ? value.slice(1) : value;
  if (HANDLE.test(handle)) return { handle, url: `https://x.com/${handle}` };
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const user = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if ((host === "x.com" || host === "twitter.com") && url.protocol === "https:" && HANDLE.test(user)) {
      return { handle: user, url: `https://x.com/${user}` };
    }
  } catch {
    // No es una URL: se descarta.
  }
  return null;
}

export function getXProfile() {
  return normalizeXProfile(process.env.NEXT_PUBLIC_SOCIAL_X) ?? { handle: DEFAULT_X_HANDLE, url: `https://x.com/${DEFAULT_X_HANDLE}` };
}
