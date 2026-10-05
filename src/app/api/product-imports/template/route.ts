import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const headers = [
    "Nombre",
    "Código de barras",
    "Precio de compra",
    "Precio de venta",
    "Stock inicial",
    "Stock mínimo",
    "Descripción",
  ];
  const example = ["Yerba 1 kg", "001234567890", "1500,00", "2100,00", "20", "5", "Paquete tradicional"];
  const csv = `\uFEFF${headers.map((value) => `"${value}"`).join(";")}\r\n${example.map((value) => `"${value}"`).join(";")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-productos-deeta.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
