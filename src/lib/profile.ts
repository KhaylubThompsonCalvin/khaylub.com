// Profile data: small hand-edited YAML files that feed Home, About, Now, Work, Résumé, Contact,
// the footer, security.txt, and the timeline. Every file is validated with a strict schema at
// build time, so a stray private key (a grade, a balance, a phone number) fails the build.
import { z } from 'astro/zod';
import { readFileSync, readdirSync } from 'node:fs';
import { load } from 'js-yaml';
import { contentPath } from '../content/schemas';

function readYaml(rel: string): unknown {
  return load(readFileSync(contentPath(rel), 'utf8'));
}

function parse<T extends z.ZodTypeAny>(rel: string, schema: T): z.infer<T> {
  const result = schema.safeParse(readYaml(rel));
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`content/${rel} failed validation:\n${issues}`);
  }
  return result.data;
}

const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);

export const identitySchema = z
  .object({
    name: z.string().min(3),
    site_name: z.string().min(3),
    role_line: z.string().min(3),
    location: z.string().min(2),
    email: z.string().email(),
    github: z.string().url(),
    linkedin: z.string().url(),
    response_time: z.string(),
    photo: z.string(),
    photo_alt: z.string(),
    security_contact: z.string().startsWith('mailto:'),
    security_as_of: z.coerce.date(),
  })
  .strict();

export const availabilitySchema = z
  .object({
    statement: z.string().min(10).max(200),
    as_of: z.coerce.date(),
    roles_sought: z.array(z.string()).min(1),
  })
  .strict();

export const nowSchema = z
  .object({ as_of: z.coerce.date(), lines: z.array(z.string().min(3)).min(3).max(6) })
  .strict();

export const interestsSchema = z
  .object({
    groups: z.array(
      z
        .object({
          name: z.string(),
          items: z.array(
            z
              .object({ label: z.string(), tag: z.string().optional(), url: z.string().optional() })
              .strict()
          ),
        })
        .strict()
    ),
  })
  .strict();

export const onRepeatSchema = z
  .object({ title: z.string(), artist: z.string(), url: z.string() })
  .strict();

export const blogrollSchema = z
  .object({
    sites: z.array(z.object({ name: z.string(), url: z.string().url(), note: z.string() }).strict()),
  })
  .strict();

export const educationSchema = z
  .object({
    entries: z.array(
      z
        .object({
          institution: z.string(),
          program: z.string(),
          location: z.string(),
          start: z.union([yearMonth, z.string().regex(/^\d{4}$/)]),
          end: z.union([yearMonth, z.string().regex(/^\d{4}$/), z.literal('present')]),
          note: z.string().optional(),
          courses: z.array(z.object({ name: z.string(), completed: z.string() }).strict()),
          highlights: z.array(z.string()),
        })
        .strict()
    ),
  })
  .strict();

export const certificationsSchema = z
  .object({
    items: z.array(z.object({ name: z.string(), issuer: z.string(), years: z.string() }).strict()),
    planned: z.array(z.string()),
  })
  .strict();

export const top8Schema = z
  .object({
    as_of: yearMonth,
    items: z.array(z.object({ slug: z.string(), reason: z.string().min(5) }).strict()).length(8),
  })
  .strict();

export const EVENT_KINDS = ['launch', 'publication', 'course-completed', 'milestone', 'top8-revision'] as const;

export const timelineSchema = z
  .object({
    events: z.array(
      z
        .object({
          date: z.coerce.date(),
          kind: z.enum(EVENT_KINDS),
          title: z.string().min(5),
          url: z.string().optional(),
        })
        .strict()
    ),
  })
  .strict();

export const redirectsSchema = z
  .object({
    redirects: z.array(
      z.object({ from: z.string().startsWith('/'), to: z.string().startsWith('/'), note: z.string() }).strict()
    ),
  })
  .strict();

export const identity = () => parse('profile/identity.yaml', identitySchema);
export const availability = () => parse('profile/availability.yaml', availabilitySchema);
export const now = () => parse('profile/now.yaml', nowSchema);
export const interests = () => parse('profile/interests.yaml', interestsSchema);
export const onRepeat = () => parse('profile/on-repeat.yaml', onRepeatSchema);
export const blogroll = () => parse('profile/blogroll.yaml', blogrollSchema);
export const education = () => parse('profile/education.yaml', educationSchema);
export const certifications = () => parse('profile/certifications.yaml', certificationsSchema);
export const timelineEvents = () => parse('timeline/events.yaml', timelineSchema).events;
export const redirects = () => parse('redirects.yaml', redirectsSchema).redirects;

/** All Top 8 revision files, newest first. */
export function top8Revisions() {
  const dir = contentPath('profile', 'top8');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .reverse();
  return files.map((f) => parse(`profile/top8/${f}`, top8Schema));
}

export const currentTop8 = () => top8Revisions()[0];

export const monthLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const isPreview = () => import.meta.env.PUBLIC_SITE_ENV === 'preview';

/** The site is production unless PUBLIC_SITE_ENV=preview is set at build time. */
export const siteEnv = () => (isPreview() ? 'preview' : 'production');
