/**
 * PARTNERAPI113-295: the partner interface administration (Settings › Connections, `partner.manage` = system administrator only).
 * No answer carries a token or a webhook secret except the creating / rotating call, which shows it ONCE (`token` / `secret`); the
 * card shows it in a one-time box and never keeps it (no browser storage). Target URLs are never returned - only their host.
 */
import { del, get, patch, post, put } from './client';

export interface PartnerSettings {
  api: boolean;
  webhooks: boolean;
  api_active: boolean;
  webhooks_active: boolean;
  go_live_permitted: boolean;
  values: Record<string, number>;
  ranges: Record<string, [number, number]>;
  scopes: string[];
  restriction_kinds: string[];
  event_types: string[];
  allowed_ports: number[];
  remote: boolean;
  counts?: { clients: number; tokens: number; endpoints: number };
}

export interface PartnerClient {
  id: string;
  label: string;
  state: 'active' | 'disabled';
  created_at: string;
  tokens: number;
  endpoints: number;
}

export interface Personal {
  ticket_text: boolean;
  ticket_people: boolean;
}

export interface PartnerToken {
  id: string;
  client_id: string;
  label: string;
  last4: string;
  scopes: string[];
  restriction_kind: string;
  restriction_ids: string[];
  departments: string[];
  source_cidrs: string[];
  personal: Personal;
  rate_per_min: number;
  rate_per_hour: number;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  last_used_addr: string | null;
  request_count: number;
  revoked_at: string | null;
  state: 'active' | 'expired' | 'revoked';
  owner_gone: boolean;
  /** present ONLY in the answer of create / rotate */
  token?: string;
}

export interface PartnerEndpoint {
  id: string;
  client_id: string;
  label: string;
  host: string;
  events: string[];
  restriction_kind: string;
  restriction_ids: string[];
  skip_own: boolean;
  state: 'pending' | 'active' | 'paused' | 'disabled';
  state_reason: string | null;
  fail_streak: number;
  last_success_at: string | null;
  queued: number;
  dead: number;
  /** present ONLY in the answer of create / secret rotation */
  secret?: string;
}

export interface Delivery {
  event_id: string;
  endpoint_id: string;
  type: string;
  attempt: number;
  started_at: string;
  duration_ms: number;
  http_status: number | null;
  error_class: string | null;
}

export interface OutboxRow {
  id: string;
  endpoint_id: string;
  type: string;
  occurred_at: string;
  state: string;
  attempts: number;
  dead_reason: string | null;
}

export interface PartnerOptions {
  sites: { id: string; name: string }[];
  buildings: { id: string; name: string; site_id: string }[];
  floors: { id: string; name: string; building_id: string }[];
  departments: { id: string; name: string }[];
  templates: { id: string; name: string; department_id: string | null }[];
}

export interface TokenBody {
  label?: string;
  scopes: string[];
  restriction_kind: string;
  restriction_ids?: string[];
  departments?: string[];
  source_cidrs?: string[];
  personal?: Partial<Personal>;
  expires_days?: number;
}

export interface EndpointBody {
  label?: string;
  url: string;
  events: string[];
  restriction_kind: string;
  restriction_ids?: string[];
  skip_own: boolean;
}

const B = 'partners';
export const getPartnerSettings = () => get<PartnerSettings>(`${B}/settings`);
export const putPartnerSettings = (body: { api?: boolean; webhooks?: boolean; values?: Record<string, number> }) => put<PartnerSettings>(`${B}/settings`, body);
export const getPartnerOptions = () => get<PartnerOptions>(`${B}/options`);
export const listClients = () => get<{ items: PartnerClient[] }>(`${B}/clients`);
export const createClient = (label: string) => post<PartnerClient>(`${B}/clients`, { label });
export const setClientState = (id: string, state: 'active' | 'disabled') => post<PartnerClient>(`${B}/clients/${encodeURIComponent(id)}/state`, { state });
export const deleteClient = (id: string) => del(`${B}/clients/${encodeURIComponent(id)}`);
export const listTokens = () => get<{ items: PartnerToken[] }>(`${B}/tokens`);
export const createToken = (clientId: string, body: TokenBody) => post<PartnerToken>(`${B}/clients/${encodeURIComponent(clientId)}/tokens`, body);
export const rotateToken = (id: string) => post<PartnerToken>(`${B}/tokens/${encodeURIComponent(id)}/rotate`, {});
export const revokeToken = (id: string) => post<PartnerToken>(`${B}/tokens/${encodeURIComponent(id)}/revoke`);
export const listEndpoints = () => get<{ items: PartnerEndpoint[] }>(`${B}/endpoints`);
export const createEndpoint = (clientId: string, body: EndpointBody) => post<PartnerEndpoint>(`${B}/clients/${encodeURIComponent(clientId)}/endpoints`, body);
export const updateEndpoint = (id: string, body: Partial<EndpointBody>) => patch<PartnerEndpoint>(`${B}/endpoints/${encodeURIComponent(id)}`, body);
export const deleteEndpoint = (id: string) => del(`${B}/endpoints/${encodeURIComponent(id)}`);
export const pauseEndpoint = (id: string, paused: boolean) => post<PartnerEndpoint>(`${B}/endpoints/${encodeURIComponent(id)}/pause`, { paused });
export const rotateEndpointSecret = (id: string) => post<PartnerEndpoint>(`${B}/endpoints/${encodeURIComponent(id)}/secret/rotate`, {});
export const pingEndpoint = (id: string) => post<{ event_id: string; state: string; http_status?: number | null; error?: string | null }>(`${B}/endpoints/${encodeURIComponent(id)}/ping`);
export const listDeliveries = () => get<{ items: Delivery[] }>(`${B}/deliveries?limit=50`);
export const listDead = () => get<{ items: OutboxRow[] }>(`${B}/outbox?state=dead&limit=50`);
export const redeliver = (eventId: string) => post<{ id: string; state: string }>(`${B}/outbox/${encodeURIComponent(eventId)}/redeliver`);
