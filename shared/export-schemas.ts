import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { AnalysisEnvelopeSchema, AnalysisResultSchema, CaseRecordSchema, ExportSnapshotSchema, GuidelineSchema, RoleProfileSchema, RecommendationSchema, HandoverDraftSchema, SummarySchema } from './schema.js';
import { ApprovedRoleSchema, ApprovedGuidelineSchema, BusinessApprovalSchema, BusinessCaseSchema, BusinessBaselineSchema } from './business.js';
import { RuntimeCaseRecordSchema, RuntimeExportSnapshotSchema } from './runtime.js';

const directory = resolve('data/schemas');
mkdirSync(directory, { recursive: true });
for (const [name, schema] of Object.entries({ CaseRecord: CaseRecordSchema, AnalysisResult: AnalysisResultSchema, AnalysisEnvelope: AnalysisEnvelopeSchema, ExportSnapshot: ExportSnapshotSchema, RoleProfile: RoleProfileSchema, Guideline: GuidelineSchema, Recommendation: RecommendationSchema, HandoverDraft: HandoverDraftSchema, Summary: SummarySchema })) {
  writeFileSync(resolve(directory, `${name}.schema.json`), JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
}
const businessDirectory = resolve('data/business/schemas');
for (const [name, schema] of Object.entries({ RuntimeCaseRecord: RuntimeCaseRecordSchema, RuntimeExportSnapshot: RuntimeExportSnapshotSchema })) {
  writeFileSync(resolve(directory, `${name}.schema.json`), JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
}
mkdirSync(businessDirectory, { recursive: true });
for (const [name, schema] of Object.entries({ ApprovedRole: ApprovedRoleSchema, ApprovedGuideline: ApprovedGuidelineSchema, BusinessApproval: BusinessApprovalSchema, BusinessCase: BusinessCaseSchema, BusinessBaseline: BusinessBaselineSchema })) {
  writeFileSync(resolve(businessDirectory, `${name}.schema.json`), JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
}
