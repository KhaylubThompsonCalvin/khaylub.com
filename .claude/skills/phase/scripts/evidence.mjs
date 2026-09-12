// Owner-gate evidence validation for the /phase skill. Pure functions, no I/O.
// The rule this file enforces: a required evidence field is satisfied by the evidence itself, never
// by a statement about the evidence. Placeholder, template, and instructional text is MISSING no
// matter who asserts otherwise. Tested by tests/phase-gate.spec.ts.

export const STATUSES = ['SATISFIED', 'OWNER APPROVAL REQUIRED', 'OWNER DECISION REQUIRED', 'HUMAN EVIDENCE REQUIRED', 'MISSING', 'BLOCKED', 'NOT REQUIRED', 'NOT OPENED'];

// Whole-value tokens that are never evidence (case-insensitive, punctuation-trimmed).
const TOKENS = new Set(['todo', 'tbd', 'tk', 'n/a', 'na', 'none', 'null', 'pending', 'missing', 'placeholder', 'not yet supplied', 'not supplied', 'not yet', 'replace me', 'replaceme', 'fill in', 'fill me in', 'coming soon', 'lorem ipsum', 'xxx', '...', '?', '-']);

// Words that mark a template slot: the text names the kind of thing that belongs here instead of
// being that thing.
const SLOT_WORDS = /\b(actual|brief description|describe|description of|insert|paste|enter|provide|write|add|fill|replace|name of|goes here|go here|here\b|their response|the reviewer'?s? (question|response|explanation|answer|words)|question from|response from|example|e\.g\.|for instance|sample|template|placeholder|dummy|optional|required field|lorem)\b/i;

// Imperative openers: instructions to a future author, not evidence.
const IMPERATIVE = /^(please\s+)?(describe|insert|paste|enter|provide|write|add|fill|replace|record|state|give|list|type|put|include|attach|supply|specify|summari[sz]e)\b/i;

function normalize(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function stripWrappers(text) {
  let t = text;
  for (let i = 0; i < 3; i++) {
    const m = t.match(/^[\[<{(]\s*(.*?)\s*[\]>})]$/s) || t.match(/^[`"'*_]+(.*?)[`"'*_]+$/s);
    if (!m) break;
    t = m[1].trim();
  }
  return t;
}

/**
 * Classify one evidence value.
 * @param {string} text the field content
 * @param {{claimed?: boolean, minWords?: number}} [opts] claimed: someone asserted this is real evidence
 * @returns {{status: 'SATISFIED'|'MISSING', reason: string}}
 */
export function classifyEvidence(text, opts = {}) {
  const claimed = !!opts.claimed;
  const minWords = opts.minWords ?? 4;
  const note = claimed ? ' The claim that this is actual evidence does not change the classification; content and claim must agree.' : '';
  const raw = normalize(text);
  const missing = (reason) => ({ status: 'MISSING', reason: reason + note });

  if (!raw) return missing('empty value');
  const inner = stripWrappers(raw);
  const wrapped = inner !== raw;
  const lowered = inner.toLowerCase().replace(/[.!:;,]+$/g, '').trim();

  if (!inner) return missing('empty brackets or quotes');
  if (TOKENS.has(lowered)) return missing(`placeholder token "${inner}"`);
  if (/^\[[^\]]*\]$/.test(raw) || /^<[^>]*>$/.test(raw) || /^\{[^}]*\}$/.test(raw)) {
    // A whole value in brackets is a template slot unless it is clearly a long quotation.
    if (inner.split(' ').length < 25 || SLOT_WORDS.test(inner)) return missing(`bracketed template slot "${raw}"`);
  }
  if (IMPERATIVE.test(inner)) return missing(`instruction to the author, not evidence ("${inner.slice(0, 40)}")`);
  if (/^(for example|e\.g\.|example|sample|such as)\b/i.test(inner)) return missing('example text, not evidence');
  if (/\b(goes|go) here\b|\bhere\]?$/i.test(inner) && inner.split(' ').length < 12) return missing('template text ("... here")');
  if (SLOT_WORDS.test(inner) && inner.split(' ').length < 20) return missing(`template language ("${inner.slice(0, 60)}")`);
  if (wrapped && /\b(actual|question|response|explanation|reviewer|name|description)\b/i.test(inner) && inner.split(' ').length < 20) return missing(`bracketed template slot "${raw}"`);
  if (/\[[^\]]{0,60}(actual|question|name|response|explanation|description|insert|paste)[^\]]{0,60}\]/i.test(inner)) return missing('contains an unfilled template slot');
  const words = inner.split(' ').filter((w) => /[a-z0-9]/i.test(w));
  if (words.length < minWords) return missing(`too short to be evidence (${words.length} word${words.length === 1 ? '' : 's'})`);
  return { status: 'SATISFIED', reason: claimed ? 'content is substantive and the claim agrees with it' : 'content is substantive' };
}

const REQUIRED_KINDS = new Set(['human-evidence', 'owner-approval', 'owner-decision', 'verification']);

/**
 * Evaluate a gate from its criteria.
 * criterion: {id, label, kind: 'human-evidence'|'owner-approval'|'owner-decision'|'verification'|'not-required'|'blocked', value, claimed?}
 * Returns {items: [{...criterion, status, reason}], pass: 'SATISFIED'|'BLOCKED'}
 */
export function evaluateGate(criteria) {
  const items = criteria.map((c) => {
    if (c.kind === 'not-required') return { ...c, status: 'NOT REQUIRED', reason: 'not part of this gate' };
    if (c.kind === 'blocked') return { ...c, status: 'BLOCKED', reason: c.reason || 'blocked' };
    const e = classifyEvidence(c.value, { claimed: c.claimed });
    if (e.status === 'SATISFIED') return { ...c, status: 'SATISFIED', reason: e.reason };
    const waiting = c.kind === 'human-evidence' ? 'HUMAN EVIDENCE REQUIRED' : c.kind === 'owner-approval' ? 'OWNER APPROVAL REQUIRED' : c.kind === 'owner-decision' ? 'OWNER DECISION REQUIRED' : 'MISSING';
    // A required field whose content is absent or placeholder is MISSING; the waiting-on label is
    // kept beside it so the report says who must supply it.
    return { ...c, status: 'MISSING', waitingOn: waiting, reason: e.reason };
  });
  const pass = items.some((i) => REQUIRED_KINDS.has(i.kind) && i.status !== 'SATISFIED') ? 'BLOCKED' : 'SATISFIED';
  return { items, pass };
}

/** The items /phase gate reports: required, not yet satisfied. */
export function unresolved(gate) {
  return gate.items.filter((i) => REQUIRED_KINDS.has(i.kind) && i.status !== 'SATISFIED');
}

/** /phase close: may PASS be recorded? Never when any required item is MISSING or BLOCKED. */
export function decideClose(gate) {
  const open = unresolved(gate);
  if (open.length === 0) return { recordPass: true, reason: 'every required gate item is SATISFIED by its own content' };
  return {
    recordPass: false,
    reason: `PASS refused: ${open.length} required item(s) ${open.map((i) => `${i.label}: ${i.status}`).join('; ')}. Complete every independent closeout action, record the gate, and stop.`,
    open,
  };
}

/** /phase resume: what kind of work remains. */
export function resumeState({ prMerged, mainVerified, planTasksOpen, gate }) {
  const implementationDone = !!prMerged && !!mainVerified && (planTasksOpen ?? 0) === 0;
  if (!implementationDone) return 'IMPLEMENTING';
  if (gate && gate.pass !== 'SATISFIED') return 'OWNER GATE';
  return 'CLOSEOUT';
}

/**
 * Parse a canonical Owner Gate note. Lines look like:
 *   - <Field> status: <STATUS>
 *   - <Field>: <value>
 * A field marked SATISFIED whose value is placeholder or absent is downgraded to MISSING.
 */
export function parseGateNote(markdown) {
  // A field exists only where a "<Field> status:" line declares it. Its content is the matching
  // "<Field>:" line. Every other "Key: value" line (frontmatter, sources, waiting-on notes,
  // clarifications) is ignored, so prose can never be mistaken for a gate field.
  const lines = String(markdown).split(/\r?\n/);
  const fields = {};
  for (const line of lines) {
    const m = line.match(/^\s*(?:[-*]\s*|\|\s*)?([^|:\n]+?)\s+status\s*:\s*\|?\s*([A-Z][A-Z /]+?)\s*\|?\s*$/i);
    if (m) fields[m[1].trim()] = { declared: m[2].trim().toUpperCase(), value: '' };
  }
  for (const line of lines) {
    const v = line.match(/^\s*(?:[-*]\s*|\|\s*)?([^|:\n]+?)\s*:\s*\|?\s*(.*?)\s*\|?\s*$/);
    if (v && fields[v[1].trim()] && !/\bstatus$/i.test(v[1])) fields[v[1].trim()].value = v[2].trim();
  }
  for (const f of Object.values(fields)) {
    if (f.declared === 'SATISFIED') {
      const e = classifyEvidence(f.value);
      f.status = e.status === 'SATISFIED' ? 'SATISFIED' : 'MISSING';
      f.reason = e.status === 'SATISFIED' ? e.reason : `declared SATISFIED but the content is not evidence: ${e.reason}`;
    } else {
      f.status = f.declared;
      f.reason = 'as declared';
    }
  }
  return fields;
}
