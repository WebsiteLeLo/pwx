---
name: Infinite Practice API IDs
description: Non-obvious ID mapping across the Infinite Practice endpoints.
---

Infinite Practice does not use one universal ID for every request. The subjects catalog and chapter/start-test batch can differ, while the start-test response returns the dynamic test ID that must be used for both submit-test and test-solution.

**Why:** The old submit-question-test route is unavailable for this flow; treating a fixed service ID, batch ID, or returned test ID as interchangeable causes valid-looking requests to hit the wrong route.

**How to apply:** Use EXAM start-test, retain `data._id`, submit the complete `questionsResponse` to `/{testId}/infinitePractice/submit-test`, then GET `/{testId}/infinitePractice/test-solution`.