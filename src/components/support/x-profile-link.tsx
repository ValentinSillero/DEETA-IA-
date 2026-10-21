import { getXProfile } from "@/lib/social";

// Enlace al perfil de DEETA en X, el canal de contacto. Sin perfil configurado no se muestra.
export function XProfileLink({ children = "X (Twitter)", className = "" }: { children?: React.ReactNode; className?: string }) {
  const profile = getXProfile();
  if (!profile) return null;
  return (
    <a href={profile.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-9 items-center underline-offset-4 hover:underline ${className}`}>
      {children}<span className="sr-only">: @{profile.handle} en X (se abre en otra pestaña)</span>
    </a>
  );
}
