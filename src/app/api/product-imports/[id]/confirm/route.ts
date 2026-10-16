import { revalidatePath } from "next/cache";

import { confirmProductImportForUser } from "@/data/product-imports";
import { getFreshSession } from "@/lib/session";
import { forbiddenResponse } from "@/lib/action-guard";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session) return Response.json({ message: "Iniciá sesión para continuar." }, { status: 401 });
  const forbidden = await forbiddenResponse(session.user.id, "PRODUCT_IMPORT");
  if (forbidden) return forbidden;
  const { id } = await params;
  try {
    const result = await confirmProductImportForUser(session.user.id, id);
    if (!result) return Response.json({ message: "No encontramos esta importación." }, { status: 404 });
    if ("unavailable" in result) return Response.json({ message: "Esta importación no está lista para confirmarse." }, { status: 409 });
    revalidatePath("/productos");
    revalidatePath("/dashboard");
    return Response.json(result);
  } catch (error) {
    console.error("No se pudo completar la importación de productos", error);
    return Response.json({ message: "No pudimos completar la importación. Ningún cambio parcial quedó guardado." }, { status: 500 });
  }
}
