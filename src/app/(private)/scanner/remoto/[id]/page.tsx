import { notFound } from "next/navigation";

import { validateMobilePairingForUser } from "@/actions/scanner";
import { RemoteScannerClient } from "@/components/scanner/remote-scanner-client";

export default async function RemoteScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pairing = await validateMobilePairingForUser(id);
  if (!pairing) notFound();
  return <div className="mx-auto max-w-xl"><RemoteScannerClient pairingId={pairing.id} /></div>;
}
