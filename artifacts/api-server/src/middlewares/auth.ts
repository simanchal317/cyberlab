import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export type CyberLabRequest = Request & {
  userId?: string;
  userRole?: "student" | "admin";
};

function adminIds(): Set<string> {
  return new Set(
    (process.env.CYBERLAB_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function ensureLocalUser(userId: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing) {
    const role = adminIds().has(userId) ? "admin" : existing.role;
    if (role !== existing.role) {
      const [updated] = await db
        .update(usersTable)
        .set({ role, lastActiveAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();
      return updated;
    }
    await db
      .update(usersTable)
      .set({ lastActiveAt: new Date() })
      .where(eq(usersTable.id, userId));
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      name: "Cyber Operator",
      email: `${userId}@clerk.local`,
      role: adminIds().has(userId) ? "admin" : "student",
      lastActiveAt: new Date(),
    })
    .returning();
  return created;
}

export async function requireAuth(
  req: CyberLabRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const user = await ensureLocalUser(userId);
    req.userId = user.id;
    req.userRole = user.role === "admin" ? "admin" : "student";
    next();
    return;
  } catch (error) {
    return next(error);
  }
}

export async function requireAdmin(
  req: CyberLabRequest,
  res: Response,
  next: NextFunction,
) {
  await requireAuth(req, res, () => {
    if (req.userRole !== "admin") {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}