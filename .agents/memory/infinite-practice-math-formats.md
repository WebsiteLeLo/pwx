---
name: Infinite Practice math formats
description: Infinite Practice content mixes MathML markup with delimited LaTeX in the same question payload.
---

Infinite Practice question, option, and solution content can contain both `<math>` MathML and `\( … \)`/other delimited LaTeX. Some records also arrive double-escaped (`\\(`, `\\frac`, `\\left`). The UI renderer must normalize these before KaTeX auto-rendering. KaTeX mutates rendered DOM in place, so the content wrapper must not also be React-controlled with `dangerouslySetInnerHTML`.

**Why:** The live API returns MathML for structured fractions, roots, powers, and combinations, while other records use raw or double-escaped LaTeX. Supporting only one format leaves visible equation markup or plain source text. React reconciliation on option selection can otherwise overwrite KaTeX's generated nodes and break equations.

**How to apply:** Keep the normalization path tolerant of mixed HTML, preserve MathML placeholder positions such as `<none>` in multiscripts, and run KaTeX after DOM parsing.