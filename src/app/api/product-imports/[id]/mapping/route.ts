import { validateProductImportForUser } from "@/data/product-imports";
import { importMappingRequestSchema } from "@/lib/product-import-api";
import { getSession } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ message: "Iniciá sesión para continuar." }, { status: 401 });
  const parsed = importMappingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Revisá las correspondencias de las columnas." }, { status: 400 });
  const { id } = await params;
  const result = await validateProductImportForUser(session.user.id, id, parsed.data.mapping, parsed.data.existingStrategy);
  if (!result) return Response.json({ message: "No encontramos esta importación." }, { status: 404 });
  if (!result.ok) return Response.json({ message: result.issues[0], issues: result.issues }, { status: 400 });
  return Response.json(result);
}
