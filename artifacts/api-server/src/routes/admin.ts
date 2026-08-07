import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, accessKeysTable, notificationsTable, siteSettingsTable } from "@workspace/db";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";

const router = Router();

// Simple admin auth middleware — checks X-Admin-Key header
const ADMIN_KEY = process.env.ADMIN_KEY || "admin-secret-2024";
const ACCESS_KEY_LENGTH = 18;

function hashAccessKey(key: string) {
  return createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

function hashClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessKey() {
  const raw = randomBytes(ACCESS_KEY_LENGTH).toString("base64url").toUpperCase();
  return `PWX-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
}

function createClaimToken() {
  return randomBytes(32).toString("base64url");
}

async function isAccessGateEnabled() {
  const [setting] = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "access_gate"));
  return setting?.value && typeof setting.value === "object" && "enabled" in setting.value
    ? Boolean((setting.value as { enabled?: unknown }).enabled)
    : true;
}

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
    if (!title || !message) { res.status(400).json({ error: "title and message required" }); return; }
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

// Verify a generated access key. The key is intentionally never returned by
// any public endpoint; the client stores it only to re-check access on reload.
router.post("/access/verify", async (req, res) => {
  try {
    if (!(await isAccessGateEnabled())) {
      res.json({ ok: true, bypass: true });
      return;
    }

    const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
    const claimToken = typeof req.body?.claimToken === "string" ? req.body.claimToken.trim() : "";
    if (!key) {
      res.status(400).json({ ok: false, error: "Access key required" });
      return;
    }

    const [row] = await db
      .select({ id: accessKeysTable.id })
      .from(accessKeysTable)
      .where(and(eq(accessKeysTable.keyHash, hashAccessKey(key)), eq(accessKeysTable.active, true)));

    if (!row) {
      res.status(401).json({ ok: false, error: "Invalid or revoked access key" });
      return;
    }

    const [fullRow] = await db
      .select({
        id: accessKeysTable.id,
        claimTokenHash: accessKeysTable.claimTokenHash,
      })
      .from(accessKeysTable)
      .where(and(eq(accessKeysTable.id, row.id), eq(accessKeysTable.active, true)));

    if (!fullRow) {
      res.status(401).json({ ok: false, error: "Invalid or revoked access key" });
      return;
    }

    if (fullRow.claimTokenHash) {
      if (!claimToken || hashClaimToken(claimToken) !== fullRow.claimTokenHash) {
        res.status(409).json({
          ok: false,
          error: "This key is already assigned to another browser or device",
        });
        return;
      }

      await db
        .update(accessKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(accessKeysTable.id, fullRow.id));
      res.json({ ok: true });
      return;
    }

    // Claim atomically so two first-time users cannot claim the same key.
    const newClaimToken = createClaimToken();
    const [claimed] = await db
      .update(accessKeysTable)
      .set({
        claimTokenHash: hashClaimToken(newClaimToken),
        claimedAt: new Date(),
        lastUsedAt: new Date(),
      })
      .where(and(
        eq(accessKeysTable.id, fullRow.id),
        eq(accessKeysTable.active, true),
        isNull(accessKeysTable.claimTokenHash),
      ))
      .returning({ id: accessKeysTable.id });

    if (!claimed) {
      res.status(409).json({
        ok: false,
        error: "This key was just assigned to another browser or device",
      });
      return;
    }

    res.json({ ok: true, claimToken: newClaimToken });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Unable to verify access key" });
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

// List key metadata only. The plaintext key is shown once, immediately after
// generation, and is never recoverable from the server.
router.get("/admin/access-keys", adminAuth, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: accessKeysTable.id,
        label: accessKeysTable.label,
        active: accessKeysTable.active,
        createdAt: accessKeysTable.createdAt,
        claimedAt: accessKeysTable.claimedAt,
        lastUsedAt: accessKeysTable.lastUsedAt,
      })
      .from(accessKeysTable)
      .orderBy(desc(accessKeysTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch access keys" });
  }
});

router.post("/admin/access-keys", adminAuth, async (req, res) => {
  try {
    const plainKey = createAccessKey();
    const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 80) : null;
    const [row] = await db
      .insert(accessKeysTable)
      .values({ keyHash: hashAccessKey(plainKey), label: label || null, active: true })
      .returning({
        id: accessKeysTable.id,
        label: accessKeysTable.label,
        active: accessKeysTable.active,
        createdAt: accessKeysTable.createdAt,
      });
    res.json({ ...row, key: plainKey });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate access key" });
  }
});

router.patch("/admin/access-keys/:id", adminAuth, async (req, res) => {
  try {
    const active = Boolean(req.body?.active);
    const [row] = await db
      .update(accessKeysTable)
      .set({ active })
      .where(eq(accessKeysTable.id, Number(req.params.id)))
      .returning({ id: accessKeysTable.id, active: accessKeysTable.active });
    if (!row) {
      res.status(404).json({ error: "Access key not found" });
      return;
    }
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update access key" });
  }
});

// Permanently delete an access key. This also removes its device claim,
// so the key can never be reactivated or used again.
router.delete("/admin/access-keys/:id", adminAuth, async (req, res) => {
  try {
    const deleted = await db
      .delete(accessKeysTable)
      .where(eq(accessKeysTable.id, Number(req.params.id)))
      .returning({ id: accessKeysTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Access key not found" });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to permanently delete access key" });
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
