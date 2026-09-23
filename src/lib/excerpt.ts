// The first sentence or two of a Markdown body, as plain text, at most about 170 characters: the
// line the Home Writing module and the Writing index quote from the newest essay.
export function openingLine(body: string | undefined): string | undefined {
  if (!body) return undefined;
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[*_`>#\[\]]/g, '').replace(/\s+/g, ' ').trim())
    .find((p) => p.length > 60);
  if (!para) return undefined;
  const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > 170) break;
    out += s;
  }
  return (out || sentences[0].slice(0, 170)).trim();
}
