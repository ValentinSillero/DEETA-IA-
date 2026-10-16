import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { getExpenseCategoriesForUser, getExpenseContextForUser } from "@/data/expenses";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Anotar gasto" };

export default async function NewExpensePage() {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "EXPENSE_CREATE")) return <NoAccess section="registrar gastos" />;
  const [categories, context] = await Promise.all([getExpenseCategoriesForUser(session.user.id), getExpenseContextForUser(session.user.id)]);
  if (!context) redirect("/onboarding");
  return <div className="mx-auto max-w-2xl"><Link href="/gastos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a gastos</Link><p className="mt-6 text-sm font-extrabold text-orange-500">Registro rápido</p><h1 className="mt-2 page-title">Anotar gasto</h1><p className="page-lead">Guardá lo que pagaste en unos segundos.</p>{categories.length ? <div className="mt-7"><ExpenseForm categories={categories} today={context.today} hasOpenCash={Boolean(context.openCashId)} /></div> : <div className="notice-error mt-7">Primero necesitás una categoría activa. <Link className="underline" href="/gastos/categorias">Administrar categorías</Link></div>}</div>;
}
