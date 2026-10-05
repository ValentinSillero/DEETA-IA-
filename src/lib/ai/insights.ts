export function buildDeterministicInsights(values: {
  lowStockCount: number;
  salesComparisonPercent: number | null;
  expensesComparisonPercent: number | null;
}) {
  const insights: string[] = [];
  if (values.lowStockCount > 0) insights.push(`Hay ${values.lowStockCount} ${values.lowStockCount === 1 ? "producto" : "productos"} con poco stock.`);
  if (values.salesComparisonPercent !== null && values.salesComparisonPercent !== 0) {
    insights.push(`Hoy vendiste ${Math.abs(values.salesComparisonPercent).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% ${values.salesComparisonPercent > 0 ? "más" : "menos"} que ayer.`);
  }
  if (values.expensesComparisonPercent !== null && values.expensesComparisonPercent > 0) {
    insights.push(`Los gastos de hoy están ${values.expensesComparisonPercent.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% por encima de ayer.`);
  }
  return insights;
}
