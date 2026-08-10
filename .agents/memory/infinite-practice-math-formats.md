---
name: Infinite Practice math formats
description: Infinite Practice content mixes MathML markup with delimited LaTeX in the same question payload.
---

Infinite Practice question, option, and solution content can contain both `<math>` MathML and `\( … \)`/other delimited LaTeX. The UI renderer must normalize MathML before KaTeX auto-rendering rather than assuming one format.

**Why:** The live API returns MathML for structured fractions, roots, powers, and combinations, while other records use raw LaTeX. Supporting only one format leaves visible equation markup or plain source text.

**How to apply:** Keep the normalization path tolerant of mixed HTML, preserve MathML placeholder positions such as `<none>` in multiscripts, and run KaTeX after DOM parsing.