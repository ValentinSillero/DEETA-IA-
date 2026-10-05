import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { StockScanner } from "@/components/scanner/stock-scanner";

export default function ScanStockPage() {
  return <div className="mx-auto max-w-xl"><Link href="/productos" className="inline-flex items-center gap-2 text-sm font-bold text-muted"><ArrowLeft className="size-4" /> Volver a productos</Link><p className="mt-7 text-sm font-extrabold uppercase tracking-[0.12em] text-mint-600">Ingreso rápido</p><h1 className="mt-2 text-3xl font-black">Ingresar mercadería</h1><p className="mt-2 leading-7 text-muted">Escaneá un producto y registrá las unidades recibidas.</p><div className="mt-7"><StockScanner /></div></div>;
}
