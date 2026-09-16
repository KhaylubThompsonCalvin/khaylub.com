import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
// The /phase skill's owner-gate logic. Pure functions, no browser: run once, in the desktop project.
import { classifyEvidence, evaluateGate, decideClose, resumeState, unresolved, parseGateNote } from '../.claude/skills/phase/scripts/evidence.mjs';

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure logic; run once, in the desktop project');
});

const human = (label: string, value: string, claimed = false) => ({ id: label, label, kind: 'human-evidence', value, claimed });

test.describe('owner gate: evidence validation', () => {
  test('genuine reviewer text satisfies a human-evidence field', () => {
    const r = classifyEvidence('Why did you report Spearman as well as Pearson, and what does the gap between them tell you about the two series?');
    expect(r.status).toBe('SATISFIED');
    expect(classifyEvidence('PCC classmate who has taken the SQL course and reads T-SQL daily at work').status).toBe('SATISFIED');
  });

  for (const value of ['[ACTUAL question from the reviewer]', '[question]', '<question>', 'TODO', 'TBD', '', '   ', 'not yet supplied', 'replace me', 'N/A', '[ACTUAL brief description of the reviewer, for example: PCC classmate familiar with SQL]']) {
    test(`placeholder ${JSON.stringify(value)} is MISSING`, () => {
      const r = classifyEvidence(value);
      expect(r.status, r.reason).toBe('MISSING');
    });
  }

  test('example and instructional wording is MISSING even without brackets', () => {
    for (const value of [
      'Describe the reviewer here, for example a classmate familiar with SQL',
      'Paste the first interview question the reviewer wrote',
      'For example: a PCC classmate',
      'Their response goes here',
      'Insert the reviewer explanation',
    ]) {
      expect(classifyEvidence(value).status, value).toBe('MISSING');
    }
  });

  test('an owner claim that placeholder text is actual evidence does not override the content', () => {
    const r = classifyEvidence('[ACTUAL question from the reviewer]', { claimed: true });
    expect(r.status).toBe('MISSING');
    expect(r.reason).toMatch(/claim/i);
  });
});

test.describe('owner gate: records and decisions', () => {
  const criteria = [
    { id: 'approval', label: 'Owner approves each case study', kind: 'owner-approval', value: 'Owner: "I approve the three featured Phase 12 case studies" (2026-09-12)' },
    { id: 'merged', label: 'Corrections merged to main', kind: 'verification', value: 'PR #19 merged as 4848f7a' },
    human('Reviewer identity', '[ACTUAL brief description of the reviewer]', true),
    human('Reviewer question 1', '[ACTUAL question from the reviewer]', true),
    human('Reviewer question 2', 'TBD'),
    human('Reviewer understanding statement', ''),
    { id: 'answers', label: 'Owner answers the reviewer questions', kind: 'not-required', value: '' },
  ];

  test('/phase gate lists only the unresolved owner and human requirements', () => {
    const gate = evaluateGate(criteria);
    expect(gate.items.find((i) => i.id === 'approval')!.status).toBe('SATISFIED');
    expect(gate.items.find((i) => i.id === 'merged')!.status).toBe('SATISFIED');
    expect(gate.items.find((i) => i.id === 'answers')!.status).toBe('NOT REQUIRED');
    expect(unresolved(gate).map((i) => i.id)).toEqual(['Reviewer identity', 'Reviewer question 1', 'Reviewer question 2', 'Reviewer understanding statement']);
    expect(gate.pass).toBe('BLOCKED');
  });

  test('/phase close refuses PASS while required evidence is MISSING, and allows it once genuine', () => {
    const blocked = decideClose(evaluateGate(criteria));
    expect(blocked.recordPass).toBe(false);
    expect(blocked.reason).toMatch(/MISSING/);
    const filled = criteria.map((c) => (c.kind === 'human-evidence' ? { ...c, value: `Genuine ${c.label.toLowerCase()} written by the reviewer on 2026-09-12, long enough to be a real sentence.` } : c));
    expect(decideClose(evaluateGate(filled)).recordPass).toBe(true);
  });

  test('/phase resume recognizes OWNER GATE when implementation is complete but evidence is missing', () => {
    const state = resumeState({ prMerged: true, mainVerified: true, planTasksOpen: 0, gate: evaluateGate(criteria) });
    expect(state).toBe('OWNER GATE');
    expect(resumeState({ prMerged: false, mainVerified: false, planTasksOpen: 3, gate: evaluateGate(criteria) })).toBe('IMPLEMENTING');
  });

  test('a gate note that marks a field SATISFIED with placeholder content is downgraded to MISSING', () => {
    const note = [
      '- Reviewer status: SATISFIED',
      '- Reviewer: [ACTUAL brief description of the reviewer]',
      '- Reviewer question 1 status: SATISFIED',
      '- Reviewer question 1: How did you decide the reporting floor was a floor and not a true zero?',
      '- Next phase status: NOT OPENED',
    ].join('\n');
    const parsed = parseGateNote(note);
    expect(parsed['Reviewer'].status).toBe('MISSING');
    expect(parsed['Reviewer question 1'].status).toBe('SATISFIED');
    expect(parsed['Next phase'].status).toBe('NOT OPENED');
  });

  test('the repository pointer names exactly one next gated phase, NOT opened, after a closed previous phase', () => {
    // The phase numbers are read from the pointer itself, so a normal transition (close N, name
    // N+1 as next) never needs this test edited. The invariant is what matters: the next phase is
    // never marked opened, accepted, or built without the owner's own instruction.
    const claude = readFileSync('CLAUDE.md', 'utf8');
    const pointer = claude.slice(claude.indexOf('## Current phase pointer'));
    expect(pointer.length, 'CLAUDE.md carries a Current phase pointer section').toBeGreaterThan(40);
    // Whitespace-tolerant: the pointer is hard-wrapped prose.
    const nextSentence = /Phase (\d+)\s+\([^)]*\)\s+is\s+the\s+next\s+gated\s+phase\s+and\s+is\s+NOT\s+opened;\s+it\s+opens\s+only\s+on\s+the\s+owner's\s+instruction\s+through\s+`\/phase (\d+)`/g;
    const matches = [...pointer.matchAll(nextSentence)];
    expect(matches.length, 'exactly one phase is named as the next gated phase').toBe(1);
    const next = Number(matches[0][1]);
    expect(Number(matches[0][2]), 'the /phase command names the same phase').toBe(next);
    // The previous gate is the highest phase recorded as accepted and closed. It is normally next - 1;
    // when the roadmap defers a phase by owner decision (Phase 22, D-26), every phase between the last
    // closed one and the next one must be named as DEFERRED, never silently skipped.
    const closed = [...pointer.matchAll(/Phase (\d+)\s+\([^)]*\)\s+is\s+ACCEPTED\s+and\s+CLOSED/g)].map((m) => Number(m[1]));
    expect(closed.length, 'at least one phase is recorded as accepted and closed').toBeGreaterThan(0);
    const previous = Math.max(...closed);
    expect(previous, 'the last closed phase precedes the next gated phase').toBeLessThan(next);
    for (let n = previous + 1; n < next; n += 1) {
      expect(pointer, `Phase ${n} between the last closed phase and the next one is recorded as DEFERRED`).toMatch(new RegExp(`Phase ${n}\\s+\\([^)]*\\)\\s+is\\s+DEFERRED`));
    }
    // No phase at or beyond the next one may be described as opened, accepted, closed, built, or
    // merged (case-sensitive: "NOT opened" is the permitted state, "OPENED" the forbidden one).
    for (const m of pointer.matchAll(/Phase (\d+)\b[^.]*?\b(OPENED|ACCEPTED|CLOSED|merged|built)\b/g)) {
      expect(Number(m[1]), `"${m[0].slice(0, 80)}" describes a phase that is not open`).toBeLessThan(next);
    }
    expect(pointer).not.toMatch(new RegExp(`Phase ${next}[\\s\\S]{0,160}OPENED by the owner`));
    expect(pointer, 'the cutover phase never moves').toMatch(/Phase 21 owns the production move/);
  });
});
