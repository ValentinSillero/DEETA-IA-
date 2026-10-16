import type { MemberRole } from "@/db/schema";
import { hasPermission } from "@/lib/permissions";

type Membership = {
  userId: string;
  businessId: string;
  role: MemberRole;
};

export function manageableBusinessId(userId: string, membership: Membership | null) {
  if (!membership || membership.userId !== userId) return null;
  if (!hasPermission(membership.role, "BUSINESS_SETTINGS")) return null;
  return membership.businessId;
}
