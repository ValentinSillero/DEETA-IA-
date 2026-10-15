import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { StockScanner } from "@/components/scanner/stock-scanner";

export default function ScanStockPage() {
  return <div className="mx-auto max-w-xl"><Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Volver a productos</Link><p className="mt-7 text-sm font-extrabold text-mint-600">Ingreso rápido</p><h1 className="mt-2 text-3xl font-black">Ingresar mercadería</h1><p className="page-lead ">Escaneá un producto y registrá las unidades recibidas.</p><div className="mt-7"><StockScanner /></div></div>;
}
