import type { CaseRecord } from '../../../shared';

export function AnalysisPanel({ record, result }: { record: CaseRecord; result: unknown }) {
  return <section className="card"><h2>Analysis & questions</h2><p className="muted">Fixed training states. No approved guidance is enabled.</p>
    <p><strong>{record.followUp.rounds} rounds · {record.followUp.totalQuestions} questions</strong> · {record.followUp.stopped ? 'Questioning ended' : 'Questioning open'}</p>
    <pre className="compact">{JSON.stringify(record.analysis, null, 2)}</pre>
    {record.followUp.questions.map((question, index) => <div className="question" key={index}><strong>{question.id}</strong><pre className="compact">{JSON.stringify(question, null, 2)}</pre></div>)}
    {result !== undefined && <details open><summary>Last adapter result (not applied to case)</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>}
  </section>;
}
