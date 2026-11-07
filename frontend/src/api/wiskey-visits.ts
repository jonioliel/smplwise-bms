/**
 * WISKEY-VISITS-2407 (card WISKEY-VISITS-2400): the visitor screen's access-control side - typed calls of `/api/v1/access/wiskey-visits/...`
 * (backend routers/access_wiskey_visits.py, services/wiskey_visits.py). The browser never names an access-control command; the server
 * decides every permission and answers every unavailable capability with its reason in Hebrew (`message`).
 */
import { get, post, put } from './client';

export type VisitCapabilityName = 'visits' | 'templates' | 'push';

export interface VisitCapability {
  available: boolean;
  reason: string | null;
  message: string | null;
  switch?: 'on' | 'off';
  offered?: boolean;
}

export interface VisitsHome {
  capabilities: Record<VisitCapabilityName, VisitCapability>;
  can: { list: boolean; settings: boolean };
}

export type VisitStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'superseded' | 'unknown';

export interface WiskeyVisit {
  id: string;
  status: VisitStatus;
  reason_code: string | null;
  requested_at: string | null;
  decided_at: string | null;
  display_name: string | null;
  access_category: 'visitor' | 'contractor' | 'unknown';
  valid_from: string | null;
  valid_until: string | null;
  doors: Record<string, number[]>;
  weekly_hours: boolean;
  stale: boolean;
  user_deleted: boolean;
  source: 'arx' | 'wiskey';
  external_ref: string | null;
  revision: number | null;
  origin: 'arx' | 'wiskey';
  arx_invite_id: string | null;
  read_only: true;
}

export interface VisitPage {
  state: string;
  last_error: string | null;
  fetched_at: string | null;
  visits: { items: WiskeyVisit[]; total: number; offset: number; next_offset: number | null; revision: number | null } | null;
}

export interface GuestTemplate {
  id: string;
  label: string;
  access_category: 'visitor' | 'contractor' | 'unknown';
  duration_minutes: number | null;
  doors: Record<string, number[]>;
  weekly_hours: boolean;
  updated_at: string | null;
}

export interface TemplatesReply {
  state: string;
  last_error: string | null;
  templates: { items: GuestTemplate[]; revision: number | null } | null;
}

export type LinkState = 'never' | 'sending' | 'pushed' | 'refused' | 'not_sent' | 'unknown';

export interface VisitLink {
  invite_id: string;
  state: LinkState;
  pushed_revision: number | null;
  current_revision: number;
  in_sync: boolean;
  pushable: boolean;
  wiskey_visit_id: string | null;
  last_code: string | null;
  attempted_at: string | null;
}

const BASE = '/access/wiskey-visits';

export const getVisitsHome = () => get<VisitsHome>(BASE);
export const getVisits = (params: { status?: string; query?: string; offset?: number; limit?: number } = {}) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return get<VisitPage>(`${BASE}/visits${s ? `?${s}` : ''}`);
};
export const getTemplates = () => get<TemplatesReply>(`${BASE}/templates`);
export const getLinks = () => get<{ links: VisitLink[] }>(`${BASE}/links`);
export const pushInvite = (inviteId: string) => post<{ status: string; link: VisitLink | null }>(`${BASE}/${encodeURIComponent(inviteId)}/push`, { confirmed: true });
export const reconcileInvite = (inviteId: string) =>
  post<{ verdict: 'recorded' | 'absent' | 'undecided'; link: VisitLink | null }>(`${BASE}/${encodeURIComponent(inviteId)}/reconcile`);
export const putVisitsSettings = (push: 'on' | 'off') => put<{ capabilities: VisitsHome['capabilities'] }>(`${BASE}/settings`, { push });
