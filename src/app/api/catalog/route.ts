import { searchCatalogForUser } from "@/data/catalog";
import { forbiddenResponse } from "@/lib/action-guard";
import { catalogSearchSchema } from "@/lib/catalog";
import { getFreshSession } from "@/lib/session";

export const runtime = "nodejs";

// Búsqueda del catálogo sugerido, paginada. El negocio sale de la sesión.
export async function GET(request: Request) {
  const session = await getFreshSession();
  if (!session) return Response.json({ message: "Iniciá sesión para ver el catálogo." }, { status: 401 });
  const forbidden = await forbiddenResponse(session.user.id, "PRODUCT_CREATE");
  if (forbidden) return forbidden;

  const params = new URL(request.url).searchParams;
  const input = catalogSearchSchema.parse({
    query: params.get("q") ?? "",
    category: params.get("categoria"),
    kioskOnly: params.get("kiosco") === "1",
    page: params.get("pagina") ?? 1,
  });
  try {
    const result = await searchCatalogForUser(session.user.id, input);
    if (!result) return Response.json({ message: "Tu rol en este negocio no permite hacer esta acción." }, { status: 403 });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("No se pudo buscar en el catálogo", error);
    return Response.json({ message: "No pudimos buscar en el catálogo. Intentá nuevamente." }, { status: 500 });
  }
}
