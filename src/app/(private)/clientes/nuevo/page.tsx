import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { createCustomerAction } from "@/actions/customers";
import { CustomerForm } from "@/components/customers/customer-forms";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/clientes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> Volver a clientes</Link>
      <h1 className="page-title mt-3">Nuevo cliente</h1>
      <p className="page-lead">Con el nombre alcanza. El resto lo podés completar después.</p>
      <section className="panel mt-6"><CustomerForm action={createCustomerAction} submitLabel="Crear cliente" /></section>
    </div>
  );
}
