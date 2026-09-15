// Times the rollback rehearsal (runbook section 4): polls a hostname and prints a timestamped line
// every time the answering site changes, so the "point at V2, then back" legs are timed by the
// clock, not by hand. V2 is recognised by the headers render.yaml declares on every response
// (Cross-Origin-Opener-Policy and X-Frame-Options: DENY); V1 by their absence with a 200; anything
// else (DNS not resolving, a certificate not yet issued, a 404 from the host) is reported as is.
// Usage: node scripts/rehearsal-watch.mjs <hostname> [--minutes 30] [--every 5]
const host = process.argv.find((a, i) => i >= 2 && !a.startsWith('--') && !/^\d+$/.test(a));
if (!host) { console.error('usage: node scripts/rehearsal-watch.mjs <hostname> [--minutes 30] [--every 5]'); process.exit(2); }
const opt = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) || def : def; };
const minutes = opt('--minutes', 30);
const every = opt('--every', 5);

async function who() {
  try {
    const res = await fetch(`https://${host}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    await res.arrayBuffer();
    if (res.status !== 200) return `status ${res.status}`;
    const v2 = res.headers.get('cross-origin-opener-policy') === 'same-origin' && res.headers.get('x-frame-options') === 'DENY';
    return v2 ? 'V2 (khaylub.com headers present)' : 'V1 (no V2 headers)';
  } catch (e) {
    return `unreachable (${e.cause?.code ?? e.name})`;
  }
}

const started = Date.now();
let last = null;
let lastChange = started;
console.log(`${new Date().toISOString()}  watching https://${host}/ every ${every} s for up to ${minutes} min`);
while (Date.now() - started < minutes * 60_000) {
  const now = await who();
  if (now !== last) {
    const t = new Date();
    const since = last === null ? '' : `  (${((t - lastChange) / 1000).toFixed(0)} s since the previous state)`;
    console.log(`${t.toISOString()}  ${now}${since}`);
    last = now;
    lastChange = t;
  }
  await new Promise((r) => setTimeout(r, every * 1000));
}
console.log(`${new Date().toISOString()}  stopped after ${minutes} min; last state: ${last}`);
