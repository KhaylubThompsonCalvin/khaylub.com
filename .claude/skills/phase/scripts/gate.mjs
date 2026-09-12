#!/usr/bin/env node
// Validate a canonical Owner Gate note and print the gate record.
// Usage: node .claude/skills/phase/scripts/gate.mjs "<path to Phase N - Owner Gate.md>"
// Exit 0 when every field declared SATISFIED holds real content and no required field is MISSING;
// exit 2 when the gate is BLOCKED (the normal state while owner or human evidence is outstanding).
import { readFileSync } from 'node:fs';
import { parseGateNote } from './evidence.mjs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node gate.mjs <owner-gate-note.md>');
  process.exit(1);
}
const fields = parseGateNote(readFileSync(path, 'utf8'));
let blocked = false;
const rows = Object.entries(fields).map(([field, f]) => {
  const required = !['NOT REQUIRED', 'NOT OPENED', 'SATISFIED'].includes(f.status);
  if (required) blocked = true;
  return `${f.status.padEnd(26)} ${field}${f.reason && f.status !== 'SATISFIED' && f.reason !== 'as declared' ? `  (${f.reason})` : ''}`;
});
console.log(rows.join('\n'));
console.log(`\nGATE: ${blocked ? 'BLOCKED (do not record PASS)' : 'SATISFIED (PASS may be recorded by the owner)'}`);
process.exit(blocked ? 2 : 0);
