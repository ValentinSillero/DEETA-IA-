import { searchCatalogForUser } from "@/data/catalog";
import { FORBIDDEN_MESSAGE } from "@/lib/action-guard";
import { catalogSearchSchema, effectiveCatalogQuery } from "@/lib/catalog";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Búsqueda del catálogo sugerido, paginada. Es solo lectura: alcanza con la
// sesión de la cookie firmada de Better Auth; la membresía y el permiso se
// validan en la misma consulta a la base. El negocio sale de la sesión.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ message: "Iniciá sesión para ver el catálogo." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const kiosk = params.get("kiosco");
  const input = catalogSearchSchema.parse({
    query: effectiveCatalogQuery(params.get("q") ?? ""),
    category: params.get("categoria"),
    kioskOnly: kiosk === "1" ? true : kiosk === "0" ? false : null,
    page: params.get("pagina") ?? 1,
  });
  try {
    const result = await searchCatalogForUser(session.user.id, input);
    if (!result) return Response.json({ message: FORBIDDEN_MESSAGE }, { status: 403 });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("No se pudo buscar en el catálogo", error);
    return Response.json({ message: "No pudimos buscar en el catálogo. Intentá nuevamente." }, { status: 500 });
  }
}
