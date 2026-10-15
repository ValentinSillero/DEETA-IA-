import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";

const iconSource = "/brand/deeta-icon.png";
const logoSource = "/brand/deeta-logo.png";

export function DeetaIcon({ className = "size-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={iconSource}
      width={40}
      height={40}
      unoptimized
      priority={priority}
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function DeetaProductMark({ compact = false, href = "/dashboard" }: { compact?: boolean; href?: Route }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3" aria-label="DEETA, inicio">
      <DeetaIcon className={compact ? "size-8" : "size-9"} priority />
      {!compact && <span className="font-display text-xl font-extrabold tracking-[-0.03em] text-ink">DEETA</span>}
    </Link>
  );
}

export function DeetaBrandLogo({ href = "/", className = "w-40" }: { href?: Route; className?: string }) {
  return (
    <Link href={href} className="inline-flex" aria-label="DEETA, inicio">
      <Image
        src={logoSource}
        width={180}
        height={60}
        unoptimized
        priority
        alt=""
        className={`h-auto object-contain ${className}`}
      />
    </Link>
  );
}
