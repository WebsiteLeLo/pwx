---
name: Server-controlled access gate
description: The site access gate is controlled by a persistent server setting and validates hashed administrator-issued keys.
---

The access gate must be enforced through the API, not only through browser storage. The client may remember a key for convenience, but the server remains authoritative for whether the gate is enabled and whether a key is active.

**Why:** A local-only access flag can be copied or edited by visitors and cannot be revoked centrally.

**How to apply:** Keep public verification responses free of key material; return plaintext keys only once from an authenticated admin generation action, and use the admin panel for global enable/disable, per-key revoke/reactivate, and permanent deletion. On first verification, atomically bind each key to a server-issued claim token stored by that browser; later verification requires the same token. Permanent deletion removes the key and its claim permanently.

The Arolinks generation flow uses a short-lived server-side handoff: the browser prepares a one-time token before leaving for the shortener, then `/verify` exchanges it for a newly generated key and verifies that key normally.

**Why:** Arolinks returns to `/verify` without the administrator key in the URL, so checking only an old localStorage key incorrectly showed “expired” after a successful redirect.

**How to apply:** Keep the handoff token hashed in the database, expire it quickly, consume it transactionally, and never treat a bare `/verify` visit as a successful generation.