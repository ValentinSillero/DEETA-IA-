import { updateProductImportRowForUser } from "@/data/product-imports";
import { importRowRequestSchema } from "@/lib/product-import-api";
import { getFreshSession } from "@/lib/session";
import { forbiddenResponse } from "@/lib/action-guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> },
) {
  const session = await getFreshSession();
  if (!session) return Response.json({ message: "Iniciá sesión para continuar." }, { status: 401 });
  const forbidden = await forbiddenResponse(session.user.id, "PRODUCT_IMPORT");
  if (forbidden) return forbidden;
  const parsed = importRowRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisá los datos de esta fila." }, { status: 400 });
  const { id, rowId } = await params;
  const result = await updateProductImportRowForUser(session.user.id, id, rowId, parsed.data);
  if (!result) return Response.json({ message: "No encontramos esta fila o ya no puede modificarse." }, { status: 404 });
  return Response.json(result);
}
