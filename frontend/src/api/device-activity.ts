/**
 * CR-032 device activity ("פעילות"): the typed client of GET /devices/{entity_id}/activity (CR section 3.4) and the registry of the twelve
 * activity kinds. The server decides which entities are electrical (`activity` / `activity_kind` on a card row); this module never
 * guesses from a name, an icon or a domain.
 *
 * Until the backend branch (pilot/DEVHIST-backend) is merged the routes may be missing: a 404 on the activity route is reported as
 * `availability: 'unavailable'`, and with no API session at all (static preview, design review) the demo store below answers, so the
 * screens and specs run unchanged. Only fields named in the CR are read; every other field is optional on purpose.
 */
import { get } from './client';
import { ApiError } from './client';
import { isApi } from './session';
import { demoActivity } from './device-activity-mock';

export type ActivityKind =
  | 'light' | 'switch' | 'outlet' | 'cover' | 'garage' | 'climate' | 'heater' | 'fan' | 'water_heater' | 'valve' | 'vacuum' | 'other';
export const ACTIVITY_KINDS: ActivityKind[] = ['light', 'switch', 'outlet', 'cover', 'garage', 'climate', 'heater', 'fan', 'water_heater', 'valve', 'vacuum', 'other'];

export type ActorType = 'person' | 'automation' | 'schedule' | 'scene' | 'device' | 'system' | 'unknown';
export const ACTOR_TYPES: ActorType[] = ['person', 'automation', 'schedule', 'scene', 'device', 'system', 'unknown'];
export type EventType = 'power' | 'value' | 'availability';
export type ActivityVia = 'arx' | 'ha' | 'device' | 'unknown';
export type Confidence = 'exact' | 'inferred' | 'unknown';
export type ActivityAvailability = 'ok' | 'partial' | 'unavailable';

export interface ActivityValue {
  /** The state string (`on`, `off`, `open`, `heat`, `unavailable`, ...) */
  state?: string | null;
  /** The recorded value of a value event: brightness %, position %, a temperature, a speed ... */
  value?: number | string | null;
}

export interface ActivityItem {
  id: string;
  /** UTC instant. */
  at: string;
  kind: EventType;
  /** What changed, for a value event (`brightness`, `position`, `tilt`, `target_temperature`, `hvac_mode`, `fan_mode`, `percentage`, `direction`, `color_temp`). */
  attribute?: string | null;
  actor: { type: ActorType; name?: string | null; user_ref?: string | null };
  source?: { type: 'automation' | 'script' | 'scene' | 'schedule'; id?: string | null; name?: string | null } | null;
  from: ActivityValue;
  to: ActivityValue;
  unit?: string | null;
  via?: ActivityVia;
  confidence?: Confidence;
  /** A free note the server may attach (power before switching off, the schedule's duration ...). */
  note?: string | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  next_cursor: string | null;
  retention_days: number;
  coverage: { from: string | null; gaps: { from: string; to: string }[] };
  availability: ActivityAvailability;
}

export interface ActivityQuery {
  since?: string;
  until?: string;
  actor?: ActorType;
  kind?: EventType;
  limit?: number;
  cursor?: string | null;
}

/** The popup's reason for showing something other than the feed. */
export class ActivityError extends Error {
  constructor(public reason: 'forbidden' | 'unavailable', message = '') {
    super(message || reason);
  }
}

function qs(q: ActivityQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** One page of the device's activity. Throws ActivityError('forbidden') on 403 and ActivityError('unavailable') on 404 / 5xx / network failure. */
export async function getDeviceActivity(entityId: string, q: ActivityQuery = {}): Promise<ActivityPage> {
  if (!isApi()) return demoActivity(entityId, q);
  try {
    const page = await get<Partial<ActivityPage>>(`devices/${encodeURIComponent(entityId)}/activity${qs({ limit: 50, ...q })}`);
    return {
      items: page.items ?? [],
      next_cursor: page.next_cursor ?? null,
      retention_days: page.retention_days ?? 90,
      coverage: page.coverage ?? { from: null, gaps: [] },
      availability: page.availability ?? 'ok',
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) throw new ActivityError('forbidden');
    throw new ActivityError('unavailable', e instanceof Error ? e.message : '');
  }
}
