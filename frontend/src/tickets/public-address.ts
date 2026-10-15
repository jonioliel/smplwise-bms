/** 2.5.4: the sample vendor link shown under the public address. Mirrors the server's validate_public_base_url shape only far enough
 * to preview (the server stays the judge): `https://<host>` plus at most one `/prefix` segment; anything else gives no sample. */
const SHAPE = /^https:\/\/([a-z0-9.-]+)(\/[a-z][a-z0-9-]{1,31})?\/?$/;

export function sampleLink(address: string): string {
  const m = SHAPE.exec(address.trim().toLowerCase());
  if (!m) return '';
  return `https://${m[1]}${m[2] ?? '/t'}/#…`;
}
