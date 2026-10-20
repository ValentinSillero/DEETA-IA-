"use client";

import { useRouter } from "next/navigation";

import { CatalogSuggestionNotice } from "@/components/catalog/catalog-suggestion";
import type { CatalogSuggestion } from "@/data/catalog";

// Alta rápida en /productos/nuevo cuando el código está en el catálogo.
export function CatalogQuickAdd({ suggestion }: { suggestion: CatalogSuggestion }) {
  const router = useRouter();
  return <CatalogSuggestionNotice suggestion={suggestion} onAdded={() => { router.replace("/productos"); router.refresh(); }} />;
}
