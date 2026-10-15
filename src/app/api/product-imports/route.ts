import { createProductImportForUser } from "@/data/product-imports";
import { PRODUCT_IMPORT_LIMITS, parseProductImportFile } from "@/lib/product-imports";
import { getFreshSession } from "@/lib/session";

export const runtime = "nodejs";

const allowedMimeTypes = {
  CSV: new Set(["", "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"]),
  XLSX: new Set(["", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]),
} as const;

function importType(filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  return extension === "csv" ? "CSV" : extension === "xlsx" ? "XLSX" : null;
}

function parseErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "TOO_MANY_ROWS") return `El archivo supera el límite de ${PRODUCT_IMPORT_LIMITS.maxRows.toLocaleString("es-UY")} productos.`;
  if (code === "TOO_MANY_COLUMNS") return `El archivo tiene más de ${PRODUCT_IMPORT_LIMITS.maxColumns} columnas.`;
  if (code === "CELL_TOO_LONG") return "Hay una celda demasiado larga. Revisá el archivo e intentá nuevamente.";
  if (code === "EMPTY_FILE") return "El archivo no tiene productos para importar.";
  return "No pudimos leer este archivo. Probá con un Excel o CSV.";
}

export async function POST(request: Request) {
  const session = await getFreshSession();
  if (!session) return Response.json({ message: "Iniciá sesión para importar productos." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ message: "Seleccioná un archivo Excel o CSV." }, { status: 400 });
  if (file.size < 1) return Response.json({ message: "El archivo está vacío." }, { status: 400 });
  if (file.size > PRODUCT_IMPORT_LIMITS.maxFileBytes) {
    return Response.json({ message: `El archivo puede pesar hasta ${PRODUCT_IMPORT_LIMITS.maxFileBytes / 1024 / 1024} MB.` }, { status: 413 });
  }

  const type = importType(file.name);
  if (!type || !allowedMimeTypes[type].has(file.type.toLowerCase())) {
    return Response.json({ message: "Elegí un archivo .xlsx o .csv válido." }, { status: 415 });
  }

  try {
    const parsed = await parseProductImportFile(Buffer.from(await file.arrayBuffer()), type);
    const filename = (file.name.split(/[\\/]/).pop() || "productos").slice(0, 180);
    const created = await createProductImportForUser(session.user.id, {
      originalFilename: filename,
      fileType: type,
      fileSize: file.size,
      headers: parsed.headers,
      rows: parsed.rows,
    });
    if (!created) return Response.json({ message: "No tenés permiso para importar productos." }, { status: 403 });
    return Response.json({ importId: created.id, suggestedMapping: parsed.suggestedMapping }, { status: 201 });
  } catch (error) {
    return Response.json({ message: parseErrorMessage(error) }, { status: 400 });
  }
}
