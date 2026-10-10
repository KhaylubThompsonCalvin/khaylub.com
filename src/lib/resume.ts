// The résumé's Markdown (content/profile/resume.md, the owner's facts and words, never edited here)
// read into fields for the web résumé (the 2026-10-10 polish): the pipe-joined lines become a title,
// a meta line, dates, a stack, and a link; the facts and their wording are kept as written.

export type Item = { title: string; parts: string[]; lines: string[]; bullets: string[] };
export type Section = { name: string; lines: string[]; bullets: string[]; items: Item[] };

/** Split the Markdown body into its "## " sections and their "### " items. */
export function parseResume(body: string): Section[] {
  const sections: Section[] = [];
  let section: Section | undefined;
  let item: Item | undefined;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      section = { name: line.slice(3).trim(), lines: [], bullets: [], items: [] };
      sections.push(section);
      item = undefined;
    } else if (line.startsWith('### ') && section) {
      const [title, ...parts] = line.slice(4).split(' | ').map((s) => s.trim());
      item = { title, parts, lines: [], bullets: [] };
      section.items.push(item);
    } else if (line.startsWith('- ')) {
      (item ?? section)?.bullets.push(line.slice(2).trim());
    } else {
      (item ?? section)?.lines.push(line);
    }
  }
  return sections;
}

/** A pipe-joined line as its parts. */
export const pipes = (line: string): string[] => line.split(' | ').map((s) => s.trim());

/** A date range ("Dec 2017 to Aug 2025", "2016 to 2017", "Dec 2023 to present"). */
export const isDates = (s: string): boolean => /\b(\d{4}|present)\b/.test(s) && /\bto\b/.test(s);

/** A bare web address as a full URL ("github.com/x" to "https://github.com/x"). */
export const urlOf = (s: string): string | undefined => (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s) ? `https://${s.replace(/^www\./, 'www.')}` : undefined);

/** A short label for a link, by its host. */
export function linkLabel(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'github.com') return 'GitHub repository';
  if (host.endsWith('tableau.com')) return 'Tableau Public';
  return host;
}
