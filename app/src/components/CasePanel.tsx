import type { CaseRecord } from '../../../shared';

export function CasePanel({ record }: { record: CaseRecord }) {
  return <section className="card"><div className="section-heading"><h2>Shared case facts</h2><span className="chip">{record.facts.length} fields</span></div>
    <p className="muted">Reported values and source references. Staff checks do not verify external facts.</p>
    <div className="fact-table"><table><thead><tr><th>Target</th><th>Current value</th><th>Status / source</th></tr></thead>
      <tbody>{record.facts.map((fact, index) => <tr key={index}><td><code>{fact.fieldId}{fact.recordId ? ` / ${fact.recordId}` : ''}</code></td><td>{fact.value === null ? <em>Unknown</em> : String(fact.value)}</td><td><span className="chip">{fact.status}</span><small>{fact.sourceIds.join(', ') || 'No source'}</small></td></tr>)}</tbody></table></div>
    <details><summary>Full shared record (technical reference)</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
  </section>;
}
