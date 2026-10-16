/** 2.5.4 / TK255: the sample vendor link shown under the public address. Mirrors the server's validate_public_base_url shape only far
 * enough to preview (the server stays the judge): `https://<host>` plus, for an address saved since 2.5.4, one `/prefix` segment of
 * its own. Without one the listener's own prefix (`public.path_prefix`, `t` when not given) is used; anything else gives no sample. */
const SHAPE = /^https:\/\/([a-z0-9.-]+)(\/[a-z][a-z0-9-]{1,31})?\/?$/;
const PREFIX = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function sampleLink(address: string, prefix = 't'): string {
  const m = SHAPE.exec(address.trim().toLowerCase());
  if (!m) return '';
  const own = m[2] ?? (PREFIX.test(prefix) ? `/${prefix}` : '/t');
  return `https://${m[1]}${own}/#…`;
}
