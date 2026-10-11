import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const file = load(readFileSync('content/profile/audiences.yaml', 'utf8')) as { audiences: { id: string; skin: string; tier: string; label: string; greeting: string; start_here: { label: string; href: string }[]; top8: { as_of: string; items: string[] } }[] };

test('six audiences, each mapped to its skin and tier exactly as the spec says', () => {
  const want: Record<string, [string, string]> = { hiring: ['paper', 'lean'], tech: ['desert-night', 'standard'], creative: ['arizona-made', 'full'], exploring: ['golden-hour', 'full'], youtube: ['above-the-clouds', 'full'], nostalgia: ['profile-2006', 'standard'] };
  expect(file.audiences.map((a) => a.id)).toEqual(Object.keys(want));
  for (const a of file.audiences) expect([a.skin, a.tier], a.id).toEqual(want[a.id]);
});

test('each Top 8 has 1 to 8 slugs and a YYYY-MM date; Start here has exactly three links', () => {
  for (const a of file.audiences) {
    expect(a.top8.items.length, a.id).toBeGreaterThan(0);
    expect(a.top8.items.length, a.id).toBeLessThanOrEqual(8);
    expect(a.top8.as_of, a.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(a.start_here.length, a.id).toBe(3);
  }
});

test('greetings are the owner\'s: empty until written, never a placeholder', () => {
  for (const a of file.audiences) expect(a.greeting, a.id).not.toMatch(/todo|tbd|lorem|placeholder|\[/i);
});
