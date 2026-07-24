import { Router } from "express";
import { db, notificationsTable, siteSettingsTable } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";

const router = Router();

// Simple admin auth middleware — checks X-Admin-Key header
const ADMIN_KEY = process.env.ADMIN_KEY || "admin-secret-2024";

function adminAuth(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"] || "";
  const bearerKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const key = req.query._k || bearerKey || req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Notifications ───────────────────────────────────────────────

// GET all notifications (public - active & non-expired only)
router.get("/notifications", async (_req, res) => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.active, true),
          or(isNull(notificationsTable.expiresAt), gt(notificationsTable.expiresAt, now))
        )
      )
      .orderBy(notificationsTable.createdAt);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET all notifications (admin - all)
router.get("/admin/notifications", adminAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .orderBy(notificationsTable.createdAt);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// POST create notification
router.post("/admin/notifications", adminAuth, async (req, res) => {
  try {
    const { title, message, type = "info", link, linkLabel, expiresAt } = req.body;
    if (!title || !message) return res.status(400).json({ error: "title and message required" });
    const [row] = await db
      .insert(notificationsTable)
      .values({
        title,
        message,
        type,
        link: link || null,
        linkLabel: linkLabel || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: true,
      })
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to create notification" });
  }
});

// PATCH toggle notification active
router.patch("/admin/notifications/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { active } = req.body;
    const [row] = await db
      .update(notificationsTable)
      .set({ active })
      .where(eq(notificationsTable.id, id))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// DELETE notification
router.delete("/admin/notifications/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// ─── Site Settings ───────────────────────────────────────────────

// GET a setting (public - used for maintenance check)
router.get("/settings/:key", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, req.params.key));
    res.json(row ?? null);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch setting" });
  }
});

// GET all settings (admin)
router.get("/admin/settings", adminAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT upsert setting
router.put("/admin/settings/:key", adminAuth, async (req, res) => {
  try {
    const { value } = req.body;
    const [row] = await db
      .insert(siteSettingsTable)
      .values({ key: req.params.key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

// ─── Admin Auth Check ─────────────────────────────────────────────

router.post("/admin/auth", (req, res) => {
  const { key } = req.body;
  if (key === ADMIN_KEY) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid admin key" });
  }
});

export default router;
