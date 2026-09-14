// One Open Graph image per visible artifact at /og/<collection>/<slug>.png (SEO-3), built once at
// build time: the cover or poster when the artifact has one, otherwise a title card.
import type { APIRoute, GetStaticPaths } from 'astro';
import { allVisible, collectionLabel, type AnyEntry } from '@lib/catalog';
import { identity } from '@lib/profile';
import { coverFile, ogCard, ogFromCover } from '@lib/og';

export const getStaticPaths: GetStaticPaths = async () =>
  (await allVisible()).map((entry) => ({ params: { collection: entry.collection, slug: entry.data.slug }, props: { entry } }));

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as AnyEntry;
  const cover = coverFile(entry);
  const png = cover ? await ogFromCover(cover) : await ogCard({ title: entry.data.title, kicker: collectionLabel(entry.collection), site: identity().site_name });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
