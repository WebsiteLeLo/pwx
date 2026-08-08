---
name: Video player buffering and downloads
description: Playback buffering and safe download behavior for lecture and live video players
---

Protected DASH/HLS manifests should never be exposed as downloadable files. The player may show a download control, but it must only start a download when the upstream API provides a direct media-file URL; route that file through an allowlisted server proxy with attachment headers. Live streams should explain that downloading is unavailable rather than pretending to save a file.

**Why:** Browsers cannot reliably download segmented or DRM-protected playback as one video file, and exposing arbitrary proxy URLs creates a security risk.

**How to apply:** Keep HLS and Shaka buffering/retry settings tuned independently, preserve adaptive bitrate selection, and validate download URLs by host and media-file extension on the server. For signed live HLS, extend HLS.js's built-in loader rather than replacing it with a shared fetch/AbortController implementation; playlist and fragment requests must keep independent cancellation and retry state.