// RFC 9116 security.txt, generated from content/profile/identity.yaml (decision D-20).
// Expires is security_as_of plus one year; scripts/check-security-txt.mjs fails CI within 30 days of it.
import type { APIRoute } from 'astro';
import { identity } from '../../lib/profile';

export const GET: APIRoute = () => {
  const id = identity();
  const expires = new Date(id.security_as_of);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const body = [
    `Contact: ${id.security_contact}`,
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: en',
    'Canonical: https://khaylub.com/.well-known/security.txt',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
