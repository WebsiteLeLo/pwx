---
name: Server-controlled access gate
description: The site access gate is controlled by a persistent server setting and validates hashed administrator-issued keys.
---

The access gate must be enforced through the API, not only through browser storage. The client may remember a key for convenience, but the server remains authoritative for whether the gate is enabled and whether a key is active.

**Why:** A local-only access flag can be copied or edited by visitors and cannot be revoked centrally.

**How to apply:** Keep public verification responses free of key material; return plaintext keys only once from an authenticated admin generation action, and use the admin panel for global enable/disable plus per-key revocation. On first verification, atomically bind each key to a server-issued claim token stored by that browser; later verification requires the same token.