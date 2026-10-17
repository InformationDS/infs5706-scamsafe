import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { BusinessApprovalSchema, BusinessBaselineSchema } from '../../shared/business.js';

export function loadBusinessBaseline(root = process.cwd()) {
  const approval = BusinessApprovalSchema.parse(JSON.parse(readFileSync(resolve(root, 'data/business/approval.json'), 'utf8')));
  const required = ['data/business/role.json', 'data/business/guidelines.json', 'data/business/T09.json'];
  if (Object.keys(approval.artifacts).length !== required.length || required.some(path => !approval.artifacts[path])) throw new Error('Approval inventory does not match business files');
  const data = required.map(path => {
    const bytes = readFileSync(resolve(root, path));
    if (createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8').digest('hex') !== approval.artifacts[path]) throw new Error(`Approved content differs from registry: ${path}`);
    return JSON.parse(bytes.toString('utf8'));
  });
  return BusinessBaselineSchema.parse({ approval, role: data[0], guidelines: data[1], baseline: data[2] });
}
