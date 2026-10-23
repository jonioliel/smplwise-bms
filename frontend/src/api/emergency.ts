/**
 * CR-EMERG104: the ONLY module of the frontend that talks to `/api/v1/emergency-readiness...` (backend routers/emergency_readiness.py).
 * The server is the authority for every permission, redaction and status; the screen only draws what it is given. Read only: nothing
 * here operates a door, a generator, an elevator or a relay.
 */
import { del, get, patch, post, put } from './client';

export type ItemStatus = 'green' | 'amber' | 'red' | 'unknown' | 'not_applicable' | 'hidden';
export type Verdict = 'ready' | 'ready_with_gaps' | 'not_ready';
export type ItemGroup = 'power' | 'fire' | 'elevators' | 'doors' | 'people' | 'records' | 'cameras';

export interface ReadinessItem {
  id: string;
  group: ItemGroup;
  critical: boolean;
  title: string;
  status: ItemStatus;
  summary: string;
  code?: string;
  facts: { key: string; label?: string; value?: unknown }[];
  source: { href: string | null } | null;
  next: { href: string | null } | null;
  age_s: number | null;
  redacted: boolean;
  na?: { by: string; at: string; note: string };
  files?: { id: string; task_id: string; kind: string; name: string; uploaded_at: string; href: string }[];
}

export interface ReadinessPage {
  verdict: Verdict;
  counts: Record<'green' | 'amber' | 'red' | 'unknown' | 'not_applicable' | 'hidden', number>;
  items: ReadinessItem[];
  banners: { code: string; text: string; count?: number; since?: string }[];
  checked_at: string;
  groups: { id: ItemGroup; title: string }[];
  can: { manage: boolean };
  disclaimer: string;
}

export interface EmergencyModule {
  enabled: boolean;
  can: { view: boolean; manage: boolean };
}

export type Slot = 'fire_certificate' | 'extinguishers' | 'hydrants_sprinklers' | 'emergency_lighting' | 'evacuation_round' | 'elevator_inspection';
export const SLOTS: readonly Slot[] = ['fire_certificate', 'extinguishers', 'hydrants_sprinklers', 'emergency_lighting', 'evacuation_round', 'elevator_inspection'];

export interface SlotTask {
  id: string;
  title: string;
  kind: string;
  category: string;
  due_date: string | null;
  elevator_id: string | null;
}

export interface EmergencyConfig {
  revision: number;
  slots: Record<Slot, SlotTask[]>;
  suggestions: Record<Slot, SlotTask[]>;
  not_applicable: Record<string, { by: string; at: string; note: string }>;
  thresholds: { effective: Record<string, number>; defaults: Record<string, number>; overrides: Record<string, number>; ranges: Record<string, [number, number]> };
  cameras: { selected: string[]; choices: { id: string; name: string; recorder: string }[] };
  history_keep_days: number;
}

export interface ConfigPatch {
  revision?: number;
  thresholds?: Record<string, number | null>;
  cameras?: string[];
  bindings?: Record<string, Slot | null>;
  not_applicable?: Record<string, { note: string } | null>;
}

export interface Contact {
  id: string;
  display_name: string;
  role_title: string;
  priority: number;
  active: boolean;
  revision: number;
  last_verified_at: string | null;
  verified_ok: boolean;
  has_phone: boolean;
  has_email: boolean;
  user_id: string | null;
  phone?: string;
  email?: string;
}

export interface ContactBody {
  display_name?: string;
  role_title?: string;
  phone?: string;
  email?: string;
  priority?: number;
  active?: boolean;
  revision?: number;
}

export interface HistoryPoint {
  at: string;
  verdict: Verdict;
  counts: Record<string, number>;
}

const B = 'emergency-readiness';
const enc = encodeURIComponent;

export const emergencyApi = {
  module: () => get<EmergencyModule>('emergency-readiness/module'),
  page: () => get<ReadinessPage>(B),
  config: () => get<EmergencyConfig>(`${B}/config`),
  putConfig: (body: ConfigPatch) => put<EmergencyConfig>(`${B}/config`, body),
  contacts: () => get<{ count: number; items: Contact[]; can_manage: boolean }>(`${B}/contacts`),
  createContact: (body: ContactBody) => post<Contact>(`${B}/contacts`, body),
  updateContact: (id: string, body: ContactBody) => patch<Contact>(`${B}/contacts/${enc(id)}`, body),
  verifyContact: (id: string) => post<Contact>(`${B}/contacts/${enc(id)}/verify`, {}),
  deleteContact: (id: string) => del(`${B}/contacts/${enc(id)}`),
  history: (days = 90) => get<{ keep_days: number; days: number; points: HistoryPoint[] }>(`${B}/history?days=${days}`),
};
