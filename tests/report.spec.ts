import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import matter from 'gray-matter';

function artifactStatuses(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.md' && !p.split(sep).includes('profile')) out.push((matter(readFileSync(p, 'utf8')).data as { status: string }).status);
    }
  };
  walk('content');
  return out;
}

test('the build report counts artifacts, pages, evidence, and integrity from the real content and build', ({}, testInfo) => {
  // The report writes one file at the repository root, so it runs in one project only.
  test.skip(testInfo.project.name !== 'desktop', 'run once, in the desktop project');
  const stdout = execSync('node scripts/build-report.mjs', { encoding: 'utf8' });
  expect(stdout).toMatch(/build report: \d+ pages/);
  const report = JSON.parse(readFileSync('build-report.json', 'utf8'));
  const statuses = artifactStatuses();
  expect(report.artifacts.total).toBe(statuses.length);
  expect(report.artifacts.published).toBe(statuses.filter((s) => s === 'published').length);
  expect(report.pages.total).toBeGreaterThan(40);
  expect(report.evidence.skills['data-analysis']).toBeGreaterThanOrEqual(3);
  expect(report.evidence.technologies['python']).toBeGreaterThanOrEqual(3);
  expect(report.unresolvedRelated).toEqual([]);
  expect(report.coversWithoutAlt).toEqual([]);
  expect(report.oversizeMedia).toEqual([]);
  expect(Array.isArray(report.orphans)).toBe(true);
  expect(report.searchIndexBytes).toBeGreaterThan(0);
});
