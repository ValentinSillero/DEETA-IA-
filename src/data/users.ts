import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { user } from "@/db/schema";

export async function updateUserProfile(userId: string, name: string) {
  const db = getDb();
  const [updated] = await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id, name: user.name, email: user.email });

  return updated ?? null;
}
