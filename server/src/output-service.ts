import { chromium } from 'playwright';
import type { ExportRuntime } from '../../shared/module-ports';
import { outputSnapshot } from '../../shared/outputs';
import { outputSnapshotToHtml, outputSnapshotToMarkdown, outputSnapshotFilename } from '../../shared/export';
import { ApiError } from './model';

/** A01 discovers this registration; legacy /api/export is left intact. */
export const exportRuntime: ExportRuntime = async input => {
  let snapshot;
  try { snapshot = outputSnapshot(input.case, input.objectId); }
  catch { throw new ApiError(409, 'EXPORT_REVIEW_REQUIRED', 'Save and final-review the current object and dependencies before export.'); }
  if (input.fault === 'failure') throw new ApiError(503, 'EXPORT_FAILED', 'Output failed; body and valid reviews retained. Retry the same version.', true);
  const filename = outputSnapshotFilename(snapshot, input.format === 'pdf' ? 'pdf' : 'md');
  if (input.format === 'markdown') return { snapshot, filename, bytes: Buffer.from(outputSnapshotToMarkdown(snapshot)), contentType: 'text/markdown; charset=utf-8' };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(outputSnapshotToHtml(snapshot), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { snapshot, filename, bytes: await page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center">SYNTHETIC local draft · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' }), contentType: 'application/pdf' };
  } catch { throw new ApiError(503, 'PDF_UNAVAILABLE', 'PDF unavailable. Install Chromium / CJK fonts and retry the same saved version.', true); }
  finally { await browser?.close(); }
};
