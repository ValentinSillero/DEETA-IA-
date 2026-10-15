import "server-only";

import { cache } from "react";
import { and, eq, exists, inArray } from "drizzle-orm";

import { getDb, getSqlClient } from "@/db";
import { business, businessMember } from "@/db/schema";
import { manageableBusinessId } from "@/lib/authorization";
import type { BusinessInput } from "@/lib/validations";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

export const getBusinessForUser = cache(async (userId: string) => {
  const db = getDb();
  const [record] = await db
    .select({
      business,
      role: businessMember.role,
      membershipUserId: businessMember.userId,
    })
    .from(businessMember)
    .innerJoin(business, eq(business.id, businessMember.businessId))
    .where(eq(businessMember.userId, userId))
    .limit(1);

  return record ?? null;
});

export async function createBusinessForUser(userId: string, values: BusinessInput) {
  const sqlClient = getSqlClient();
  const businessId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  const categoryRows = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ id: crypto.randomUUID(), name }));
  await sqlClient.transaction([
    sqlClient`
      insert into business (id, name, category, city, province, phone, timezone)
      values (${businessId}, ${values.name}, ${values.category}, ${values.city}, ${values.province}, ${values.phone || null}, ${values.timezone})
    `,
    sqlClient`
      insert into business_member (id, business_id, user_id, role)
      values (${memberId}, ${businessId}, ${userId}, 'OWNER')
    `,
    sqlClient`
      insert into expense_category (id, business_id, name)
      select category.id, ${businessId}, category.name
      from jsonb_to_recordset(${JSON.stringify(categoryRows)}::jsonb) as category(id text, name text)
    `,
  ]);

  return businessId;
}

export async function updateBusinessForUser(userId: string, values: BusinessInput) {
  const db = getDb();
  const currentBusiness = await getBusinessForUser(userId);
  if (!currentBusiness) return null;
  const authorizedBusinessId = manageableBusinessId(userId, {
    userId: currentBusiness.membershipUserId,
    businessId: currentBusiness.business.id,
    role: currentBusiness.role,
  });
  if (!authorizedBusinessId) return null;

  const [updated] = await db
    .update(business)
    .set({
      name: values.name,
      category: values.category,
      city: values.city,
      province: values.province,
      phone: values.phone || null,
      timezone: values.timezone,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(business.id, authorizedBusinessId),
        exists(
          db
            .select({ id: businessMember.id })
            .from(businessMember)
            .where(
              and(
                eq(businessMember.userId, userId),
                eq(businessMember.businessId, business.id),
                inArray(businessMember.role, ["OWNER", "ADMIN"]),
              ),
            ),
        ),
      ),
    )
    .returning();

  return updated ?? null;
}
