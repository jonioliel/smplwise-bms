/**
 * CR-036 S8: the typed reads of the access-control entry log ("פעילות") - the native events screen's only data path to the
 * intercom integration. The browser never names an integration command: every call is one typed Arx endpoint under
 * `/api/v1/access-control/...` (routers/access_control_reads.py), authorized per station by services/intercom_authority.py.
 *   GET events                     one page, newest first; rows carry `portrait` (true / false / null = "not for you")
 *   GET events/{id}                one row with the evidence of how its identity and time were established
 *   GET events/{id}/portrait       the event picture (image/jpeg, audited server-side unless the administrator switched it off)
 *   GET events/export.csv          the filtered log as a file (access.events.export; audited with filters and row count)
 *   GET stations                   the stations the caller sees (names and clock zones for the rows and the filter)
 *   GET features                   which of these the installed integration offers (a screen hides what it does not)
 * Cursors (`next`) are opaque: they are passed back as `before` exactly as served - they may be the integration's own id or
 * an Arx token bound to the caller (`c.`...), and a refused one is a 422 `intercom_cursor_expired` (reload from page one).
 */
import { ApiError, api, apiUrl, get } from './client';
import type { DisplayZone, IntercomFeedState } from './intercom';

export type AccessFeedState = IntercomFeedState | 'unsupported';

export type AccessResult = 'granted' | 'denied' | 'unknown';
export type AccessAuth = 'card' | 'pin' | 'unknown';

/** One entry-log row exactly as `GET /access-control/events` builds it (intercom_authority.view_event). Never a card, a PIN,
 * a phone or a person id; the employee number only where the caller may see it (null otherwise). */
export interface AccessEvent {
  id: string;
  station_id: string | null;
  timestamp: string | null;
  received_at: string | null;
  time_source: 'device' | 'received' | null;
  person_name: string | null;
  employee_no: string | null;
  authentication: AccessAuth;
  result: AccessResult;
  event_type: string;
  recovered: boolean;
  door: 1 | 2 | null;
  /** true: the event has a picture the caller may open; false: it has none; null: the caller may not open pictures. */
  portrait: boolean | null;
}

export interface AccessEventsPage {
  records: AccessEvent[];
  /** An opaque cursor for the next (older) page, or null at the end. Pass it back unchanged as `before`. */
  next: string | null;
  retention_days: number | null;
  capacity: number | null;
  membership_basis: string | null;
  storage_failed: boolean;
  stations: Record<string, { stream: string | null; history: string | null }>;
  /** false: the scan on a restricted caller's behalf stopped early (`incomplete_reason`); `next` continues from where it stopped. */
  complete: boolean;
  incomplete_reason: string | null;
}

export interface AccessEventsReply {
  state: AccessFeedState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  /** Null unless `state` is `ready`. */
  events: AccessEventsPage | null;
}

/** The server's filters (all optional; `start` / `end` are aware ISO instants). */
export interface AccessEventFilters {
  station_id?: string;
  person?: string;
  result?: AccessResult;
  authentication?: AccessAuth;
  event_type?: string;
  door?: 1 | 2;
  start?: string;
  end?: string;
  current_group?: string;
}

/** WisKey's page size for the entry log (the server allows up to 200). */
export const ACCESS_EVENTS_PAGE = 100;

export function eventsQueryString(filters: AccessEventFilters, before?: string | null, limit = ACCESS_EVENTS_PAGE): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  qs.set('limit', String(limit));
  if (before) qs.set('before', before);
  return qs.toString();
}

export function getAccessEvents(filters: AccessEventFilters, before?: string | null, limit = ACCESS_EVENTS_PAGE): Promise<AccessEventsReply> {
  return get<AccessEventsReply>(`access-control/events?${eventsQueryString(filters, before, limit)}`);
}

// ---------------------------------------------------------------- one event

export type IdentityState = 'identified' | 'id_only' | 'identity_unavailable';

/** How the identity and the time of an event were established - flags and enums, never a person field. */
export interface AccessEventEvidence {
  identity_state: IdentityState | null;
  origin: string | null;
  arrival_delay_seconds: number | null;
  time_source: 'device' | 'received' | null;
  live_automation: boolean | null;
}

export interface AccessEventDetail extends Omit<AccessEvent, 'portrait'> {
  evidence: AccessEventEvidence | null;
  source_identity: {
    source_fields: Record<string, string | null>;
    normalized: boolean | null;
    time_interpretation: string | null;
    central_name_resolved: boolean | null;
  } | null;
}

export interface AccessEventDetailReply {
  state: AccessFeedState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  event: AccessEventDetail | null;
}

export const getAccessEventDetail = (id: string, signal?: AbortSignal) =>
  api<AccessEventDetailReply>(`access-control/events/${encodeURIComponent(id)}`, { signal });

// ---------------------------------------------------------------- pictures and the file (binary answers)

/** A non-JSON read: the same credentials and error model as `api()`, the body as a Blob. A failure is thrown as an ApiError
 * built from the server's own error body (so `code` is `intercom_photo_not_found`, `forbidden`, `intercom_unavailable`...). */
async function blobOf(path: string, signal?: AbortSignal): Promise<{ blob: Blob; headers: Headers }> {
  const res = await fetch(apiUrl(path), { credentials: 'same-origin', signal });
  if (!res.ok) {
    let body: Partial<ApiError['body']> = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      body = {};
    }
    throw new ApiError(res.status, {
      code: body.code ?? `http_${res.status}`,
      user_message: body.user_message ?? '',
      retryable: body.retryable ?? false,
      correlation_id: body.correlation_id ?? '',
      details: body.details ?? {},
    });
  }
  return { blob: await res.blob(), headers: res.headers };
}

/** The picture of one event, as the list row named it: `stationId` and `at` are the row's own `station_id` and `timestamp`
 * (the server finds the row again from them). Each call is one audited view - never fetch one the person did not open. */
export async function fetchEventPortrait(id: string, stationId: string, at: string, signal?: AbortSignal): Promise<Blob> {
  const qs = new URLSearchParams({ station_id: stationId, at });
  return (await blobOf(`access-control/events/${encodeURIComponent(id)}/portrait?${qs.toString()}`, signal)).blob;
}

export interface EventsExportResult {
  blob: Blob;
  /** The server's own count (`X-Export-Rows`); null when the header is missing. */
  rows: number | null;
  filename: string;
}

/** The filtered log as a CSV file. A caller who does not see every station must name one (`station_id`), else 422
 * `intercom_export_station_required`. The file has no picture and no card column. */
export async function exportAccessEventsCsv(filters: AccessEventFilters, signal?: AbortSignal): Promise<EventsExportResult> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const q = qs.toString();
  const { blob, headers } = await blobOf(`access-control/events/export.csv${q ? `?${q}` : ''}`, signal);
  const rows = Number(headers.get('X-Export-Rows'));
  const name = /filename="?([^";]+)"?/.exec(headers.get('Content-Disposition') ?? '')?.[1];
  return { blob, rows: Number.isFinite(rows) && headers.get('X-Export-Rows') !== null ? rows : null, filename: name || 'access-events.csv' };
}

// ---------------------------------------------------------------- stations and features

/** A station as the entry screens need it (names and clock zones); the typed `stations` reply carries more. */
export interface AccessStationInfo {
  id: string;
  name: string;
  online: boolean;
  zone: DisplayZone | null;
}

export interface AccessStationsReply {
  state: AccessFeedState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  fresh?: boolean;
  stations: AccessStationInfo[] | null;
  default_zone: DisplayZone | null;
}

export const getAccessStations = () => get<AccessStationsReply>('access-control/stations');

export interface AccessFeatureState {
  available: boolean | null;
  reason: string | null;
}

export interface AccessFeaturesReply {
  state: AccessFeedState;
  configured: boolean;
  last_error: string | null;
  client_api: number | null;
  /** The integration's own wire version and the oldest client it accepts (numbers today; a string is tolerated). */
  api: { version: number | string | null; min_client: number | null } | null;
  features: Record<string, AccessFeatureState>;
  sync?: { wiskey_version?: string | null; connected?: boolean | null } | null;
}

export const getAccessFeatures = () => get<AccessFeaturesReply>('access-control/features');

/** A feature the screen may offer: only an explicit "not available" hides it (null = no served copy yet - ask and see). */
export function featureOffered(features: AccessFeaturesReply | null, name: string): boolean {
  const f = features?.features?.[name];
  return f ? f.available !== false : true;
}
