"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { switchActiveBusinessForUser } from "@/data/membership";
import {
  acceptInvitationForUser,
  cancelInvitationForUser,
  changeMemberRoleForUser,
  createInvitationForUser,
  regenerateInvitationForUser,
  removeMemberForUser,
} from "@/data/team";
import { getServerEnv } from "@/lib/env";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { requireFreshSession } from "@/lib/session";

export type TeamActionState = { status: "idle" | "success" | "error"; message?: string; link?: string; expiresAt?: string };

const issueMessages = {
  FORBIDDEN: "Tu rol no permite hacer este cambio.",
  SELF: "No podés cambiar tu propio rol ni quitarte del negocio desde acá.",
  OWNER_ONLY: "Solo un dueño puede asignar o quitar el rol de dueño.",
  LAST_OWNER: "El negocio necesita al menos un dueño.",
  ALREADY_MEMBER: "Esa persona ya forma parte del negocio.",
  NOT_FOUND: "No encontramos a esa persona en el negocio.",
} as const;

const inviteSchema = z.object({
  email: z.email("Ingresá un email válido.").max(160).transform((value) => value.trim().toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES, { message: "Elegí un rol." }),
});

function invitationLink(token: string) {
  // El enlace se arma con la URL pública configurada en el servidor, no con datos del pedido.
  return `${getServerEnv().BETTER_AUTH_URL.replace(/\/$/, "")}/invitacion/${token}`;
}

export async function inviteMemberAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await requireFreshSession();
  const parsed = inviteSchema.safeParse({ email: String(formData.get("email") ?? ""), role: String(formData.get("role") ?? "") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const result = await createInvitationForUser(session.user.id, parsed.data);
  if (!result.ok) return { status: "error", message: issueMessages[result.reason] };
  revalidatePath("/configuracion/equipo");
  return { status: "success", message: "Invitación creada. Copiá el enlace y enviáselo a la persona.", link: invitationLink(result.token), expiresAt: result.expiresAt.toISOString() };
}

export async function regenerateInvitationAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await requireFreshSession();
  const result = await regenerateInvitationForUser(session.user.id, String(formData.get("invitationId") ?? ""));
  if (!result.ok) return { status: "error", message: issueMessages[result.reason] };
  revalidatePath("/configuracion/equipo");
  return { status: "success", message: "Generamos un enlace nuevo. El anterior ya no funciona.", link: invitationLink(result.token), expiresAt: result.expiresAt.toISOString() };
}

export async function cancelInvitationAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await requireFreshSession();
  const ok = await cancelInvitationForUser(session.user.id, String(formData.get("invitationId") ?? ""));
  if (!ok) return { status: "error", message: "No pudimos cancelar la invitación." };
  revalidatePath("/configuracion/equipo");
  return { status: "success", message: "Invitación cancelada." };
}

export async function changeMemberRoleAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await requireFreshSession();
  const role = z.enum(ASSIGNABLE_ROLES).safeParse(String(formData.get("role") ?? ""));
  if (!role.success) return { status: "error", message: "Elegí un rol válido." };
  const result = await changeMemberRoleForUser(session.user.id, String(formData.get("userId") ?? ""), role.data);
  if (!result.ok) return { status: "error", message: issueMessages[result.reason] };
  revalidatePath("/configuracion/equipo");
  return { status: "success", message: "Rol actualizado. Se aplica desde la próxima pantalla que abra esa persona." };
}

export async function removeMemberAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const session = await requireFreshSession();
  const result = await removeMemberForUser(session.user.id, String(formData.get("userId") ?? ""));
  if (!result.ok) return { status: "error", message: issueMessages[result.reason] };
  revalidatePath("/configuracion/equipo");
  return { status: "success", message: "La persona ya no forma parte del negocio. Su historial se conserva." };
}

export type AcceptState = { status: "idle" | "error"; message?: string };

export async function acceptInvitationAction(_state: AcceptState, formData: FormData): Promise<AcceptState> {
  const session = await requireFreshSession();
  const result = await acceptInvitationForUser(session.user.id, session.user.email, String(formData.get("token") ?? ""));
  if (!result.ok) {
    const messages = {
      INVALID: "Este enlace de invitación no es válido.",
      EXPIRED: "La invitación venció. Pedile a quien te invitó que genere un enlace nuevo.",
      USED: "Esta invitación ya fue utilizada.",
      CANCELLED: "Esta invitación fue cancelada.",
      WRONG_EMAIL: "Esta invitación es para otro email. Iniciá sesión con la cuenta a la que te invitaron.",
      ALREADY_MEMBER: "Ya formás parte de este negocio.",
    } as const;
    return { status: "error", message: messages[result.reason] };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function switchBusinessAction(formData: FormData) {
  const session = await requireFreshSession();
  // Se valida en la base que la persona pertenezca al negocio elegido.
  await switchActiveBusinessForUser(session.user.id, String(formData.get("businessId") ?? ""));
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
