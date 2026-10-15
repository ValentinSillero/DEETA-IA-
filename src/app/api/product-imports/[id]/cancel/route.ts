import { cancelProductImportForUser } from "@/data/product-imports";
import { getFreshSession } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session) return Response.json({ message: "Iniciá sesión para continuar." }, { status: 401 });
  const { id } = await params;
  const cancelled = await cancelProductImportForUser(session.user.id, id);
  if (!cancelled) return Response.json({ message: "Esta importación no puede cancelarse." }, { status: 409 });
  return Response.json({ ok: true });
}
