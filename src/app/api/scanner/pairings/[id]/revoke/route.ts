import { revokePairingForPcUser } from "@/data/scanner";
import { getFreshSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getFreshSession();
  if (!session) return new Response(null, { status: 401 });
  const { id } = await params;
  const revoked = await revokePairingForPcUser(session.user.id, id);
  return new Response(null, { status: revoked ? 204 : 404 });
}
