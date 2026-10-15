"use client";

import { Camera, CheckCircle2, Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DeetaIcon } from "@/components/ui/logo";
import { canAcceptDetectedCode, isValidBarcode, normalizeBarcode, type ScannedBarcode } from "@/lib/barcode";

type NativeDetection = { rawValue: string; format: string };
type NativeDetector = { detect(source: HTMLVideoElement): Promise<NativeDetection[]> };
type NativeDetectorConstructor = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats?(): Promise<string[]>;
};

declare global {
  interface Window { BarcodeDetector?: NativeDetectorConstructor }
}

const PRODUCT_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  includeQr = false,
  title = "Apuntá al código de barras",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: ScannedBarcode) => void | Promise<void>;
  includeQr?: boolean;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onDetected);
  const lastDetectionRef = useRef<{ value: string; seenAt: number } | null>(null);
  const [status, setStatus] = useState<"requesting" | "scanning" | "detected" | "denied" | "error">("requesting");
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => { callbackRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let controls: { stop(): void } | null = null;
    const videoElement = videoRef.current;
    lastDetectionRef.current = null;

    const accept = async (rawValue: string, format: string) => {
      const value = normalizeBarcode(rawValue);
      const now = Date.now();
      if (!isValidBarcode(value) || !canAcceptDetectedCode(lastDetectionRef.current, value, now)) {
        if (lastDetectionRef.current?.value === value) lastDetectionRef.current.seenAt = now;
        return;
      }
      lastDetectionRef.current = { value, seenAt: now };
      setStatus("detected");
      navigator.vibrate?.(60);
      await callbackRef.current({ value, format });
      if (!cancelled) window.setTimeout(() => setStatus("scanning"), 650);
    };

    const start = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setStatus("requesting");
      setShowManual(false);
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setStatus("error");
        return;
      }
      const formats = includeQr ? ["qr_code"] : PRODUCT_FORMATS;
      try {
        let nativeDetector: NativeDetector | null = null;
        if (window.BarcodeDetector) {
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats?.();
            if (!supported || formats.every((format) => supported.includes(format))) {
              nativeDetector = new window.BarcodeDetector({ formats });
            }
          } catch {
            // Algunos navegadores exponen la API sin soportar todos los formatos.
          }
        }
        if (nativeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          if (cancelled || !videoElement) return;
          videoElement.srcObject = stream;
          await videoElement.play();
          setStatus("scanning");
          let lastFrame = 0;
          const detectFrame = async (time: number) => {
            if (cancelled || !videoElement) return;
            if (time - lastFrame >= 220 && videoElement.readyState >= 2) {
              lastFrame = time;
              try {
                const [result] = await nativeDetector.detect(videoElement);
                if (result) await accept(result.rawValue, result.format.toUpperCase());
              } catch { /* Un frame ilegible es normal. */ }
            }
            animationFrame = requestAnimationFrame(detectFrame);
          };
          animationFrame = requestAnimationFrame(detectFrame);
        } else {
          const { BarcodeFormat, BrowserMultiFormatOneDReader, BrowserQRCodeReader } = await import("@zxing/browser");
          const possibleFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128];
          const reader = includeQr
            ? new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 250 })
            : new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 250 });
          if (!includeQr) reader.possibleFormats = possibleFormats;
          controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
            videoElement ?? undefined,
            (result) => {
              if (!result || cancelled) return;
              void accept(result.getText(), String(BarcodeFormat[result.getBarcodeFormat()] ?? "BARCODE"));
            },
          );
          if (!cancelled) setStatus("scanning");
        }
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "error");
      }
    };
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [includeQr, open]);

  if (!open) return null;
  const message = status === "requesting" ? "Preparando cámara…" : status === "detected" ? "Código leído" : status === "denied" ? "No tenemos permiso para usar la cámara." : status === "error" ? "No pudimos abrir la cámara." : "Escaneando…";

  function submitManual() {
    const value = normalizeBarcode(manual);
    if (!isValidBarcode(value)) return;
    void callbackRef.current({ value, format: "MANUAL" });
  }

  return <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-ink text-white" role="dialog" aria-modal="true" aria-label="Lector de códigos">
    <header className="flex items-center justify-between gap-4 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]"><div className="flex min-w-0 items-center gap-3"><DeetaIcon className="size-9" priority /><div className="min-w-0"><p className="text-xs font-bold text-mint-300">Cámara de DEETA</p><h2 className="mt-1 truncate text-xl font-black">{title}</h2></div></div><button type="button" onClick={onClose} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/12" aria-label="Cerrar cámara"><X className="size-6" /></button></header>
    <div className="relative min-h-0 flex-1 bg-black"><video ref={videoRef} muted playsInline className="size-full object-cover" /><div className="pointer-events-none absolute inset-0 grid place-items-center bg-[linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.12),rgba(0,0,0,.42))]"><div className={`h-36 w-[82%] max-w-md rounded-2xl border-4 ${status === "detected" ? "border-accent bg-accent/15" : "border-brand"}`}><span className="sr-only">Zona de lectura</span></div></div><div className="absolute inset-x-4 bottom-5 flex justify-center"><p className={`rounded-xl px-5 py-3 text-sm font-black ${status === "detected" ? "bg-accent text-ink" : "bg-black/75"}`}>{status === "detected" && <CheckCircle2 className="mr-2 inline size-5" aria-hidden="true" />}{message}</p></div></div>
    <footer className="px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4"><p className="text-center text-sm text-white/65">Usá buena luz y mantené el código dentro del marco.</p>{showManual ? <div className="mt-3 flex gap-2"><input value={manual} onChange={(event) => setManual(event.target.value)} className="field-input min-w-0 flex-1 text-ink" inputMode="text" placeholder="Escribir código" autoFocus /><button type="button" onClick={submitManual} disabled={!isValidBarcode(manual)} className="button-primary shrink-0">Usar</button></div> : <button type="button" onClick={() => setShowManual(true)} className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold text-white/85"><Keyboard className="size-5" /> Escribir código</button>} {(status === "denied" || status === "error") && <p className="mt-3 text-center text-sm text-orange-200"><Camera className="mr-1 inline size-4" /> Podés continuar escribiendo el código o buscando manualmente.</p>}</footer>
  </div>;
}
