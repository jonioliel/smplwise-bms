/**
 * CR-EMERG104: the ONLY module of the frontend that talks to `/api/v1/emergency-readiness...` (backend routers/emergency_readiness.py).
 * The server is the authority for every permission, redaction and status; the screen only draws what it is given. Read only: nothing
 * here operates a door, a generator, an elevator or a relay.
 */
import { get } from './client';

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

export const emergencyApi = {
  module: () => get<EmergencyModule>('emergency-readiness/module'),
  page: () => get<ReadinessPage>('emergency-readiness'),
};
