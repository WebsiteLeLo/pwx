---
name: Edge mixed-voice TTS
description: Constraint and implementation rule for switching Hindi and Indian English voices in the app's Edge Read Aloud TTS.
---

Edge Read Aloud accepts a single voice per synthesis request. A single SSML document containing multiple `<voice>` blocks or inline language switching can close the stream before `turn.end`, producing a 500/error response.

**Why:** The app needs romanized Hindi to remain Hindi-pronounced while recognizable English words use Indian English pronunciation, but reliability is more important than forcing unsupported SSML.

**How to apply:** Split Hinglish into conservative Hindi/English runs, synthesize each run with `hi-IN-SwaraNeural` or `en-IN-NeerjaExpressiveNeural`, then concatenate the resulting MP3 frames into the one browser response. Keep a browser speech-synthesis fallback that queues language-specific chunks.