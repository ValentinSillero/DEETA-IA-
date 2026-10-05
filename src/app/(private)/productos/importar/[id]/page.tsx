import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductImportWorkflow, type ProductImportView } from "@/components/products/import-workflow";
import { getProductImportForUser, getProductImportRowsForUser } from "@/data/product-imports";
import { detectProductImportMapping, productImportEditableValues, type ProductImportMapping } from "@/lib/product-imports";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Revisar importación" };

export default async function ProductImportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const batch = await getProductImportForUser(session.user.id, id);
  if (!batch) notFound();
  const rows = await getProductImportRowsForUser(session.user.id, id);
  if (!rows) notFound();
  const mapping = (batch.mapping as ProductImportMapping | null) ?? detectProductImportMapping(batch.headers);
  const view: ProductImportView = {
    id: batch.id,
    originalFilename: batch.originalFilename,
    status: batch.status,
    headers: batch.headers,
    mapping,
    existingStrategy: batch.existingStrategy,
    totalRows: batch.totalRows,
    readyRows: batch.readyRows,
    warningRows: batch.warningRows,
    errorRows: batch.errorRows,
    importedRows: batch.importedRows,
    updatedRows: batch.updatedRows,
    skippedRows: batch.skippedRows,
    rows: rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      rawValues: row.rawValues,
      status: row.status,
      issues: row.issues,
      included: row.included,
      name: row.name,
      barcode: row.barcode,
      costPriceCents: row.costPriceCents,
      salePriceCents: row.salePriceCents,
      initialStock: row.initialStock,
      minimumStock: row.minimumStock,
      existingProductId: row.existingProductId,
      editable: productImportEditableValues(row, mapping),
    })),
  };
  return <div className="mx-auto max-w-6xl"><ProductImportWorkflow view={view} /></div>;
}
