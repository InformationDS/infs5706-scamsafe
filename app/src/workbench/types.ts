import type { RuntimeCaseRecord } from '../../../shared/runtime';
import type { FactRecord, Question, Target } from '../../../shared/schema';
import type { ConfirmedMapping } from '../../../shared/conversation';

export type WorkbenchActions = {
  sendMessage(input: { text: string; questionIds: string[]; draftRevision: number }): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  resolveEarlierAnswer(input: { messageId: string; target: Target; candidateSourceId: string; choice: 'keep-current' | 'use-earlier'; reason: string; expectedCaseVersion: number }): Promise<void>;
  clarifyMessage(input: { messageId: string; expectedCaseVersion: number; decisions: ConfirmedMapping[]; retainedQuotes: string[] }): Promise<void>;
  reanalyzeCurrentCase(): Promise<void>;
  setQuestionStatus(input: { questionId: string; status: 'unknown' | 'not-applicable'; reason: string }): Promise<void>;
  endFollowUp(): Promise<void>;
  displayQuestionRound(): Promise<void>;
  correctFact(input: { target: Target; value: FactRecord['value']; reason: string }): void;
  correctTypes(input: { types: string[]; reason: string }): void;
  confirmFacts(): Promise<void>;
  decide(input: { id: string; decision: 'accepted' | 'modified' | 'rejected'; reason?: string; step?: string }): void;
  generateMaterials(): void;
  recordOutputEdit(input: { id: string; body: string; reason: string }): void;
  changeOutputRecipient(input: { id: string; recipientId: string; reason: string }): void;
  replaceProtected(input: { ids: string[]; reason: string; expectedCaseVersion: number }): void;
  reviewSelection(input: { outputIds: string[]; acknowledged: boolean; expectedCaseVersion: number }): Promise<void>;
  deliver(input: { objectId: string; format: 'copy' | 'markdown' | 'pdf' }): Promise<void>;
};
export type CasePaneProps = { record: RuntimeCaseRecord; actor: string; actions: WorkbenchActions; locked: boolean; notice: string; reportDraft: (key: string, dirty: boolean) => void };
export type QuestionProposalView = { caseId: string; instanceId: string; basedOnCaseVersion: number; dependencies: Record<string, number>; questions: Question[] };
export type ProtectedComparisonView = { caseId: string; instanceId: string; expectedCaseVersion: number; items: Array<{ id: string; current: RuntimeCaseRecord['outputs'][number]; proposed: RuntimeCaseRecord['outputs'][number] }> };
