import type { APIRoute } from 'astro';
import { COLLECTIONS, type ArtifactCollection } from '@lib/catalog';
import { rssFeed } from '@lib/feeds';

export function getStaticPaths() {
  return COLLECTIONS.map((c) => ({ params: { collection: c.name } }));
}

export const GET: APIRoute = ({ params }) => rssFeed(params.collection as ArtifactCollection);
