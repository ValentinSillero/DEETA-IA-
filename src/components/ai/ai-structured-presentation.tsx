import { AiBusinessOverview } from "@/components/ai/ai-business-overview";
import { AiExpenseBreakdown, AiMetricCard } from "@/components/ai/ai-metric-presentation";
import { AiProductPresentation } from "@/components/ai/ai-product-presentation";
import type { AiPresentation } from "@/lib/ai/presentation";

export function AiStructuredPresentation({ presentation }: { presentation: AiPresentation }) {
  if (presentation.type === "business-overview") return <AiBusinessOverview presentation={presentation} />;
  if (presentation.type === "metric") return <AiMetricCard presentation={presentation} />;
  if (presentation.type === "expense-breakdown") return <AiExpenseBreakdown presentation={presentation} />;
  return <AiProductPresentation presentation={presentation} />;
}
