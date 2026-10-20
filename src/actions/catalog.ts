"use server";

import { revalidatePath } from "next/cache";

import { addCatalogProductsForUser } from "@/data/catalog";
import { permissionDenied } from "@/lib/action-guard";
import { catalogAddSchema } from "@/lib/catalog";
import { requireFreshSession } from "@/lib/session";

export type CatalogAddState = {
  status: "idle" | "success" | "error";
  message?: string;
  created?: number;
  skipped?: number;
  // Errores por código de barras y campo, para marcarlos en la confirmación.
  errors?: Record<string, Record<string, string>>;
};

type RawItem = { barcode: string; salePriceCents: string; costPriceCents: string; initialStock: string; minimumStock: string };

export async function addCatalogProductsAction(rawItems: RawItem[]): Promise<CatalogAddState> {
  const session = await requireFreshSession();
  const denied = await permissionDenied(session.user.id, "PRODUCT_CREATE");
  if (denied) return { status: "error", message: denied };

  const parsed = catalogAddSchema.safeParse(Array.isArray(rawItems) ? rawItems.map((item) => ({
    barcode: String(item?.barcode ?? ""),
    salePriceCents: String(item?.salePriceCents ?? ""),
    costPriceCents: String(item?.costPriceCents ?? ""),
    initialStock: String(item?.initialStock ?? ""),
    minimumStock: String(item?.minimumStock ?? ""),
  })) : []);
  if (!parsed.success) {
    const errors: CatalogAddState["errors"] = {};
    let general: string | undefined;
    for (const issue of parsed.error.issues) {
      const [index, field] = issue.path;
      const barcode = typeof index === "number" ? rawItems[index]?.barcode : undefined;
      if (barcode && typeof field === "string") (errors[barcode] ??= {})[field] ??= issue.message;
      else general ??= issue.message;
    }
    return { status: "error", message: general ?? "Revisá los datos marcados.", errors };
  }

  try {
    const result = await addCatalogProductsForUser(session.user.id, parsed.data);
    if (!result.ok) return { status: "error", message: "Tu rol en este negocio no permite hacer esta acción." };
    revalidatePath("/productos");
    revalidatePath("/dashboard");
    const skippedText = result.skipped.length > 0 ? ` ${result.skipped.length} ya estaban en tu negocio y no se repitieron.` : "";
    return {
      status: "success",
      created: result.created,
      skipped: result.skipped.length,
      message: result.created === 1 ? `Agregamos 1 producto.${skippedText}` : `Agregamos ${result.created} productos.${skippedText}`,
    };
  } catch (error) {
    console.error("No se pudieron agregar productos del catálogo", error);
    return { status: "error", message: "No pudimos agregar los productos. Intentá nuevamente." };
  }
}
