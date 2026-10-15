"use client";

import { CheckCircle2, LoaderCircle, MonitorSmartphone, Smartphone, Unplug, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { createPairingAction, revokePcPairingAction } from "@/actions/scanner";
import type { ScannerEventDto, ScannerProductDto } from "@/data/scanner";

export function RemoteScannerPanel({ onProduct, onPairingChange }: { onProduct: (product: ScannerProductDto, eventId: string) => void; onPairingChange: (pairingId: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [targetCartId] = useState(() => crypto.randomUUID());
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [qr, setQr] = useState<string>();
  const [status, setStatus] = useState<"idle" | "creating" | "waiting" | "connected" | "disconnected">("idle");
  const [notice, setNotice] = useState<string>();
  const seenEvents = useRef(new Set<string>());
  const onProductRef = useRef(onProduct);
  useEffect(() => { onProductRef.current = onProduct; }, [onProduct]);

  useEffect(() => {
    if (!pairingId) return;
    const source = new EventSource(`/api/scanner/pairings/${pairingId}/events`);
    source.addEventListener("pairing", (raw) => {
      const pairing = JSON.parse((raw as MessageEvent).data) as { status: string };
      setStatus(pairing.status === "CONNECTED" ? "connected" : pairing.status === "WAITING" ? "waiting" : "disconnected");
      if (pairing.status === "REVOKED" || pairing.status === "EXPIRED") source.close();
    });
    source.addEventListener("scan", (raw) => {
      const event = JSON.parse((raw as MessageEvent).data) as ScannerEventDto;
      if (seenEvents.current.has(event.id)) return;
      seenEvents.current.add(event.id);
      if (event.status === "FOUND" && event.product) {
        onProductRef.current(event.product, event.id);
        setNotice(`${event.product.name} agregado desde el celular.`);
      } else if (event.status === "OUT_OF_STOCK") setNotice("Ese producto no tiene stock disponible.");
      else setNotice(`Código ${event.barcode} no registrado.`);
    });
    source.onerror = () => setStatus((current) => current === "connected" ? "disconnected" : current);
    return () => source.close();
  }, [pairingId]);

  useEffect(() => {
    if (!pairingId) return;
    const revokeWhenClosing = () => navigator.sendBeacon(`/api/scanner/pairings/${pairingId}/revoke`);
    window.addEventListener("pagehide", revokeWhenClosing);
    return () => window.removeEventListener("pagehide", revokeWhenClosing);
  }, [pairingId]);

  async function start() {
    if (!targetCartId) return;
    setOpen(true); setStatus("creating"); setNotice(undefined);
    const result = await createPairingAction({ targetCartId });
    if (!result.ok) { setStatus("disconnected"); setNotice(result.message); return; }
    const link = `${window.location.origin}/scanner/conectar?token=${encodeURIComponent(result.token)}`;
    const QRCode = (await import("qrcode")).default;
    setQr(await QRCode.toDataURL(link, { width: 320, margin: 2, errorCorrectionLevel: "M" }));
    setPairingId(result.pairing.id); onPairingChange(result.pairing.id); setStatus("waiting");
  }

  async function disconnect() {
    if (pairingId) await revokePcPairingAction(pairingId);
    setPairingId(null); onPairingChange(null); setQr(undefined); setStatus("idle"); setOpen(false);
  }

  return <>
    <button type="button" onClick={() => void start()} className="button-secondary w-full"><MonitorSmartphone className="size-5 shrink-0" aria-hidden="true" /> Celular como escáner</button>
    {notice && <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold" role="status">{notice}</p>}
    {open && <div className="fixed inset-0 z-[70] grid place-items-end bg-ink/55 sm:place-items-center sm:p-5"><section className="w-full max-w-md rounded-t-[30px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-center sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between text-left"><div><p className="text-sm font-extrabold text-mint-600">Lector remoto</p><h2 className="mt-1 text-2xl font-black">Conectá tu celular</h2></div><button type="button" onClick={() => void disconnect()} className="grid size-11 place-items-center rounded-2xl border border-line" aria-label="Cerrar conexión"><X className="size-5" /></button></div>
      {status === "creating" ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-9 animate-spin text-mint-600" /></div> : qr ? <><Image src={qr} width={256} height={256} unoptimized alt="QR temporal para conectar el celular" className="mx-auto mt-5 size-64 max-w-full rounded-2xl" /><div className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${status === "connected" ? "bg-accent-soft text-success" : status === "disconnected" ? "bg-orange-100 text-orange-500" : "bg-surface-2 text-muted"}`}>{status === "connected" ? <><CheckCircle2 className="size-5" /> Celular conectado</> : status === "disconnected" ? <><Unplug className="size-5" /> Reconectando…</> : <><Smartphone className="size-5" /> Esperando celular…</>}</div><p className="mt-4 text-sm leading-6 text-muted">Abrí “Escanear” en DEETA desde el celular y leé este QR. Vence en 5 minutos si todavía no se conectó.</p><button type="button" onClick={() => void disconnect()} className="button-secondary mt-5 w-full">Desconectar</button></> : null}
    </section></div>}
  </>;
}
