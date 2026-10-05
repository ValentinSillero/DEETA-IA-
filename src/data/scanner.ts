import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import { businessMember, product } from "@/db/schema";
import { connectedPairingExpiry, createPairingToken, hashPairingToken, pairingExpiry } from "@/lib/pairing";

export type ScannerProductDto = {
  id: string;
  name: string;
  barcode: string;
  salePriceCents: number;
  currentStock: number;
};

export async function findProductByBarcodeForUser(userId: string, barcode: string): Promise<ScannerProductDto | null> {
  const db = getDb();
  const [row] = await db.select({ id: product.id, name: product.name, barcode: product.barcode, salePriceCents: product.salePriceCents, currentStock: product.currentStock })
    .from(product)
    .innerJoin(businessMember, and(eq(businessMember.businessId, product.businessId), eq(businessMember.userId, userId)))
    .where(and(eq(product.barcode, barcode), eq(product.isActive, true)))
    .limit(1);
  return row?.barcode ? { ...row, barcode: row.barcode } : null;
}

export type PairingInfo = {
  id: string;
  targetCartId: string;
  status: "WAITING" | "CONNECTED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  connectedAt: Date | null;
};

export async function createPairingForUser(userId: string, targetCartId: string) {
  const sqlClient = getSqlClient();
  const id = crypto.randomUUID();
  const token = createPairingToken();
  const tokenHash = hashPairingToken(token);
  const expiresAt = pairingExpiry();
  const rows = await sqlClient`
    with member as (
      select business_id from business_member
      where user_id = ${userId} and role in ('OWNER', 'ADMIN', 'EMPLOYEE') limit 1
    ), revoked as (
      update scanner_pairing_session s
      set status = 'REVOKED', disconnected_at = now(), updated_at = now()
      from member m
      where s.business_id = m.business_id and s.target_cart_id = ${targetCartId}
        and s.status in ('WAITING', 'CONNECTED')
      returning s.id
    ), created as (
      insert into scanner_pairing_session (
        id, business_id, created_by, target_cart_id, token_hash, status, expires_at
      )
      select ${id}, business_id, ${userId}, ${targetCartId}, ${tokenHash}, 'WAITING', ${expiresAt}
      from member
      returning id, target_cart_id, status, expires_at, connected_at
    ) select * from created
  `;
  const row = rows[0];
  if (!row) return null;
  return { token, pairing: mapPairing(row) };
}

function mapPairing(row: Record<string, unknown>): PairingInfo {
  return {
    id: String(row.id), targetCartId: String(row.target_cart_id),
    status: row.status as PairingInfo["status"], expiresAt: new Date(String(row.expires_at)),
    connectedAt: row.connected_at ? new Date(String(row.connected_at)) : null,
  };
}

export async function connectPairingForUser(userId: string, token: string) {
  const sqlClient = getSqlClient();
  const tokenHash = hashPairingToken(token);
  const connectedUntil = connectedPairingExpiry();
  const rows = await sqlClient`
    with expired as (
      update scanner_pairing_session set status = 'EXPIRED', updated_at = now()
      where token_hash = ${tokenHash} and status = 'WAITING' and expires_at <= now()
      returning id
    ), connected as (
      update scanner_pairing_session s
      set status = 'CONNECTED', connected_at = coalesce(s.connected_at, now()),
          expires_at = ${connectedUntil}, disconnected_at = null, updated_at = now()
      from business_member bm
      where s.token_hash = ${tokenHash}
        and bm.business_id = s.business_id and bm.user_id = ${userId}
        and bm.role in ('OWNER', 'ADMIN', 'EMPLOYEE')
        and s.status in ('WAITING', 'CONNECTED') and s.expires_at > now()
      returning s.id, s.target_cart_id, s.status, s.expires_at, s.connected_at
    ) select * from connected
  `;
  return rows[0] ? mapPairing(rows[0] as Record<string, unknown>) : null;
}

export async function getPairingForPcForUser(userId: string, pairingId: string) {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    select s.id, s.target_cart_id, s.status, s.expires_at, s.connected_at
    from scanner_pairing_session s
    inner join business_member bm on bm.business_id = s.business_id and bm.user_id = ${userId}
    where s.id = ${pairingId} and s.created_by = ${userId}
    limit 1
  `;
  return rows[0] ? mapPairing(rows[0] as Record<string, unknown>) : null;
}

export async function getPairingForMobileUser(userId: string, pairingId: string, token: string) {
  const sqlClient = getSqlClient();
  const tokenHash = hashPairingToken(token);
  const rows = await sqlClient`
    select s.id, s.target_cart_id, s.status, s.expires_at, s.connected_at
    from scanner_pairing_session s
    inner join business_member bm on bm.business_id = s.business_id and bm.user_id = ${userId}
    where s.id = ${pairingId} and s.token_hash = ${tokenHash}
      and s.status = 'CONNECTED' and s.expires_at > now()
    limit 1
  `;
  return rows[0] ? mapPairing(rows[0] as Record<string, unknown>) : null;
}

export type RemoteScanResult =
  | { ok: true; duplicate: boolean; event: ScannerEventDto }
  | { ok: false; reason: "INVALID_PAIRING" | "RATE_LIMITED" };

export type ScannerEventDto = {
  id: string;
  sequence: number;
  barcode: string;
  status: "FOUND" | "NOT_FOUND" | "OUT_OF_STOCK";
  product: ScannerProductDto | null;
};

export async function sendRemoteScanForUser(userId: string, token: string, input: { pairingId: string; eventId: string; barcode: string; format: string | null }): Promise<RemoteScanResult> {
  const sqlClient = getSqlClient();
  const tokenHash = hashPairingToken(token);
  const rows = await sqlClient`
    with valid_pairing as (
      select s.id, s.business_id
      from scanner_pairing_session s
      inner join business_member bm on bm.business_id = s.business_id and bm.user_id = ${userId}
      where s.id = ${input.pairingId} and s.token_hash = ${tokenHash}
        and s.status = 'CONNECTED' and s.expires_at > now()
      for update of s
    ), rate_check as (
      select count(*)::int as recent_count from scanner_scan_event e
      inner join valid_pairing p on p.id = e.pairing_session_id
      where e.created_at > now() - interval '1 minute'
    ), matched_product as (
      select p.id, p.business_id, p.name, p.barcode, p.sale_price_cents, p.current_stock,
        (select count(*)::int from scanner_scan_event previous
         inner join valid_pairing vp on vp.id = previous.pairing_session_id
         where previous.product_id = p.id and previous.status = 'FOUND') as already_scanned
      from product p inner join valid_pairing v on v.business_id = p.business_id
      where p.barcode = ${input.barcode} and p.is_active = true limit 1
    ), inserted as (
      insert into scanner_scan_event (
        id, business_id, pairing_session_id, product_id, barcode, format, status
      )
      select ${input.eventId}, v.business_id, v.id, p.id, ${input.barcode}, ${input.format},
        case when p.id is null then 'NOT_FOUND'::scanner_event_status
             when p.current_stock <= p.already_scanned then 'OUT_OF_STOCK'::scanner_event_status
             else 'FOUND'::scanner_event_status end
      from valid_pairing v cross join rate_check r left join matched_product p on true
      where r.recent_count < 120
      on conflict (id) do nothing
      returning id, sequence, business_id, pairing_session_id, product_id, barcode, status
    ), selected_event as (
      select i.*, true as was_inserted from inserted i
      union all
      select e.id, e.sequence, e.business_id, e.pairing_session_id, e.product_id,
        e.barcode, e.status, false as was_inserted
      from scanner_scan_event e
      inner join valid_pairing v on v.id = e.pairing_session_id and v.business_id = e.business_id
      where e.id = ${input.eventId} and not exists (select 1 from inserted)
    )
    select e.id, e.sequence, e.barcode, e.status,
      p.id as product_id, p.name as product_name, p.barcode as product_barcode,
      p.sale_price_cents, p.current_stock,
      e.was_inserted
    from selected_event e
    inner join valid_pairing v on v.id = e.pairing_session_id
    left join product p on p.id = e.product_id and p.business_id = e.business_id
  `;
  const row = rows[0];
  if (!row) {
    const valid = await getPairingForMobileUser(userId, input.pairingId, token);
    return { ok: false, reason: valid ? "RATE_LIMITED" : "INVALID_PAIRING" };
  }
  return { ok: true, duplicate: !Boolean(row.was_inserted), event: mapEvent(row as Record<string, unknown>) };
}

function mapEvent(row: Record<string, unknown>): ScannerEventDto {
  return {
    id: String(row.id), sequence: Number(row.sequence), barcode: String(row.barcode),
    status: row.status as ScannerEventDto["status"],
    product: row.product_id ? {
      id: String(row.product_id), name: String(row.product_name), barcode: String(row.product_barcode),
      salePriceCents: Number(row.sale_price_cents), currentStock: Number(row.current_stock),
    } : null,
  };
}

export async function getPairingFeedForUser(userId: string, pairingId: string, afterSequence: number) {
  const sqlClient = getSqlClient();
  await sqlClient`
    update scanner_pairing_session s set status = 'EXPIRED', updated_at = now()
    where s.id = ${pairingId} and s.status in ('WAITING', 'CONNECTED') and s.expires_at <= now()
      and exists (select 1 from business_member bm where bm.business_id = s.business_id and bm.user_id = ${userId})
  `;
  const pairing = await getPairingForPcForUser(userId, pairingId);
  if (!pairing) return null;
  const rows = await sqlClient`
    select e.id, e.sequence, e.barcode, e.status,
      p.id as product_id, p.name as product_name, p.barcode as product_barcode,
      p.sale_price_cents, p.current_stock
    from scanner_scan_event e
    inner join scanner_pairing_session s on s.id = e.pairing_session_id and s.business_id = e.business_id
    left join product p on p.id = e.product_id and p.business_id = e.business_id
    where e.pairing_session_id = ${pairingId} and s.created_by = ${userId}
      and e.sequence > ${afterSequence}
    order by e.sequence asc limit 100
  `;
  return { pairing, events: rows.map((row) => mapEvent(row as Record<string, unknown>)) };
}

export async function revokePairingForPcUser(userId: string, pairingId: string) {
  const sqlClient = getSqlClient();
  const rows = await sqlClient`
    update scanner_pairing_session s set status = 'REVOKED', disconnected_at = now(), updated_at = now()
    where s.id = ${pairingId} and s.created_by = ${userId}
      and s.status in ('WAITING', 'CONNECTED')
      and exists (select 1 from business_member bm where bm.business_id = s.business_id and bm.user_id = ${userId})
    returning id
  `;
  return rows.length > 0;
}

export async function revokePairingForMobileUser(userId: string, pairingId: string, token: string) {
  const sqlClient = getSqlClient();
  const tokenHash = hashPairingToken(token);
  const rows = await sqlClient`
    update scanner_pairing_session s set status = 'REVOKED', disconnected_at = now(), updated_at = now()
    where s.id = ${pairingId} and s.token_hash = ${tokenHash} and s.status = 'CONNECTED'
      and exists (select 1 from business_member bm where bm.business_id = s.business_id and bm.user_id = ${userId})
    returning id
  `;
  return rows.length > 0;
}
