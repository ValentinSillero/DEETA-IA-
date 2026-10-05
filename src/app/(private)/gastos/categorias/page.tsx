import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryManager } from "@/components/expenses/category-manager";
import { getExpenseCategoriesForUser, getExpenseContextForUser } from "@/data/expenses";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Categorías de gastos" };

export default async function ExpenseCategoriesPage() {
  const session = await requireSession();
  const [categories, context] = await Promise.all([getExpenseCategoriesForUser(session.user.id, true), getExpenseContextForUser(session.user.id)]);
  if (!context) redirect("/onboarding");
  return <div className="mx-auto max-w-3xl"><Link href="/gastos" className="inline-flex items-center gap-2 text-sm font-bold text-muted"><ArrowLeft className="size-4" /> Volver a gastos</Link><p className="mt-6 text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Organización</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Categorías de gastos</h1><p className="mt-2 text-muted">Ordená tus gastos sin borrar el historial.</p><div className="mt-7"><CategoryManager categories={categories} canManage={context.role !== "EMPLOYEE"} /></div></div>;
}
