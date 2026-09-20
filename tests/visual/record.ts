// The visual harness's run record (F1): every capture appends one line to captures.ndjson during the
// run (workers run in parallel, so no shared file is rewritten), and the teardown folds the lines into
// baseline-record.json beside the captures: browser and version, OS, the commit of the build, the
// date, the projects, the determinism settings, and every capture with its overflow.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { platform, release } from 'node:os';
import { join } from 'node:path';

export const dir = () => process.env.EVIDENCE_DIR ?? join('test-results', 'visual');
const lines = () => join(dir(), 'captures.ndjson');

export async function setup() {
  mkdirSync(dir(), { recursive: true });
  rmSync(lines(), { force: true });
}

export async function teardown() {
  const file = lines();
  const captures = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { route: string; project: string; file: string; overflow: number; browser: string })
    : [];
  const stamp = existsSync('dist/build.json') ? JSON.parse(readFileSync('dist/build.json', 'utf8')) : { commit: null, env: null, built: null };
  const record = {
    browser: captures[0]?.browser ?? 'unknown',
    os: `${platform()} ${release()}`,
    commit: stamp.commit,
    buildEnv: stamp.env,
    built: stamp.built,
    capturedAt: new Date().toISOString(),
    determinism: 'deviceScaleFactor 1; reduced motion; animations disabled; caret hidden; locale en-US; time zone America/Los_Angeles; scheme per project',
    projects: ['desktop 1440x900', 'tablet 768x1024', 'phone 390x844', 'reflow 320x568', 'desktop-dark 1440x900', 'phone-dark 390x844'],
    captures: captures.map(({ route, project, file: f, overflow }) => ({ route, project, file: f, overflow })).sort((a, b) => a.file.localeCompare(b.file)),
  };
  writeFileSync(join(dir(), 'baseline-record.json'), JSON.stringify(record, null, 2) + '\n');
  rmSync(file, { force: true });
}
