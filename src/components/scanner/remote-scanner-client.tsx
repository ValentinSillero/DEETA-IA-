"use client";

import { Camera, CheckCircle2, LogOut, PackagePlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { revokeMobilePairingAction, sendRemoteScanAction } from "@/actions/scanner";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import type { ScannedBarcode } from "@/lib/barcode";

type Feedback = { tone: "sending" | "success" | "error"; message: string; barcode?: string };

export function RemoteScannerClient({ pairingId }: { pairingId: string }) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(true);
  const [sent, setSent] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>({ tone: "sending", message: "Listo para escanear." });

  useEffect(() => {
    const source = new EventSource(`/scanner/remoto/${pairingId}/status`);
    source.addEventListener("ready", () => {
      setFeedback((current) => current.message.includes("Intentando reconectar") ? { tone: "sending", message: "Conexión recuperada. Listo para escanear." } : current);
    });
    source.addEventListener("ended", () => {
      setScannerOpen(false);
      setFeedback({ tone: "success", message: "Venta finalizada" });
      source.close();
    });
    source.onerror = () => {
      setFeedback((current) => current.message.includes("finalizada") ? current : { tone: "error", message: "Se perdió la conexión. Intentando reconectar…" });
    };
    return () => source.close();
  }, [pairingId]);

  async function detected(scan: ScannedBarcode) {
    setFeedback({ tone: "sending", message: "Enviando…", barcode: scan.value });
    const payload = { pairingId, eventId: crypto.randomUUID(), barcode: scan.value, format: scan.format };
    let result: Awaited<ReturnType<typeof sendRemoteScanAction>>;
    try {
      result = await sendRemoteScanAction(payload);
    } catch {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        result = await sendRemoteScanAction(payload);
      } catch {
        setFeedback({ tone: "error", message: "No pudimos enviar el producto. Revisá tu conexión.", barcode: scan.value });
        return;
      }
    }
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.reason === "INVALID_PAIRING" ? "La venta finalizó o se perdió la conexión." : "No pudimos enviar el producto.", barcode: scan.value });
      if (result.reason === "INVALID_PAIRING") setScannerOpen(false);
      return;
    }
    if (result.event.status === "FOUND" && result.event.product) {
      setSent((value) => value + 1);
      setFeedback({ tone: "success", message: `${result.event.product.name} agregado.`, barcode: scan.value });
    } else {
      setFeedback({ tone: "error", message: result.event.status === "OUT_OF_STOCK" ? "No hay más unidades disponibles." : "No encontramos este producto en DEETA.", barcode: scan.value });
    }
  }
  async function disconnect() { await revokeMobilePairingAction(pairingId); router.replace("/scanner"); }

  return <div><section className="rounded-2xl bg-ink p-6 text-white"><p className="flex items-center gap-2 text-sm font-bold text-mint-300"><Camera className="size-4" aria-hidden="true" /> Conectado a la venta</p><h1 className="mt-2 text-3xl font-black">Lector remoto</h1><p className="mt-2 text-white/65">Los productos aparecen en la computadora después de ser confirmados.</p><div className="mt-6 border-l-4 border-mint-400 pl-4"><p className="text-sm text-white/60">Productos enviados</p><p className="mt-1 text-3xl font-black">{sent}</p></div></section>
  <section className="panel mt-5 text-center">{feedback.tone === "success" ? <CheckCircle2 className="mx-auto size-10 text-success" /> : feedback.tone === "error" ? <XCircle className="mx-auto size-10 text-red-600" /> : <Camera className="mx-auto size-10 text-muted" />}<p className="mt-3 font-black">{feedback.message}</p>{feedback.tone === "error" && feedback.barcode && <p className="mt-1 text-sm text-muted">Código: {feedback.barcode}</p>}{feedback.tone === "error" && feedback.message.includes("No encontramos") && <Link href={`/productos/nuevo?barcode=${encodeURIComponent(feedback.barcode ?? "")}`} className="button-secondary mt-4 w-full"><PackagePlus className="size-5" /> Crear producto</Link>}<button type="button" onClick={() => setScannerOpen(true)} className="button-primary mt-4 w-full"><Camera className="size-5" /> {scannerOpen ? "Cámara activa" : "Seguir escaneando"}</button><button type="button" onClick={() => void disconnect()} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-muted"><LogOut className="size-5" /> Desconectar</button></section>
  <BarcodeScanner open={scannerOpen} title="Escaneá productos" onClose={() => setScannerOpen(false)} onDetected={detected} /></div>;
}
