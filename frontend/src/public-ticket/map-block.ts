/**
 * TKMAP1 (owner 16.10): the vendor page's "location on the map" card - pure, so tests/unit-tickets-map.spec.ts checks it in node.
 * The server sends only the SNAPSHOT text (`map_element`: name, floor, room) and whether a picture exists; the picture itself is a 2D
 * image the server draws (GET /t/api/map-image, fetched with the token header and shown through a blob: URL - the CSP allows nothing
 * else). No map, no plan data, nothing interactive reaches this page.
 */

export interface MapElementView {
  name: string;
  floor: string;
  room: string;
  image: boolean;
}

export interface MapBlock {
  /** "<name> · <floor> · <room>" (empty parts left out) */
  line: string;
  /** a picture should be fetched and shown */
  image: boolean;
}

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** The card's content, or null when nothing is attached (or the answer is malformed: the card is optional, never a crash). */
export function mapBlock(m: unknown): MapBlock | null {
  if (!m || typeof m !== 'object') return null;
  const v = m as Partial<MapElementView>;
  const line = [clean(v.name), clean(v.floor), clean(v.room)].filter(Boolean).join(' · ');
  if (!line) return null;
  return { line, image: v.image === true };
}
