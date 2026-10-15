"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/actions/business";
import { updateUserProfile } from "@/data/users";
import { requireFreshSession } from "@/lib/session";
import { profileSchema } from "@/lib/validations";

export async function updateProfileAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireFreshSession();
  const parsed = profileSchema.safeParse({ name: String(formData.get("name") ?? "") });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá tu nombre.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateUserProfile(session.user.id, parsed.data.name);
    revalidatePath("/dashboard");
    revalidatePath("/configuracion/perfil");
    return { status: "success", message: "Tu perfil se actualizó correctamente." };
  } catch (error) {
    console.error("No se pudo actualizar el perfil", error);
    return { status: "error", message: "No pudimos guardar los cambios. Intentá nuevamente." };
  }
}
