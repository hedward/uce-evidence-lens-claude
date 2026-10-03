import type { EvidenceCheck, ChronologyItem } from '@uce/lens-verifier';

export interface Assertion {
  category: string;
  label: string;
  value: string;
  source: string;
  limitation: string;
}
export interface TransactionChronology {
  kind: 'manifest' | 'file';
  transactionId?: string;
  check: EvidenceCheck;
  limitation: string;
}
export interface Inspection {
  status: 'complete' | 'partial' | 'unavailable' | 'unsupported' | 'invalid';
  reference: string;
  sourceUrl?: string;
  lensUrl?: string;
  checkedAt: string;
  executionContext: 'server';
  verifier: { name: string; version: string; sourceCommit: string };
  record?: { title: string; schema: string; schemaVersion: string; manifestHash: string; fileCount: number };
  summary: string;
  checks: EvidenceCheck[];
  chronology: { recorded: ChronologyItem[]; transactions: TransactionChronology[] };
  assertions: Assertion[];
  coverage: { manifestContents: 'not_recomputed' | 'recomputed' | 'mismatch'; limitations: string[] };
  legalNotice: string;
  error?: { code: string; retryable: boolean; message: string };
}
export interface InspectionReport {
  reportSchema: 'uce.evidence-lens.chatgpt-inspection-report';
  reportVersion: '1.0.0';
  createdAt: string;
  unsigned: true;
  datedSnapshotDisclaimer: string;
  inspection: Inspection;
}
export interface ToolOutput { inspection: Inspection; report?: InspectionReport }
