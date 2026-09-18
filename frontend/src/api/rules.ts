/** Alarm rules with a dry run (T052): trigger × scope × window × cooldown → a VMS notification; never a device command. */
import { del, get, patch, post } from './client';

export interface RuleTrigger {
  types: string[];
  sources: string[];
  severity_min: 'info' | 'alert' | 'critical';
}
export interface RuleScope {
  site_ids: string[];
  building_ids: string[];
  floor_ids: string[];
  zone_ids: string[];
  camera_ids: string[];
  entity_ids: string[];
}
export interface RuleWindow {
  days: string[];
  from: string | null;
  to: string | null;
}
export interface RuleAction {
  kind: 'notify' | 'ha_notify';
  message: string;
  /** ha_notify: the notify.<service> in Home Assistant (e.g. mobile_app_phone). */
  service?: string | null;
}
export interface RuleBody {
  name: string;
  description: string;
  enabled: boolean;
  owner: 'local' | 'ha';
  ha_automation_id: string | null;
  trigger: RuleTrigger;
  scope: RuleScope;
  window: RuleWindow;
  cooldown_s: number;
  actions: RuleAction[];
}
export interface Rule extends RuleBody {
  id: string;
  revision: number;
  created_by_username: string | null;
  updated_by_username: string | null;
  created_at: string;
  updated_at: string;
  last_fired_at: string | null;
  alerts: { total: number; open: number };
}
export interface DryRunRow {
  event_id: string;
  occurred_at: string;
  type: string;
  source: string;
  severity: string;
  camera_id: string | null;
  camera_name: string | null;
  reasons: string[];
  suppressed?: string;
}
export interface DryRunResult {
  rule_name: string;
  hours: number;
  since: string;
  until: string;
  evaluated: number;
  would_fire: DryRunRow[];
  suppressed: DryRunRow[];
  not_matched: number;
  note: string;
}
export interface RuleAlert {
  id: string;
  rule_id: string;
  rule_name: string | null;
  event_id: string;
  camera_id: string | null;
  entity_id: string | null;
  fired_at: string;
  reasons: string[];
  message: string;
  acked_at: string | null;
  acked_by_username: string | null;
}

export const emptyRule = (): RuleBody => ({
  name: '',
  description: '',
  enabled: true,
  owner: 'local',
  ha_automation_id: null,
  trigger: { types: [], sources: [], severity_min: 'info' },
  scope: { site_ids: [], building_ids: [], floor_ids: [], zone_ids: [], camera_ids: [], entity_ids: [] },
  window: { days: [], from: null, to: null },
  cooldown_s: 300,
  actions: [{ kind: 'notify', message: '' }],
});

export const listRules = () => get<{ rules: Rule[]; types: string[]; sources: string[]; action_kinds: string[]; days: string[] }>('rules');
export const createRule = (body: RuleBody) => post<Rule>('rules', body);
export const updateRule = (id: string, body: RuleBody & { revision: number }) => patch<Rule>(`rules/${id}`, body);
export const deleteRule = (id: string) => del(`rules/${id}`);
export const dryRunRule = (rule: RuleBody, hours = 24) => post<DryRunResult>('rules/dry-run', { rule, hours });
export const dryRunStored = (ruleId: string, hours = 24) => post<DryRunResult>('rules/dry-run', { rule_id: ruleId, hours });
export const listAlerts = (unacked = false) => get<{ alerts: RuleAlert[]; unacked: number }>(`rules/alerts${unacked ? '?unacked=true' : ''}`);
export const ackAlert = (id: string) => post<RuleAlert>(`rules/alerts/${id}/ack`);

export const DAY_LABEL: Record<string, string> = { mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳', sun: 'א׳' };
export const SOURCE_LABEL_RULE: Record<string, string> = { alertstream: 'התראת NVR', recording: 'נגזר מהקלטה', system: 'מערכת', ha: 'חיישן HA' };
