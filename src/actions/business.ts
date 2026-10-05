"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createBusinessForUser,
  getBusinessForUser,
  updateBusinessForUser,
} from "@/data/businesses";
import { requireSession } from "@/lib/session";
import { businessSchema } from "@/lib/validations";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

function valuesFrom(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    city: String(formData.get("city") ?? ""),
    province: String(formData.get("province") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    timezone: String(formData.get("timezone") ?? "America/Argentina/Buenos_Aires"),
  };
}

export async function createBusinessAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = businessSchema.safeParse(valuesFrom(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingBusiness = await getBusinessForUser(session.user.id);
  if (existingBusiness) redirect("/dashboard");

  try {
    await createBusinessForUser(session.user.id, parsed.data);
  } catch (error) {
    console.error("No se pudo crear el negocio", error);
    return {
      status: "error",
      message: "No pudimos crear tu negocio. Intentá nuevamente.",
    };
  }

  redirect("/dashboard");
}

export async function updateBusinessAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = businessSchema.safeParse(valuesFrom(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await updateBusinessForUser(session.user.id, parsed.data);
    if (!updated) {
      return {
        status: "error",
        message: "No tenés permiso para modificar este negocio.",
      };
    }
    revalidatePath("/dashboard");
    revalidatePath("/configuracion/negocio");
    return { status: "success", message: "Los cambios se guardaron correctamente." };
  } catch (error) {
    console.error("No se pudo actualizar el negocio", error);
    return {
      status: "error",
      message: "No pudimos guardar los cambios. Intentá nuevamente.",
    };
  }
}
