"use client";

import { Camera, Link2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { connectPairingAction } from "@/actions/scanner";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { pairingTokenFromValue, type ScannedBarcode } from "@/lib/barcode";

export function ConnectScanner({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(!initialToken);
  const [manual, setManual] = useState("");
  const [pending, setPending] = useState(Boolean(initialToken));
  const [error, setError] = useState<string>();

  async function connect(value: string) {
    const token = pairingTokenFromValue(value);
    if (!token) { setError("Ese código de conexión no es válido."); return; }
    setPending(true); setError(undefined);
    const result = await connectPairingAction({ token });
    if (!result.ok) { setPending(false); setError(result.message); return; }
    router.replace(`/scanner/remoto/${result.pairingId}`);
  }
  useEffect(() => {
    if (!initialToken) return;
    let active = true;
    void connectPairingAction({ token: initialToken }).then((result) => {
      if (!active) return;
      if (!result.ok) { setPending(false); setError(result.message); return; }
      router.replace(`/scanner/remoto/${result.pairingId}`);
    });
    return () => { active = false; };
  }, [initialToken, router]);
  const detected = async (barcode: ScannedBarcode) => { setScannerOpen(false); await connect(barcode.value); };

  return <div><section className="panel text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint-100 text-mint-600"><Link2 className="size-7" /></span><h2 className="mt-5 text-2xl font-black">Conectar con una caja</h2><p className="mx-auto mt-2 max-w-md leading-7 text-muted">Escaneá el QR que aparece en la computadora.</p>{pending ? <p className="mt-6 flex items-center justify-center gap-2 font-bold text-muted"><LoaderCircle className="size-5 animate-spin" /> Conectando…</p> : <button type="button" onClick={() => setScannerOpen(true)} className="button-primary mt-6 w-full"><Camera className="size-5" /> Escanear QR</button>}
  <div className="mt-5 border-t border-line pt-5 text-left"><label className="field-label">O pegá el enlace de conexión<input value={manual} onChange={(event) => setManual(event.target.value)} className="field-input" placeholder="Enlace o código" /></label><button type="button" onClick={() => void connect(manual)} disabled={!manual.trim() || pending} className="button-secondary mt-3 w-full">Conectar</button></div>{error && <p className="notice-error mt-4">{error}</p>}</section><BarcodeScanner open={scannerOpen} includeQr title="Escaneá el QR de la computadora" onClose={() => setScannerOpen(false)} onDetected={detected} /></div>;
}
