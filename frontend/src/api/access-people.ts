/**
 * CR-036 S7: the typed reads of the native people screen - `GET /api/v1/access-control/...` (routers/access_control_reads.py).
 * The browser never talks to WisKey and never names a WisKey command: it asks one typed Arx endpoint per projection, and the
 * server answers with what THIS caller may see (services/intercom_authority.py) - a field the caller may not see is null, a
 * row they may not see is not there. Nothing here decides who sees what; the screen only shapes itself from the answer.
 *
 * Reply shape of the JSON reads: `{state, configured, last_error, fetched_at, <key>, sync}`. `<key>` is null unless `state` is
 * `ready`; `state` `unsupported` = this build of the access-control service does not offer the read (nothing was sent).
 */
import { ApiError, apiUrl, get } from './client';
import type { IntercomFeedState } from './intercom';
import { peopleQueryString, type PeopleRequest } from '../access-control/people-logic';

export type AcState = IntercomFeedState | 'unsupported';

export interface AcReplyHead {
  state: AcState;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
}
export type AcReply<K extends string, T> = AcReplyHead & { [P in K]: T | null };

/** One of a person's visible station assignments. `last_error` is the administrator's: null for everyone else. */
export interface AcPersonStation {
  station_id: string;
  enabled: boolean;
  doors: number[];
  sync_state: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface AcPersonTiming {
  mode: 'weekly' | 'dates' | 'unknown' | null;
  timezone: string | null;
  days: string[];
  dates: string[];
  periods: { start: string; end: string }[];
  enforcement: 'ha' | 'native' | 'unknown' | null;
}

/** The credential KINDS of a person (sensitive level): a PIN is set, how many enabled cards. Never a number or a value. */
export interface AcCredentials {
  pin: boolean | null;
  cards: number | null;
}

export type AcLevel = 'names' | 'sensitive';

/** A person as this caller may see them. A LIST row has `phone`, `profile`, `photo_configured`, `responsible_person`,
 * `access_purpose` and `timing` null always (they belong to one person's page); a field null on a sensitive-level page is unknown. */
export interface AcPerson {
  id: string;
  display_name: string;
  active: boolean;
  archived: boolean;
  valid_from: string | null;
  valid_until: string | null;
  revision: number | null;
  access_category: 'staff' | 'visitor' | 'contractor' | 'unknown' | null;
  user_type: string | null;
  identity_locked: boolean;
  employee_no: string | null;
  group_ids: string[] | null;
  stations: AcPersonStation[] | null;
  timing: AcPersonTiming | null;
  level: AcLevel;
  editable: boolean;
  phone: string | null;
  phone_set: boolean | null;
  credentials: AcCredentials | null;
  photo_configured: boolean | null;
  profile: Record<string, string> | null;
  responsible_person: string | null;
  access_purpose: string | null;
}

export type AcPeopleSort = 'name' | 'name_desc' | 'employee';

export interface AcPeoplePage {
  records: AcPerson[];
  total: number | null;
  /** WisKey's directory size - only for a caller who sees everyone, else null (never show "N of M" then). */
  total_all: number | null;
  offset: number | null;
  limit: number | null;
  next_offset: number | null;
  previous_offset: number | null;
  snapshot: string;
  /** The directory changed since the snapshot the request carried: the paging may repeat or skip people. */
  stale: boolean;
  /** False = the scan stopped early (`incomplete_reason`): `total` is a lower bound. */
  complete: boolean;
  incomplete_reason: 'scan_limit' | 'rate_limited' | 'busy' | string | null;
  sort: AcPeopleSort;
  /** The caller sees every employee number: the column, the search by number and the number order follow it. */
  employee_no_visible: boolean;
}

export type AcPeopleReply = AcReply<'people', AcPeoplePage>;
export type AcPersonReply = AcReply<'person', AcPerson>;

export interface AcStationLite {
  id: string;
  name: string;
  online?: boolean;
}
export type AcStationsReply = AcReply<'stations', AcStationLite[]> & { fresh?: boolean };

export interface AcGroup {
  id: string;
  label: string;
  enabled: boolean;
  station_ids: string[] | null;
}
export interface AcProfileField {
  id: string;
  label: string;
  enabled: boolean;
  type: 'text' | 'select' | 'number' | 'date' | 'unknown' | null;
  required: boolean;
  unique: boolean;
  options: string[];
}
export interface AcGroups {
  revision: number | null;
  photo_enabled: boolean;
  groups: AcGroup[];
  /** The field definitions: only for a holder of the sensitive level (they label profile values), else null. */
  fields: AcProfileField[] | null;
}
export type AcGroupsReply = AcReply<'groups', AcGroups>;

export interface AcFeature {
  available: boolean | null;
  reason: string | null;
}
export interface AcFeaturesReply extends AcReplyHead {
  features: Record<string, AcFeature>;
}

export const getAcFeatures = () => get<AcFeaturesReply>('access-control/features');
export const getAcStations = () => get<AcStationsReply>('access-control/stations');
export const getAcGroups = () => get<AcGroupsReply>('access-control/groups');
export const getAcPeople = (req: PeopleRequest) => get<AcPeopleReply>(`access-control/people?${peopleQueryString(req)}`);
export const getAcPerson = (id: string) => get<AcPersonReply>(`access-control/people/${encodeURIComponent(id)}`);

/** The person's photo from the audited endpoint (one audit row per call): a blob URL the caller owns and must revoke, or the
 * reason it could not be shown. The browser never caches the picture (`Cache-Control: private, no-store`). */
export async function fetchPersonPhoto(id: string): Promise<{ url: string } | { error: 'forbidden' | 'missing' | 'unavailable' }> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`access-control/people/${encodeURIComponent(id)}/photo`), { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    return { error: 'unavailable' };
  }
  if (res.ok) return { url: URL.createObjectURL(await res.blob()) };
  return { error: res.status === 403 ? 'forbidden' : res.status === 404 ? 'missing' : 'unavailable' };
}

/** A 403 / 404 of a person's page: the screen shows the "no permission" panel / "not found" and nothing else. */
export const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403;
export const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;
