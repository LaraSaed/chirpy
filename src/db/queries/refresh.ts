import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens, users } from "../schema.js";

export async function createRefreshToken(
  token: string,
  userId: string,
  expiresAt: Date,
) {
  const [result] = await db
    .insert(refreshTokens)
    .values({ token, userId, expiresAt })
    .returning();
  return result;
}

export async function getUserFromRefreshToken(token: string) {
  const [result] = await db
    .select({ user: users })
    .from(users)
    .innerJoin(refreshTokens, eq(users.id, refreshTokens.userId))
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );
  return result;
}

export async function revokeRefreshToken(token: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(refreshTokens.token, token));
}
