import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCustomerAction } from "@/actions/customers";
import { CustomerActiveForm, CustomerForm } from "@/components/customers/customer-forms";
import { getCustomerForUser } from "@/data/customers";
import { requireSession } from "@/lib/session";
import { NoAccess } from "@/components/no-access";
import { can, getActiveMembership } from "@/data/membership";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([requireSession(), params]);
  // Bloqueo en el servidor: ocultar el enlace no alcanza.
  if (!can(await getActiveMembership(session.user.id), "CUSTOMER_EDIT")) return <NoAccess section="editar clientes" />;
  const membership = await getActiveMembership(session.user.id);
  const customer = await getCustomerForUser(session.user.id, id);
  if (!customer) notFound();
  const canManage = can(membership, "CUSTOMER_DEACTIVATE");
  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/clientes/${customer.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a {customer.name}</Link>
      <h1 className="page-title mt-3">Editar cliente</h1>
      <section className="panel mt-6"><CustomerForm action={updateCustomerAction} customer={customer} submitLabel="Guardar cambios" /></section>
      {canManage && <div className="mt-4"><CustomerActiveForm customerId={customer.id} active={customer.isActive} hasDebt={customer.balanceCents > 0} /></div>}
    </div>
  );
}
