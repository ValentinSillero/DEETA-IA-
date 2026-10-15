"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createProductForUser,
  createStockMovementForUser,
  setProductActiveForUser,
  updateProductForUser,
} from "@/data/products";
import { productCreateSchema, productEditSchema, stockMovementSchema } from "@/lib/product-validations";
import { requireFreshSession } from "@/lib/session";

export type ProductFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  stockResult?: {
    previousStock: number;
    resultingStock: number;
    quantity: number;
  };
};

function productValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    costPriceCents: String(formData.get("costPriceCents") ?? ""),
    salePriceCents: String(formData.get("salePriceCents") ?? ""),
    initialStock: String(formData.get("initialStock") ?? "0"),
    minimumStock: String(formData.get("minimumStock") ?? "0"),
    barcode: String(formData.get("barcode") ?? ""),
  };
}

function duplicateBarcode(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("product_business_barcode_unique") || error.message.includes("23505"))
  );
}

export async function createProductAction(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireFreshSession();
  const parsed = productCreateSchema.safeParse(productValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  let productId: string;
  try {
    const created = await createProductForUser(session.user.id, parsed.data);
    productId = created.id;
  } catch (error) {
    console.error("No se pudo crear el producto", error);
    return {
      status: "error",
      message: duplicateBarcode(error)
        ? "Ya existe un producto con ese código de barras."
        : "No pudimos crear el producto. Intentá nuevamente.",
    };
  }

  revalidatePath("/productos");
  revalidatePath("/dashboard");
  redirect(`/productos/${productId}`);
}

export async function updateProductAction(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireFreshSession();
  const productId = String(formData.get("productId") ?? "");
  const values = productValues(formData);
  const parsed = productEditSchema.safeParse(values);

  if (!productId || !parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos marcados.",
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await updateProductForUser(session.user.id, productId, parsed.data);
    if (!updated) return { status: "error", message: "No pudimos encontrar ese producto." };
  } catch (error) {
    console.error("No se pudo actualizar el producto", error);
    return {
      status: "error",
      message: duplicateBarcode(error)
        ? "Ya existe un producto con ese código de barras."
        : "No pudimos guardar los cambios. Intentá nuevamente.",
    };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
  revalidatePath("/dashboard");
  return { status: "success", message: "Los cambios se guardaron correctamente." };
}

export async function stockMovementAction(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireFreshSession();
  const productId = String(formData.get("productId") ?? "");
  const parsed = stockMovementSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });

  if (!productId || !parsed.success) {
    return {
      status: "error",
      message: "Revisá la cantidad ingresada.",
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await createStockMovementForUser(session.user.id, productId, parsed.data);
    if (!result.ok) {
      const message =
        result.reason === "INSUFFICIENT_STOCK"
          ? "No hay suficiente mercadería para registrar esa salida."
          : result.reason === "INACTIVE"
            ? "Reactivá el producto antes de modificar su cantidad."
            : "No pudimos encontrar ese producto.";
      return { status: "error", message };
    }

    revalidatePath("/productos");
    revalidatePath(`/productos/${productId}`);
    revalidatePath("/dashboard");
    return {
      status: "success",
      message: "Stock actualizado correctamente.",
      stockResult: result,
    };
  } catch (error) {
    console.error("No se pudo registrar el movimiento", error);
    return { status: "error", message: "No pudimos actualizar el stock. Intentá nuevamente." };
  }
}

export async function setProductActiveAction(
  _previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const session = await requireFreshSession();
  const productId = String(formData.get("productId") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!productId) return { status: "error", message: "No pudimos encontrar ese producto." };

  try {
    const updated = await setProductActiveForUser(session.user.id, productId, isActive);
    if (!updated) return { status: "error", message: "No pudimos encontrar ese producto." };
  } catch (error) {
    console.error("No se pudo cambiar el estado del producto", error);
    return { status: "error", message: "No pudimos guardar el cambio. Intentá nuevamente." };
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${productId}`);
  revalidatePath("/dashboard");
  return {
    status: "success",
    message: isActive ? "El producto volvió a estar activo." : "El producto se desactivó.",
  };
}
