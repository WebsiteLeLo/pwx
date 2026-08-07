---
name: External batch API failures
description: Defensive handling required for the external batch and schedule API.
---

The external batch API can return HTTP 403 rate-limit responses or successful envelopes with missing arrays. These are expected service failures, not renderable batch data.

**Why:** A batch page treated every JSON response as `{ data: { subjects } }`, so a rate-limit response caused a render crash and a blank screen.

**How to apply:** Validate HTTP status, success flag, and required arrays in the query function; throw a user-facing error for invalid responses; keep a top-level render boundary so unexpected fields show retry navigation instead of a blank page.