// Media helpers for the artifact template and cards (ADR-007, P2-FE-22): every raster beside an
// artifact under content/ goes through the image pipeline (astro:assets on sharp), which emits
// AVIF and WebP with srcset and explicit dimensions. Video and audio files are served from
// public/media/<slug>/ as they are (poster and preload rules live in the components). A path that
// starts with "/" is a public path and passes through untouched.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { AnyEntry } from './catalog';

const rasters = import.meta.glob<ImageMetadata>('/content/**/*.{png,jpg,jpeg,webp,avif}', { eager: true, import: 'default' });

/** The artifact's folder as an absolute-from-root path ('/content/gallery/<slug>'). */
function artifactDir(entry: AnyEntry): string {
  const filePath = ((entry as unknown as { filePath?: string }).filePath ?? '').replace(/\\/g, '/');
  const dir = filePath.slice(0, filePath.lastIndexOf('/'));
  return `/${dir.replace(/^\/+/, '')}`;
}

/** Resolve a frontmatter media path relative to the artifact folder into pipeline metadata. */
export function resolveRaster(entry: AnyEntry, rel: string | undefined): ImageMetadata | undefined {
  if (!rel || rel.startsWith('/') || /^https?:/.test(rel)) return undefined;
  const key = `${artifactDir(entry)}/${rel.replace(/^\.\//, '')}`;
  const meta = rasters[key];
  if (!meta) throw new Error(`media file not found for ${entry.collection}/${entry.data.slug}: ${rel} (looked for ${key})`);
  return meta;
}

/** A public URL for a media file named in frontmatter: public paths as they are, otherwise under /media/<slug>/. */
export function mediaUrl(entry: AnyEntry, rel: string): string {
  if (rel.startsWith('/') || /^https?:/.test(rel)) return rel;
  return `/media/${entry.data.slug}/${rel.replace(/^\.\//, '')}`;
}

export function mimeFor(file: string): string {
  const ext = file.toLowerCase().split('.').pop();
  return { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', vtt: 'text/vtt' }[ext ?? ''] ?? 'application/octet-stream';
}

export type Thumb = { src: string; alt: string; width: number; height: number };

/** The card thumbnail: 400 px WebP from the cover through the pipeline (target 30 KB or less). */
export async function coverThumb(entry: AnyEntry): Promise<Thumb | undefined> {
  const data = entry.data as { cover?: string; cover_alt?: string };
  if (!data.cover || !data.cover_alt) return undefined;
  const meta = resolveRaster(entry, data.cover);
  if (!meta) return { src: data.cover, alt: data.cover_alt, width: 400, height: 250 };
  const img = await getImage({ src: meta, width: 400, format: 'webp', quality: 70 });
  return { src: img.src, alt: data.cover_alt, width: Number(img.attributes.width), height: Number(img.attributes.height) };
}

/** A single processed WebP at a given width (posters, the full-size gallery image). */
export async function webpAt(meta: ImageMetadata, width: number): Promise<{ src: string; width: number; height: number }> {
  const img = await getImage({ src: meta, width: Math.min(width, meta.width), format: 'webp' });
  return { src: img.src, width: Number(img.attributes.width), height: Number(img.attributes.height) };
}

/** "m:ss" to an ISO 8601 duration for JSON-LD. */
export function isoDuration(mmss: string): string {
  const [m, s] = mmss.split(':').map(Number);
  return `PT${m}M${s}S`;
}

/** The media facts JSON-LD needs beyond the frontmatter: thumbnail and content URLs. */
export async function mediaForJsonLd(entry: AnyEntry): Promise<{ thumbnailUrl?: string; contentUrl?: string }> {
  const site = 'https://khaylub.com';
  const data = entry.data as { poster?: string; files?: string[]; images?: { src: string }[]; external_url?: string };
  const out: { thumbnailUrl?: string; contentUrl?: string } = {};
  if (entry.collection === 'video' || entry.collection === 'experiments') {
    const meta = resolveRaster(entry, data.poster);
    if (meta) out.thumbnailUrl = site + (await webpAt(meta, 1280)).src;
    else if (data.poster) out.thumbnailUrl = site + data.poster;
  }
  if (entry.collection === 'video' && data.files?.[0]) out.contentUrl = site + mediaUrl(entry, data.files[0]);
  if (entry.collection === 'video' && !data.files?.length && data.external_url) out.contentUrl = data.external_url;
  if (entry.collection === 'music' && data.files?.[0]) out.contentUrl = site + mediaUrl(entry, data.files[0]);
  if (entry.collection === 'gallery' && data.images?.[0]) {
    const meta = resolveRaster(entry, data.images[0].src);
    if (meta) {
      const full = await webpAt(meta, 1600);
      out.contentUrl = site + full.src;
      out.thumbnailUrl = site + (await webpAt(meta, 400)).src;
    }
  }
  return out;
}
