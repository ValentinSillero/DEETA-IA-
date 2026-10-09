import { planDeetaAiRequest } from "@/lib/ai/planner";
import type { AiConversationMessage, AiPreparedTool } from "@/lib/ai/types";

type UnknownRecord = Record<string, unknown>;
type ToolEvidence = { tool?: unknown; data?: unknown };

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function period(value: unknown) {
  const candidate = record(value);
  return Boolean(candidate && text(candidate.label) && text(candidate.start) && text(candidate.end));
}

function productRows(value: unknown, requirements: Array<"stock" | "sales" | "margin">) {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    const item = record(entry);
    if (!item || !(text(item.productName) || text(item.name))) return false;
    if (requirements.includes("stock") && !number(item.currentStock)) return false;
    if (requirements.includes("sales") && !(number(item.unitsSold) || number(item.units))) return false;
    if (requirements.includes("margin") && !(number(item.grossMarginCents) && text(item.grossMargin))) return false;
    return true;
  });
}

export function isAiToolResultAnswerable(tool: string, value: unknown) {
  const data = record(value);
  if (!data) return false;
  if (tool === "get_product_sales_ranking") {
    return period(data.period) && typeof data.hasProducts === "boolean" && productRows(data.products, ["stock", "sales"]);
  }
  if (tool === "get_top_product_analysis") {
    if (!period(data.period) || typeof data.hasSales !== "boolean") return false;
    if (!data.hasSales) return data.product === null;
    const current = record(data.current);
    return text(data.product) && Boolean(current && number(current.units) && number(current.salesCents) && text(current.sales));
  }
  if (tool === "get_inventory_analysis") {
    return text(data.focus) && number(data.days) && productRows(data.products, ["stock"]);
  }
  if (tool === "getProductProfitability") {
    return period(data.period)
      && productRows(data.mostProfitable, ["sales", "margin"])
      && productRows(data.lowestMargin, ["sales", "margin"]);
  }
  if (tool === "get_period_summary" || tool === "get_business_period_analysis") {
    return period(data.period)
      && number(data.salesCents) && number(data.operations) && number(data.grossMarginCents)
      && number(data.expensesCents) && number(data.estimatedResultCents);
  }
  if (tool === "get_expense_breakdown") {
    return period(data.period) && number(data.totalCents) && number(data.previousTotalCents)
      && Array.isArray(data.categories) && data.categories.every((entry) => {
        const category = record(entry);
        return Boolean(category && text(category.name) && number(category.amountCents)
          && number(category.previousAmountCents) && number(category.differenceCents));
      });
  }
  if (tool === "get_cash_summary") return data.status === "OPEN" || data.status === "CLOSED";
  if (tool === "get_product_performance") return period(data.period) && productRows(data.matches, ["stock"]);
  if (tool === "get_sales_patterns") return period(data.period) && text(data.focus) && typeof data.sufficientData === "boolean";
  if (tool === "getAutomaticInsights") return period(data.period) && Array.isArray(data.insights);
  return true;
}

export function evidenceAnswersPlan(plan: AiPreparedTool, evidence: unknown[]) {
  return evidence.some((entry) => {
    const candidate = record(entry) as ToolEvidence | null;
    return candidate?.tool === plan.name && isAiToolResultAnswerable(plan.name, candidate.data);
  });
}

export function fallbackPlanForEvidence(messages: AiConversationMessage[], evidence: unknown[]): AiPreparedTool | undefined {
  const question = messages.findLast((message) => message.role === "USER")?.content;
  if (!question) return undefined;
  const plan = planDeetaAiRequest(question, messages);
  return plan && !evidenceAnswersPlan(plan, evidence) ? plan : undefined;
}
