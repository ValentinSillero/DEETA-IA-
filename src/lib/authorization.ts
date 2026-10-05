import type { MemberRole } from "@/db/schema";

type Membership = {
  userId: string;
  businessId: string;
  role: MemberRole;
};

export function manageableBusinessId(userId: string, membership: Membership | null) {
  if (!membership || membership.userId !== userId) return null;
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") return null;
  return membership.businessId;
}
