import { ExportSnapshotSchema, type ExportSnapshot } from './index';

export const trainingNotice = 'SYNTHETIC / MOCK - Content not approved. Training review simulation only. Local draft; no delivery or external verification.';
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function snapshotToMarkdown(input: ExportSnapshot): string {
  const snapshot = ExportSnapshotSchema.parse(input);
  return [
    `# ${snapshot.title}`, '', trainingNotice, '',
    `Case: ${snapshot.caseId} | Case version: ${snapshot.caseVersion}`,
    `Object: ${snapshot.objectId} | Object version: ${snapshot.objectVersion}`, '',
    snapshot.body, '',
  ].join('\n');
}

export function snapshotToHtml(input: ExportSnapshot): string {
  const snapshot = ExportSnapshotSchema.parse(input);
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(snapshot.title)}</title>
  <style>
  @page {size:A4; margin:18mm 17mm;}
  * {box-sizing:border-box;} body {font:12pt/1.55 Arial,"Microsoft YaHei","PingFang SC",sans-serif;color:#172b37;margin:0;}
  h1 {font-size:22pt;line-height:1.2;break-after:avoid;} .notice {border:1px solid #b48330;padding:12px;background:#fff8e9;font-size:10pt;}
  .meta {font-size:10pt;color:#425866;margin:16px 0;} .body {white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3;}
  </style></head><body><h1>${escapeHtml(snapshot.title)}</h1><div class="notice">${trainingNotice}</div>
  <div class="meta">Case: ${escapeHtml(snapshot.caseId)} | Case version: ${snapshot.caseVersion}<br>
  Object: ${escapeHtml(snapshot.objectId)} | Object version: ${snapshot.objectVersion}</div>
  <div class="body">${escapeHtml(snapshot.body)}</div></body></html>`;
}

export function snapshotFilename(snapshot: ExportSnapshot, ext: 'md' | 'pdf'): string {
  const safe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safe(snapshot.caseId)}_${safe(snapshot.objectId)}_v${snapshot.objectVersion}.${ext}`;
}
