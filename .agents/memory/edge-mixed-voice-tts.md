---
name: Edge mixed-voice TTS
description: Constraint and implementation rule for switching Hindi and Indian English voices in the app's Edge Read Aloud TTS.
---

Edge Read Aloud accepts a single voice per synthesis request. A single SSML document containing multiple `<voice>` blocks or inline language switching can close the stream before `turn.end`, producing a 500/error response. Separate audio requests per language also create audible boundary pauses when joined.

**Why:** The app needs natural, uninterrupted Hinglish speech. Artificial pauses between language-specific audio files are worse than the occasional imperfect pronunciation of an English word.

**How to apply:** Use one continuous `hi-IN-SwaraNeural` request for the whole cleaned reply and one browser `SpeechSynthesisUtterance` fallback. Do not synthesize and concatenate per-language segments unless gapless PCM/audio stitching is introduced.