// Types for evidence.mjs so tests/phase-gate.spec.ts type-checks under `astro check` (strict).
export type EvidenceStatus = 'SATISFIED' | 'MISSING';
export type GateStatus = 'SATISFIED' | 'OWNER APPROVAL REQUIRED' | 'OWNER DECISION REQUIRED' | 'HUMAN EVIDENCE REQUIRED' | 'MISSING' | 'BLOCKED' | 'NOT REQUIRED' | 'NOT OPENED';
export type CriterionKind = 'human-evidence' | 'owner-approval' | 'owner-decision' | 'verification' | 'not-required' | 'blocked';

export interface Criterion {
  id: string;
  label: string;
  kind: CriterionKind | string;
  value: string;
  claimed?: boolean;
  reason?: string;
}

export interface GateItem extends Criterion {
  status: GateStatus;
  reason: string;
  waitingOn?: GateStatus;
}

export interface Gate {
  items: GateItem[];
  pass: 'SATISFIED' | 'BLOCKED';
}

export interface ParsedField {
  declared: string;
  value: string;
  status: string;
  reason: string;
}

export const STATUSES: GateStatus[];
export function classifyEvidence(text: string, opts?: { claimed?: boolean; minWords?: number }): { status: EvidenceStatus; reason: string };
export function evaluateGate(criteria: Criterion[]): Gate;
export function unresolved(gate: Gate): GateItem[];
export function decideClose(gate: Gate): { recordPass: boolean; reason: string; open?: GateItem[] };
export function resumeState(facts: { prMerged: boolean; mainVerified: boolean; planTasksOpen?: number; gate?: Gate }): 'IMPLEMENTING' | 'OWNER GATE' | 'CLOSEOUT';
export function parseGateNote(markdown: string): Record<string, ParsedField>;
