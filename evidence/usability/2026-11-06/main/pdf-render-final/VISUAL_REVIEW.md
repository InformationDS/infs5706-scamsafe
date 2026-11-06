# Final automated PDF sample review

These PDFs were downloaded by the existing E01 automated browser test, separately from the computer-use batch.

The main agent inspected full-page contact sheets for summary (4 pages), Chinese long text/table (5 pages) and no-guidance summary (3 pages). Table continuation, body text, CJK characters and page footers were visible. No apparent clipping, overlap or missing glyphs was observed in those samples. The Chinese text includes all 16 numbered paragraphs and its E01-END marker. Per-page renderings and extracted text remain in this directory.

The guideline token label regression observed in pdf-render-run-01 is absent in these final samples. The same-version retry renders identically on all five pages, as recorded in retry-pixel-comparison.json. Whole-file PDF hashes differ because generated document metadata can differ between requests.

This review covers the current finite samples. It does not establish arbitrary Markdown syntax or unbounded table row support.
