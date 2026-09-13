import { test, expect } from '@playwright/test';
import { splitTextNode, stripCode, parseWikilinks, scanTargets } from '../src/lib/wikilinks.mjs';

// The resolver itself (ADR-006 policy): what the build throws on, what preview flags, what code hides.
test.describe('the wikilink resolver', () => {
  const targets = new Map<string, any>([
    ['alpha', { slug: 'alpha', route: '/notes/alpha/', title: 'Alpha', status: 'published', collection: 'notes', file: 'content/notes/alpha.md' }],
    ['beta', { slug: 'beta', route: '/notes/beta/', title: 'Beta', status: 'draft', collection: 'notes', file: 'content/notes/beta.md' }],
  ]);

  test('a resolved link carries the given words or the target title', () => {
    const nodes = splitTextNode('see [[alpha|the alpha note]] and [[alpha]].', targets, false, 'x.md') as any[];
    expect(nodes.map((n) => n.type)).toEqual(['text', 'link', 'text', 'link', 'text']);
    expect(nodes[1].children[0].value).toBe('the alpha note');
    expect(nodes[3].children[0].value).toBe('Alpha');
    expect(nodes[1].url).toBe('/notes/alpha/');
  });

  test('production throws on an unresolved link, naming the file; a draft target counts as unresolved', () => {
    expect(() => splitTextNode('[[nope]]', targets, false, 'content/notes/x.md')).toThrow(/unresolved wikilink \[\[nope\]\] in content\/notes\/x\.md/);
    expect(() => splitTextNode('[[beta]]', targets, false, 'x.md')).toThrow(/unresolved wikilink \[\[beta\]\]/);
  });

  test('preview flags an unresolved link in place with the slug escaped, and may link to a draft', () => {
    const [flag] = splitTextNode('[[<img src=x onerror=alert(1)>]]', targets, true, 'x.md') as any[];
    expect(flag.type).toBe('html');
    expect(flag.value).not.toContain('<img');
    expect(flag.value).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(flag.value).toMatch(/^<span class="unresolved-link"/);
    const [draft] = splitTextNode('[[beta]]', targets, true, 'x.md') as any[];
    expect(draft.type).toBe('link');
  });

  test('a draft source in production keeps its unresolved links as text instead of failing the build', () => {
    const nodes = splitTextNode('[[nope]]', targets, false, 'content/notes/beta.md', true) as any[];
    expect(nodes).toEqual([{ type: 'text', value: '[[nope]]' }]);
  });

  test('code spans and fences never carry wikilinks', () => {
    const md = 'text [[alpha]]\n\n```md\n[[in-a-fence]]\n```\n\nand `[[inline]]` here';
    expect(parseWikilinks(stripCode(md)).map((l: any) => l.target)).toEqual(['alpha']);
  });

  test('duplicate slugs across collections are refused by the target scan', () => {
    expect(() => scanTargets('tests/fixtures/duplicate-slug')).toThrow(/duplicate slug "twice"/);
  });
});
