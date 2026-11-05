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

// E01 serializers are separate so A01 legacy API and MOCK snapshots stay compatible.
import { RuntimeExportSnapshotSchema, type RuntimeExportSnapshot } from './runtime';
import { outputNotice } from './outputs';
export function outputSnapshotFilename(s: RuntimeExportSnapshot, ext: 'md' | 'pdf'): string {
  const safe = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safe(s.caseId)}_${s.objectId === 'SUMMARY' ? 'summary' : safe(s.objectId)}_v${s.objectVersion}.${ext}`;
}
function outputMeta(s: RuntimeExportSnapshot) {
  return `Case: ${s.caseId} | case version: ${s.caseVersion}\nObject: ${s.objectId} | object version: ${s.objectVersion}\n${s.review.label} · ${s.review.actor} · ${s.review.reviewedAt}\nEmployee review is not content approval, external verification or delivery.`;
}
export function outputSnapshotToMarkdown(input: RuntimeExportSnapshot): string {
  const s = RuntimeExportSnapshotSchema.parse(input);
  return `# ${s.title}\n\n${outputNotice}\n\n${outputMeta(s)}\n\n${s.body}\n`;
}
// Small, deliberately non-HTML Markdown subset. All text is escaped; no links, images,
// scripts or remote resources. Unknown syntax stays visible as text.
function bodyHtml(body: string): string {
  const lines = body.split('\n'), parts: string[] = [];
  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
  const text = (v: string) => escapeHtml(v).replaceAll('&lt;br&gt;', '<br>');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|') && /^\|[\s:|\-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      parts.push(`<table><thead><tr>${cells(line).map(c => `<th>${text(c)}</th>`).join('')}</tr></thead><tbody>`); i += 2;
      for (; i < lines.length && lines[i].startsWith('|'); i++) parts.push(`<tr>${cells(lines[i]).map(c => `<td>${text(c)}</td>`).join('')}</tr>`);
      parts.push('</tbody></table>'); i--; continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) parts.push(`<h${heading[1].length + 1}>${text(heading[2])}</h${heading[1].length + 1}>`);
    else if (line) parts.push(`<div class="line">${text(line)}</div>`);
    else parts.push('<div class="space"></div>');
  }
  return parts.join('\n');
}
export function outputSnapshotToHtml(input: RuntimeExportSnapshot): string {
  const s = RuntimeExportSnapshotSchema.parse(input);
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(s.title)}</title><style>
  @page { size:A4; margin:18mm 16mm 20mm; }
  * { box-sizing:border-box; } body { margin:0; color:#182d3b; font:10pt/1.5 Arial,"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif; overflow-wrap:anywhere; }
  h1 { font-size:20pt; } h2,h3,h4 { break-after:avoid; margin:14pt 0 6pt; } h2 { font-size:14pt; } h3 {font-size:12pt;} h4 {font-size:11pt;}
  .notice { border:1px solid #956600; background:#fff7df; padding:9pt; } .meta {white-space:pre-wrap; font-size:9pt;margin:10pt 0;} .line {white-space:pre-wrap; orphans:2;widows:2;} .space {height:5pt;}
  table {border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt;margin:8pt 0;} th,td {border:1px solid #9caeb8;padding:5pt;vertical-align:top;overflow-wrap:anywhere;} th {background:#edf4f5;text-align:left;} thead {display:table-header-group;} tr {break-inside:avoid;} p {orphans:3;widows:3;}
  </style></head><body><h1>${escapeHtml(s.title)}</h1><div class="notice">${escapeHtml(outputNotice)}</div><div class="meta">${escapeHtml(outputMeta(s))}</div><main>${bodyHtml(s.body)}</main></body></html>`;
}
