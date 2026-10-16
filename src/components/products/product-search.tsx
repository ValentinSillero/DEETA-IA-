"use client";

import { Search, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ProductSearch({ initialValue, label = "Buscar productos", placeholder = "Buscar por nombre o código" }: { initialValue: string; label?: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalizedValue = value.trim();
      if (normalizedValue === (searchParams.get("buscar") ?? "")) return;
      const params = new URLSearchParams(searchParams.toString());
      if (normalizedValue) params.set("buscar", normalizedValue);
      else params.delete("buscar");
      const query = params.toString();
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [pathname, router, searchParams, value]);

  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="field-input pl-12 pr-11"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-brand-soft"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}
