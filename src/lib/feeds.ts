// Feed builders shared by the site and per-collection endpoints. RSS through @astrojs/rss; JSON
// Feed 1.1 by hand (its shape is small). Links are canonical production URLs with no parameters.
import rss from '@astrojs/rss';
import { feedItems, routeFor, collectionLabel, type AnyEntry, type ArtifactCollection } from './catalog';
import { identity } from './profile';

const site = 'https://khaylub.com';

export async function rssFeed(name?: ArtifactCollection) {
  const id = identity();
  const items = await feedItems(name);
  const label = name ? `${id.site_name}: ${collectionLabel(name)}` : `${id.site_name} feed`;
  return rss({
    title: label,
    description: name ? `New items in ${collectionLabel(name)} on ${id.site_name}.` : `New projects, data work, and Field Notes on ${id.site_name}.`,
    site,
    items: items.map((e) => ({
      title: e.data.title,
      description: e.data.summary,
      link: routeFor(e),
      pubDate: e.data.date,
      categories: [collectionLabel(e.collection), ...e.data.tags],
    })),
    customData: '<language>en-us</language>',
  });
}

export async function jsonFeed(name?: ArtifactCollection) {
  const id = identity();
  const items = await feedItems(name);
  const body = {
    version: 'https://jsonfeed.org/version/1.1',
    title: name ? `${id.site_name}: ${collectionLabel(name)}` : `${id.site_name} feed`,
    home_page_url: `${site}/`,
    feed_url: `${site}${name ? `/${name}` : ''}/feed.json`,
    description: name ? `New items in ${collectionLabel(name)} on ${id.site_name}.` : `New projects, data work, and Field Notes on ${id.site_name}.`,
    language: 'en-US',
    authors: [{ name: id.name, url: `${site}/` }],
    items: items.map((e: AnyEntry) => ({
      id: `${site}${routeFor(e)}`,
      url: `${site}${routeFor(e)}`,
      title: e.data.title,
      summary: e.data.summary,
      date_published: e.data.date.toISOString(),
      ...(e.data.updated ? { date_modified: e.data.updated.toISOString() } : {}),
      tags: [collectionLabel(e.collection), ...e.data.tags],
    })),
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8' } });
}
