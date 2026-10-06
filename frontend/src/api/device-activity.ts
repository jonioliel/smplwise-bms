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
  | 'light' | 'switch' | 'outlet' | 'cover' | 'garage_door' | 'climate' | 'heater' | 'fan' | 'water_heater' | 'valve' | 'vacuum' | 'generic';
export const ACTIVITY_KINDS: ActivityKind[] = ['light', 'switch', 'outlet', 'cover', 'garage_door', 'climate', 'heater', 'fan', 'water_heater', 'valve', 'vacuum', 'generic'];

export type ActorType = 'person' | 'automation' | 'script' | 'schedule' | 'scene' | 'device' | 'system' | 'unknown';
export const ACTOR_TYPES: ActorType[] = ['person', 'automation', 'script', 'schedule', 'scene', 'device', 'system', 'unknown'];
export type EventType = 'power' | 'value' | 'availability';
export type ActivityVia = 'arx' | 'ha' | 'device' | 'unknown';
export type Confidence = 'exact' | 'inferred' | 'unknown';
export type ActivityAvailability = 'ok' | 'partial' | 'unavailable';

/** A snapshot of the device at one moment: `state` plus the watched attributes the server stores for its domain, flat (brightness_pct,
 * color_temp_kelvin, temperature, target_temp_low / high, fan_mode, preset_mode, swing_mode, humidity, percentage, oscillating, direction,
 * current_position, current_tilt_position, fan_speed, away_mode ...). Only the keys that exist are present. */
export type ActivityValue = { state?: string | null } & Record<string, unknown>;

export interface ActivityItem {
  id: string | number;
  /** UTC instant. */
  at: string;
  kind: EventType;
  actor: { type: ActorType; name?: string | null };
  source?: { type: 'automation' | 'script' | 'scene' | 'schedule'; id?: string | null; name?: string | null } | null;
  from: ActivityValue;
  to: ActivityValue;
  /** The keys that differ between `from` and `to` (`state` among them for a power event). */
  changed?: string[];
  via?: ActivityVia;
  confidence?: Confidence;
  /** A free note (demo / mocks only; the real route has none). */
  note?: string | null;
}

export interface ActivityEntity {
  entity_id: string;
  name?: string;
  domain?: string;
  activity_kind?: ActivityKind;
  virtual?: boolean;
  /** An outlet's linked power sensor (only with one on the same device). */
  power?: { entity_id: string; value: number | null; unit: string } | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  next_cursor: string | null;
  retention_days: number;
  /** Since when the log exists (null until the first activity): history starts from zero. */
  tracked_since: string | null;
  coverage: { from: string | null; gaps: { from: string; to: string; reason?: string }[] };
  availability: ActivityAvailability;
  entity?: ActivityEntity;
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
      tracked_since: page.tracked_since ?? page.coverage?.from ?? null,
      coverage: page.coverage ?? { from: null, gaps: [] },
      entity: page.entity,
      availability: page.availability ?? 'ok',
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) throw new ActivityError('forbidden');
    throw new ActivityError('unavailable', e instanceof Error ? e.message : '');
  }
}
