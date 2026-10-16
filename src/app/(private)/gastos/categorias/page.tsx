import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryManager } from "@/components/expenses/category-manager";
import { getExpenseCategoriesForUser, getExpenseContextForUser } from "@/data/expenses";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Categorías de gastos" };

export default async function ExpenseCategoriesPage() {
  const session = await requireSession();
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "EXPENSE_CATEGORY_MANAGE")) return <NoAccess section="las categorías de gastos" />;
  const [categories, context] = await Promise.all([getExpenseCategoriesForUser(session.user.id, true), getExpenseContextForUser(session.user.id)]);
  if (!context) redirect("/onboarding");
  return <div className="mx-auto max-w-3xl"><Link href="/gastos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a gastos</Link><p className="mt-6 text-sm font-extrabold text-mint-600">Organización</p><h1 className="mt-2 page-title">Categorías de gastos</h1><p className="page-lead">Ordená tus gastos sin borrar el historial.</p><div className="mt-7"><CategoryManager categories={categories} canManage={context.role !== "EMPLOYEE"} /></div></div>;
}
