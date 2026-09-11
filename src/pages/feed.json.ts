import type { APIRoute } from 'astro';
import { jsonFeed } from '@lib/feeds';

export const GET: APIRoute = () => jsonFeed();
