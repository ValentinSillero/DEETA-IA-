import { describe, expect, it } from "vitest";

import { restrictedRequestReply } from "@/lib/ai/guardrails";
import { planDeetaAiRequest } from "@/lib/ai/planner";
import { buildAiPresentation, isAiPresentation } from "@/lib/ai/presentation";
import { balanceAfterMovement, balanceFromMovements, customerPaymentSchema, customerSchema, signedMovementAmount } from "@/lib/customer-validations";
import { customerMovementLabel, relativeDaysLabel } from "@/lib/customers";
import { completeSaleSchema } from "@/lib/sale-validations";
import { salePaymentIssue, summarizeSalePayments } from "@/lib/sales";

const productId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";

describe("cobro: lo vendido no es lo mismo que lo cobrado", () => {
  it("separa efectivo, fiado y cobrado en una venta de $30.000", () => {
    const summary = summarizeSalePayments([{ method: "CASH", amountCents: 1_000_000 }, { method: "CREDIT", amountCents: 2_000_000 }]);
    expect(summary).toEqual({ cashCents: 1_000_000, creditCents: 2_000_000, collectedCents: 1_000_000, totalCents: 3_000_000, primaryMethod: "MIXED" });
  });

  it("una venta 100 % fiada no cobra nada", () => {
    expect(summarizeSalePayments([{ method: "CREDIT", amountCents: 2_500_000 }])).toMatchObject({ collectedCents: 0, cashCents: 0, primaryMethod: "CREDIT" });
  });

  it("valida que los montos cubran el total y que el fiado tenga cliente", () => {
    expect(salePaymentIssue(3_000_000, [{ method: "CASH", amountCents: 1_000_000 }, { method: "CREDIT", amountCents: 2_000_000 }], customerId)).toBeNull();
    expect(salePaymentIssue(3_000_000, [{ method: "CASH", amountCents: 1_000_000 }, { method: "CREDIT", amountCents: 2_000_000 }], null)).toBe("CUSTOMER_REQUIRED");
    expect(salePaymentIssue(3_000_000, [{ method: "CASH", amountCents: 1_000_000 }], null)).toBe("TOTAL_MISMATCH");
    expect(salePaymentIssue(1_000, [{ method: "CASH", amountCents: 500 }, { method: "CASH", amountCents: 500 }], null)).toBe("DUPLICATE_METHOD");
    expect(salePaymentIssue(1_000, [], null)).toBe("EMPTY");
  });

  it("el esquema exige cliente para el fiado y acepta el formato anterior", () => {
    const credit = completeSaleSchema.safeParse({ items: [{ productId, quantity: 1 }], payments: [{ method: "CREDIT", amountCents: 100 }], receivedCashCents: null });
    expect(credit.success).toBe(false);
    expect(credit.error?.issues.some((issue) => issue.message === "Elegí un cliente para registrar la deuda.")).toBe(true);
    expect(completeSaleSchema.safeParse({ items: [{ productId, quantity: 1 }], payments: [{ method: "CREDIT", amountCents: 100 }], receivedCashCents: null, customerId }).success).toBe(true);
    expect(completeSaleSchema.safeParse({ items: [{ productId, quantity: 1 }], paymentMethod: "TRANSFER", receivedCashCents: null }).success).toBe(true);
    expect(completeSaleSchema.safeParse({ items: [{ productId, quantity: 1 }], paymentMethod: "CASH", payments: [{ method: "CASH", amountCents: 100 }], receivedCashCents: 100 }).success).toBe(false);
    expect(completeSaleSchema.safeParse({ items: [{ productId, quantity: 1 }], payments: [{ method: "CASH", amountCents: 100 }], receivedCashCents: null }).success).toBe(false);
  });
});

describe("cuenta corriente basada en movimientos", () => {
  it("usa una única convención de signos", () => {
    expect(signedMovementAmount("CREDIT_SALE", 2_000_000)).toBe(2_000_000);
    expect(signedMovementAmount("PAYMENT", 800_000)).toBe(-800_000);
    expect(signedMovementAmount("SALE_CANCELLATION", 2_000_000)).toBe(-2_000_000);
    expect(signedMovementAmount("ADJUSTMENT", 500, "INCREASE")).toBe(500);
    expect(signedMovementAmount("ADJUSTMENT", 500, "DECREASE")).toBe(-500);
    expect(() => signedMovementAmount("PAYMENT", -1)).toThrow("INVALID_AMOUNT");
  });

  it("reconstruye el saldo desde el historial y nunca lo deja negativo", () => {
    const history = [{ amountCents: 2_000_000 }, { amountCents: -800_000 }, { amountCents: -700_000 }, { amountCents: -500_000 }];
    expect(balanceFromMovements(history)).toBe(0);
    expect(balanceAfterMovement(2_000_000, -800_000)).toBe(1_200_000);
    expect(() => balanceAfterMovement(500_000, -700_000)).toThrow("NEGATIVE_BALANCE");
  });

  it("valida clientes y pagos sin pedir datos innecesarios", () => {
    expect(customerSchema.safeParse({ name: "Juan Pérez", phone: "", email: "", document: "", notes: "" }).success).toBe(true);
    expect(customerSchema.safeParse({ name: "J", phone: "", email: "", document: "", notes: "" }).success).toBe(false);
    expect(customerPaymentSchema.safeParse({ customerId, amountCents: "8.000", method: "CASH", note: "", idempotencyKey: customerId }).data?.amountCents).toBe(800_000);
    expect(customerPaymentSchema.safeParse({ customerId, amountCents: "0", method: "CASH", note: "", idempotencyKey: customerId }).success).toBe(false);
  });

  it("describe los movimientos en lenguaje del mostrador", () => {
    expect(customerMovementLabel("CREDIT_SALE", 1, null)).toBe("Venta fiada");
    expect(customerMovementLabel("PAYMENT", -1, "CASH")).toBe("Pago en efectivo");
    expect(customerMovementLabel("PAYMENT", -1, "TRANSFER")).toBe("Pago por transferencia");
    expect(customerMovementLabel("ADJUSTMENT", -1, null)).toBe("Ajuste: baja la deuda");
    const now = new Date("2026-10-16T12:00:00Z");
    expect(relativeDaysLabel(new Date("2026-10-13T12:00:00Z"), now)).toBe("hace 3 días");
    expect(relativeDaysLabel(null, now)).toBe("Sin movimientos");
  });
});

describe("DEETA AI y fiado: solo lectura", () => {
  const plan = (question: string) => planDeetaAiRequest(question, [{ role: "USER", content: question }]);

  it("entiende las preguntas de cuenta corriente", () => {
    expect(plan("¿Cuánto me deben?")).toEqual({ name: "get_customer_balances", arguments: { focus: "DEBTORS" } });
    expect(plan("¿Quién me debe más?")).toEqual({ name: "get_customer_balances", arguments: { focus: "TOP_DEBTOR" } });
    expect(plan("¿Qué clientes tienen deuda?")).toEqual({ name: "get_customer_balances", arguments: { focus: "DEBTORS" } });
    expect(plan("¿Quién hace más tiempo que no paga?")).toEqual({ name: "get_customer_balances", arguments: { focus: "OLDEST_UNPAID" } });
    expect(plan("¿Cuánto me pagaron de fiado este mes?")).toMatchObject({ name: "get_customer_payments", arguments: { kind: "CURRENT_MONTH" } });
    expect(plan("¿Cuánto le queda por pagar a Juan?")).toEqual({ name: "get_customer_account", arguments: { customerReference: "Juan" } });
    expect(plan("¿Qué compras tiene pendientes Juan Pérez?")).toEqual({ name: "get_customer_account", arguments: { customerReference: "Juan Pérez" } });
    expect(plan("¿Cuánto vendí este mes?")?.name).toBe("get_period_summary");
  });

  it("no registra pagos, no perdona deudas ni ajusta saldos", () => {
    for (const question of ["Registrá un pago de Juan", "Perdoná la deuda de Juan", "Ajustá el saldo del cliente Juan", "Cancelá el fiado de María"]) {
      expect(restrictedRequestReply(question)).toBe("Por ahora puedo ayudarte a analizar el negocio, pero no modificar datos.");
    }
    expect(restrictedRequestReply("¿Cuánto me deben?")).toBeNull();
  });

  it("muestra los deudores como lista estructurada", () => {
    const presentation = buildAiPresentation([{ tool: "get_customer_balances", data: {
      focus: "DEBTORS", totalPendingCents: 2_570_000, totalPending: "$ 25.700", debtors: 2,
      customers: [
        { name: "Juan Pérez", balanceCents: 1_850_000, balance: "$ 18.500", lastMovementDate: "12 oct", lastPaymentDate: null, daysWithoutPayment: 4 },
        { name: "María Gómez", balanceCents: 720_000, balance: "$ 7.200", lastMovementDate: "14 oct", lastPaymentDate: "14 oct", daysWithoutPayment: 2 },
      ],
    } }], "¿Quién me debe?");
    expect(presentation).toMatchObject({ type: "customer-list", summary: "Te deben $ 25.700 entre 2 clientes." });
    expect(isAiPresentation(presentation)).toBe(true);
  });
});
