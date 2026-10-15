import { MonitorSmartphone, PackagePlus, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { DeetaIcon } from "@/components/ui/logo";

export default function ScannerHubPage() {
  const options = [
    { href: "/vender", icon: ShoppingCart, title: "Vender", description: "Escaneá productos y agregalos al carrito." },
    { href: "/productos/ingresar", icon: PackagePlus, title: "Ingresar mercadería", description: "Buscá por código y registrá nuevas unidades." },
    { href: "/scanner/conectar", icon: MonitorSmartphone, title: "Conectar con PC", description: "Usá este celular como lector de una venta abierta." },
  ] as const;
  return <div className="mx-auto max-w-3xl"><h1 className="page-title flex items-center gap-3"><DeetaIcon className="size-9" priority /> Escanear</h1><p className="page-lead">Elegí qué querés hacer con la cámara.</p><section className="list-surface mt-7">{options.map(({ href, icon: Icon, title, description }) => <Link key={href} href={href} className="list-row group transition-colors hover:bg-surface-2"><span className="icon-box size-12"><Icon className="size-6" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div></Link>)}</section></div>;
}
