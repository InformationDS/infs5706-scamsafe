# E01 PDF visual observation

Observed by the agent after rendering each final PDF page to PNG; not human content approval or F acceptance. Linux Chromium 156.0.8078.4, Noto Sans CJK SC.

| File | Page | Observed |
| --- | --- | --- |
| chinese-long-table.pdf | 1/5 | Header and current-fact table readable; no clipping. |
| chinese-long-table.pdf | 2/5 | Repeated table header; remaining facts, uncertainty and sources complete. |
| chinese-long-table.pdf | 3/5 | Recipient, guidance limits and Chinese table start readable. |
| chinese-long-table.pdf | 4/5 | Chinese table header repeats; long unbroken token wraps inside cell; paragraphs 1–10 readable. |
| chinese-long-table.pdf | 5/5 | Chinese paragraphs 11–16 and E01-END present; footer clear. |
| no-guidance.pdf | 1/3 | Header and current-fact table readable; no clipping. |
| no-guidance.pdf | 2/3 | Continuation, margins and footer readable; no overlap. |
| no-guidance.pdf | 3/3 | Historical source distinguished from current 200; fixed no-guidance notice present; no recipient route. |
| same-version-retry.pdf | 1/5 | Header and current-fact table readable; no clipping. |
| same-version-retry.pdf | 2/5 | Repeated table header; remaining facts, uncertainty and sources complete. |
| same-version-retry.pdf | 3/5 | Recipient, guidance limits and Chinese table start readable. |
| same-version-retry.pdf | 4/5 | Chinese table header repeats; long unbroken token wraps inside cell; paragraphs 1–10 readable. |
| same-version-retry.pdf | 5/5 | Chinese paragraphs 11–16 and E01-END present; footer clear. |
| summary.pdf | 1/4 | Header and current-fact table readable; no clipping. |
| summary.pdf | 2/4 | Continuation, margins and footer readable; no overlap. |
| summary.pdf | 3/4 | Continuation, margins and footer readable; no overlap. |
| summary.pdf | 4/4 | REC-03 limits and source ending present; footer clear. |

Text verification: 167 HTML heading / line / table-cell blocks were found in normalized PDF raw text; none missing. The five retry-page PNGs and extracted text are byte-identical to the original stress PDF renders. Other platforms, arbitrary Markdown extensions and extremely tall individual table rows remain unverified.
