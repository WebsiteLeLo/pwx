---
name: Infinite Practice API IDs
description: Non-obvious ID mapping across the Infinite Practice endpoints.
---

Infinite Practice does not use one universal ID for every request. The subjects catalog, chapter/start-test batch, and submit-question-test service can have different IDs supplied by the upstream API contract.

**Why:** Treating the returned test document ID or one batch ID as interchangeable with the upstream service ID causes valid-looking requests to hit the wrong route.

**How to apply:** Keep each endpoint's path and ID mapping explicit in the API hook, and verify the upstream response envelope before changing the mapping.