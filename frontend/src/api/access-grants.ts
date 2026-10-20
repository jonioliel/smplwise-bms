/**
 * SHAREDID-293: the typed calls of the external-access screen (routers/access_grants.py). The server decides every permission and
 * filters every list; nothing here grants anything. The entry code never appears in any answer (only its delivery state).
 */
import { get, post, put, del } from './client';

export type GrantState = 'requested' | 'approved' | 'provisioning' | 'active' | 'revoking' | 'ended' | 'revoked' | 'refused' | 'failed' | 'unknown';
export type CodeState = 'not_needed' | 'pending' | 'queued' | 'sent' | 'not_delivered' | 'unknown';
export type DoorsState = 'desired' | 'accepted' | 'verified_central' | null;

export interface GrantDoor {
  station_id: string;
  name: string;
  relays: number[];
}

export interface GrantScope {
  doors: Record<string, number[]>;
  valid_from: string;
  valid_until: string;
  timing: { periods?: { start: string; end: string }[] } | null;
  credential: string;
}

export interface GrantLink {
  id: string;
  origin: 'created_from_arx' | 'matched';
  state: 'linked' | 'unlinking' | 'wiskey_missing';
}

export interface GrantClosure {
  kind: 'confirmed_gone';
  closed_at: string;
  closed_by_name: string | null;
  reappeared_at: string | null;
  /** to a system administrator only (GET /access-grants/{id}) */
  reference?: string | null;
}

export interface Grant {
  id: string;
  revision: number;
  state: GrantState;
  grant_state: GrantState;
  end_reason: string | null;
  source: 'manual' | 'ticket' | 'rfq_order';
  source_ref: string | null;
  person: { contact_id: string; name: string | null; pending: boolean; number: string | null };
  doors: GrantDoor[];
  valid_from: string;
  valid_until: string;
  timing: { periods?: { start: string; end: string }[] } | null;
  credential: string;
  outside_window: boolean;
  pending_amendment: GrantScope | null;
  approved_by: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  code_state: CodeState | null;
  code_due_at: string | null;
  code_sends: number | null;
  notice: { via: 'page' | 'approver' | 'requester'; version: string; at: string }[];
  attention: string | null;
  linked: boolean;
  needs_push: boolean;
  pending_sync: boolean;
  scope_verified: boolean;
  scope_verified_at: string | null;
  doors_state: DoorsState;
  created_at: string | null;
  updated_at: string | null;
  ended_at: string | null;
  revoking_since: string | null;
  link: GrantLink | null;
  create_unresolved: boolean;
  closure: GrantClosure | null;
  company: string | null;
  category: 'contractor' | 'visitor';
  /** ACCESSREQ-293: the request form's optional purpose and internal notes; whether the caller asked for the scope awaiting a decision */
  purpose?: string | null;
  notes?: string | null;
  self_requested?: boolean;
}

export interface GrantRules {
  external_grants: 'on' | 'off';
  go_live_permitted: boolean;
  max_days: number;
  max_doors: number;
  phone_fresh_days: number;
  code_hour: number;
  local_approvers: 'on' | 'off';
}

export type Placement = 'access' | 'tickets' | 'both';
export type DigestChannel = 'app' | 'app_whatsapp';
export type NameSync = 'manual' | 'auto';

export interface ScreenSettings {
  digest_channel: DigestChannel;
  digest_day: number;
  digest_hour: number;
  name_sync: NameSync;
  placement: Placement;
}

export interface GrantsReply {
  grants: Grant[];
  enabled: boolean;
  rules: GrantRules;
  screen: ScreenSettings;
  system_admin: boolean;
  /** ACCESSREQ-293: the caller may open the manual request form */
  may_request?: boolean;
  /** SHAREDUI-295: the served WisKey copy - when it was read and whether WisKey answers now (absent from an older server: unknown) */
  wiskey?: WiskeyFreshness;
}

export interface WiskeyFreshness {
  as_of: string | null;
  reachable: boolean;
  has_copy: boolean;
}

export interface DigestGap {
  kind: 'name' | 'scope' | 'idle_person';
  link_id?: string;
  grant_id?: string;
  contact_id: string;
  name: string | null;
  since?: string | null;
}

export interface Digest {
  period: { from: string; until: string };
  schedule: { day: number; hour: number; channel: DigestChannel };
  counts: {
    requests: number;
    approved: number;
    refused: number;
    ended_or_revoked: number;
    confirmed_gone: number;
    closed_no_person: number;
    codes_sent: number;
    codes_replaced: number;
    codes_not_delivered: number;
  };
  slow_revokes: { grant_id: string; name: string | null; open: boolean; minutes: number }[];
  approvers: { user_id: string; name: string | null; count: number }[];
  gaps: DigestGap[];
}

export interface Identity {
  contact_id: string;
  link: (GrantLink & { linked_at: string; name_drift: boolean }) | null;
  live_grant: { id: string; state: GrantState } | null;
  unresolved: { count: number; grant_id: string | null; started_at: string; op_id: string | null } | null;
  name_sync: NameSync;
  can: { link: boolean; unlink: boolean; delete: boolean; attach: boolean; push_name: boolean };
  history: { action: string; at: string }[];
}

const enc = encodeURIComponent;

export const listGrants = (all = true) => get<GrantsReply>(`access-grants${all ? '?all=true' : ''}`);
export const getGrant = (id: string) => get<{ grant: Grant }>(`access-grants/${enc(id)}`);
export const getDigest = () => get<{ digest: Digest }>('access-grants/digest');
export const getIdentity = (contactId: string) => get<{ identity: Identity }>(`access-grants/contacts/${enc(contactId)}/identity`);
export const getScreenSettings = () => get<GrantRules & ScreenSettings>('access-grants/settings');
export const putScreenSettings = (body: Partial<ScreenSettings>) => put<GrantRules & ScreenSettings>('access-grants/settings', body);

export const approveGrant = (id: string, body: { revision: number; doors?: Record<string, number[]>; valid_from?: string; valid_until?: string; told: boolean }) =>
  post<{ grant: Grant }>(`access-grants/${enc(id)}/approve`, body);
export const refuseGrant = (id: string, revision: number) => post<{ grant: Grant }>(`access-grants/${enc(id)}/refuse`, { revision });
export const revokeGrant = (id: string) => post<{ grant: Grant }>(`access-grants/${enc(id)}/revoke`);
export const rotateCode = (id: string, revision: number) => post<{ grant: Grant }>(`access-grants/${enc(id)}/rotate`, { revision });
export const provisionNow = (id: string) => post<{ grant: Grant }>(`access-grants/${enc(id)}/provision-now`);
export const readNow = (id: string) => post<{ grant: Grant }>(`access-grants/${enc(id)}/read-now`);
export const confirmGone = (id: string, body: { reference: string; confirm: string; checks: boolean[] }) => post<{ grant: Grant }>(`access-grants/${enc(id)}/confirm-gone`, body);
export const attachRecovered = (id: string, body: { op_id: string; wiskey_person_id: string; evidence_ref: string }) =>
  post<{ link: GrantLink; grant: Grant | null }>(`access-grants/${enc(id)}/attach-recovered`, body);
export const revokeAll = (confirm: string) => post<{ revoked: number }>('access-grants/revoke-all', { confirm });
export const acceptContact = (contactId: string) => post<unknown>(`access-grants/pending-contacts/${enc(contactId)}/accept`);
export const matchLink = (contactId: string, wiskeyPersonId: string) => post<{ link: GrantLink }>('access-grants/links', { contact_id: contactId, wiskey_person_id: wiskeyPersonId });
export const unlinkPerson = (linkId: string) => api_del(`access-grants/links/${enc(linkId)}`);
export const deletePersonNow = (linkId: string, confirm: string) => post<{ outcome: string; pending: boolean }>(`access-grants/links/${enc(linkId)}/delete-person`, { confirm });
export const pushName = (linkId: string) => post<{ outcome: string; drift: boolean }>(`access-grants/links/${enc(linkId)}/push-name`);

// ---------------------------------------------------------------- ACCESSREQ-293: the manual request form

export interface GrantableRelay {
  relay: number;
  name: string | null;
}

export interface GrantableStation {
  station_id: string;
  name: string | null;
  online: boolean;
  relays: GrantableRelay[];
  /** owner decision (b): an approver's own stations; for a ticket manager the "entrance for external people" stations + the ticket's */
  may_request: boolean;
  may_approve: boolean;
  may_approve_pin: boolean;
  entrance: boolean;
  ticket: boolean;
}

export interface GrantableDoors {
  stations: GrantableStation[];
  max_doors: number;
  max_days: number;
  tickets_requester: boolean;
  system_admin: boolean;
  /** the served WisKey copy: when it was read, and whether WisKey answers now */
  as_of: string | null;
  reachable: boolean;
  has_copy: boolean;
}

export interface ApproversReply {
  approvers: { name: string; me: boolean }[];
  count: number;
  /** owner decision (a): the caller may approve his own request (a system administrator) */
  self_approval: boolean;
}

export interface NoticeReply {
  lang: 'he' | 'en' | 'ar' | 'ru';
  version: string;
  text: string;
  attest: string;
}

export interface Timing {
  mode: 'weekly' | 'dates';
  timezone: string;
  days: string[];
  dates: string[];
  periods: { start: string; end: string }[];
}

export interface RequestBody {
  contact_id: string;
  ticket_id?: string | null;
  doors: Record<string, number[]>;
  valid_from: string;
  valid_until: string;
  timing: Timing | null;
  credential: 'pin' | 'none';
  purpose?: string | null;
  notes?: string | null;
  told: boolean;
  approve_now: boolean;
}

export interface RequestReply {
  grant: Grant;
  outcome: 'created' | 'replaced' | 'merged' | 'widening';
  /** "I approve now": null when not asked (or nothing to approve); a refusal after the request was stored says why */
  approval: { approved: true } | { approved: false; code: string; message: string } | null;
}

export const grantableDoors = (ticketId?: string | null) => get<GrantableDoors>(`access-grants/grantable-doors${ticketId ? `?ticket_id=${enc(ticketId)}` : ''}`);
export const listApprovers = (stations: string[], credential: 'pin' | 'none') =>
  get<ApproversReply>(`access-grants/approvers?stations=${enc(stations.join(','))}&credential=${credential}`);
export const getNotice = (lang: string) => get<NoticeReply>(`access-grants/notice?lang=${enc(lang)}`);
export const requestGrant = (body: RequestBody) => post<RequestReply>('access-grants', body);

function api_del(path: string): Promise<void> {
  return del(path);
}
