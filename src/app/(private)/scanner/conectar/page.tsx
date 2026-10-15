import { ConnectScanner } from "@/components/scanner/connect-scanner";

export default async function ConnectScannerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="mx-auto max-w-xl"><h1 className="text-3xl font-black">Conectar lector</h1><div className="mt-7"><ConnectScanner initialToken={token?.slice(0, 200)} /></div></div>;
}
