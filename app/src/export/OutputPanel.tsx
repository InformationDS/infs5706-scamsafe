import { useState } from 'react';
import { buildSnapshot, type CaseRecord } from '../../../shared';
import { snapshotToHtml, snapshotToMarkdown } from '../../../shared/export';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OutputPanel({ record, report }: { record: CaseRecord; report: (message: string) => void }) {
  const [selected, setSelected] = useState('');
  const [failOutput, setFailOutput] = useState(false);
  const objectId = record.outputs.some(output => output.id === selected) ? selected : record.outputs[0]?.id ?? '';
  let html = ''; let unavailable = '';
  try { html = snapshotToHtml(buildSnapshot(record, objectId)); } catch (error) { unavailable = (error as Error).message; }
  async function output(format: 'markdown' | 'pdf') {
    try {
      const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case: record, objectId, format, ...(failOutput ? { fault: 'failure' } : {}) }) });
      if (!response.ok) throw new Error((await response.json()).error?.message ?? 'Export failed. Review and saved state were retained.');
      const name = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `EXAMPLE-01_${objectId}.${format === 'pdf' ? 'pdf' : 'md'}`;
      downloadBlob(await response.blob(), name); report(`${format === 'pdf' ? 'PDF' : 'Markdown'} generated from the selected training snapshot.`);
    } catch (error) { report((error as Error).message); }
  }
  async function copy() { try { const text = snapshotToMarkdown(buildSnapshot(record, objectId)); if (failOutput) throw new Error('Simulated copy failure'); await navigator.clipboard.writeText(text); report('Copied training snapshot.'); } catch { report('Copy failed. Review state was retained; retry or download Markdown.'); } }
  return <section className="card"><h2>Preview & output</h2><p className="muted">Legacy synthetic output retains pending labels; approved business references are separate. Simulated review is labelled in every format.</p>
    <label>Output object<select value={objectId} onChange={event => setSelected(event.target.value)}><option value="">Select an available output</option>{record.outputs.map(output => <option key={output.id} value={output.id}>{output.title} · v{output.version}</option>)}</select></label>
    <label className="checkbox"><input type="checkbox" checked={failOutput} onChange={event => setFailOutput(event.target.checked)} />Simulate output failure</label>
    {unavailable ? <p className="notice">Output unavailable: {unavailable}</p> : <><div className="actions"><button onClick={copy}>Copy Markdown</button><button onClick={() => output('markdown')}>Download Markdown</button><button onClick={() => output('pdf')}>Download PDF</button></div><iframe title="Training output preview" sandbox="" srcDoc={html} /></>}
  </section>;
}
