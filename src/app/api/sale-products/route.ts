import { getSaleProductsForUser } from "@/data/sales";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Búsqueda de productos para Vender cuando el negocio tiene muchos: devuelve
// hasta 30 resultados del negocio activo (la consulta valida la membresía y que
// el rol pueda vender). Solo lectura: usa la sesión de la cookie firmada.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ message: "Iniciá sesión para vender." }, { status: 401 });
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (query.length < 2) return Response.json({ items: [] });
  try {
    const items = await getSaleProductsForUser(session.user.id, query, 30);
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("No se pudo buscar productos para vender", error);
    return Response.json({ message: "No pudimos buscar productos. Intentá nuevamente." }, { status: 500 });
  }
}
