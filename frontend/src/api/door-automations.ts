/**
 * CR-AUTODOORS-295: the "open a door" blocks of automations (backend routers/door_automations.py, services/door_automation.py).
 * One block per automation, stored in Arx only; a person ARMS it; Arx opens the doors when the automation runs, under the block's
 * window / cooldown / caps, as the block's own automation operator. Everything is OFF in this release (`status.available` false).
 *
 * Transport: HTTP with a backend, an in-memory mock without one (demo mode, unit specs) - the same shapes and errors.
 */
import { isApi } from './session';
import { del, get, post, put } from './client';

export type BlockState = 'draft' | 'armed' | 'disarmed';

export interface DoorRef {
  station_id: string;
  relay: number;
}

export interface TimeWindow {
  /** 0 = Monday ... 6 = Sunday (the server's weekday numbering). */
  days: number[];
  start: string;
  /** "HH:MM" or "24:00". */
  end: string;
}

export interface DoorPolicy {
  doors: DoorRef[];
  windows: TimeWindow[];
  /** The four step limits are optional: absent = the installation's setting (owner decision 2026-10-21). */
  cooldown_s?: number;
  max_per_hour?: number;
  max_per_day?: number;
  arm_days?: number;
}

export type LimitKey = 'cooldown_s' | 'max_per_hour' | 'max_per_day' | 'arm_days';
export type Limits = Record<LimitKey, number> & { storm_refusals: number; storm_window_s: number };
/** The installation defaults (owner decision 2026-10-21): few limits, reasonable use in a public building. */
export const DEFAULT_LIMITS: Limits = { cooldown_s: 10, max_per_hour: 30, max_per_day: 300, arm_days: 180, storm_refusals: 5, storm_window_s: 600 };
export const STEP_BOUNDS: Record<LimitKey, [number, number]> = { cooldown_s: [1, 3600], max_per_hour: [1, 600], max_per_day: [1, 10000], arm_days: [1, 365] };

export interface DoorBlock {
  id: string;
  automation_id: string;
  automation_name: string | null;
  name: string;
  state: BlockState;
  policy: DoorPolicy;
  policy_revision: number;
  doors: (DoorRef & { name: string | null })[];
  bound_item_revision: string | null;
  armed_by: string | null;
  armed_by_name: string | null;
  armed_at: string | null;
  armed_until: string | null;
  disarm_reason: string | null;
  disarmed_at: string | null;
  effective_limits?: Record<LimitKey, number>;
  created_at: string;
  updated_at: string;
}

export interface DoorChoice extends DoorRef {
  name: string;
  online: boolean;
  can_arm: boolean;
}

export interface DoorAutomationStatus {
  visible: boolean;
  feature?: 'on' | 'off';
  go_live_permitted?: boolean;
  available?: boolean;
  killed?: boolean;
  can_manage?: boolean;
  can_lift_kill?: boolean;
  can_configure?: boolean;
  /** The installation's limits (administrator settings). */
  limits?: Limits;
}

export interface SimGate {
  gate: string;
  ok: boolean;
  reason: string | null;
}

export interface Simulation {
  at: string;
  gates: SimGate[];
  doors: { door: string | null; decision: 'would_open' | 'refused'; reason: string | null }[];
  would_send: boolean;
}

export interface FireRow {
  at: string;
  door: string | null;
  attempted: boolean;
  outcome: 'pending' | 'sent' | 'refused' | 'unknown' | 'not_sent';
  reason: string | null;
  code: string | null;
}

export interface DoorAutomationsAdapter {
  status(): Promise<DoorAutomationStatus>;
  doors(): Promise<DoorChoice[]>;
  forAutomation(automationId: string): Promise<DoorBlock | null>;
  create(automationId: string, name: string, policy: DoorPolicy): Promise<DoorBlock>;
  update(block: DoorBlock, name: string, policy: DoorPolicy): Promise<DoorBlock>;
  arm(block: DoorBlock): Promise<DoorBlock>;
  disarm(block: DoorBlock): Promise<DoorBlock>;
  simulate(block: DoorBlock): Promise<Simulation>;
  remove(block: DoorBlock): Promise<void>;
  fires(block: DoorBlock): Promise<FireRow[]>;
}

const BASE = 'door-automations';

export const httpDoorAutomations: DoorAutomationsAdapter = {
  status: () => get<DoorAutomationStatus>(`${BASE}/status`),
  doors: async () => (await get<{ doors: DoorChoice[] }>(`${BASE}/doors`)).doors,
  forAutomation: async (automationId) => (await get<{ items: DoorBlock[] }>(`${BASE}?automation_id=${encodeURIComponent(automationId)}`)).items[0] ?? null,
  create: (automationId, name, policy) => post<DoorBlock>(BASE, { automation_id: automationId, name, policy }),
  update: (block, name, policy) => put<DoorBlock>(`${BASE}/${block.id}`, { name, policy, policy_revision: block.policy_revision }),
  // the explicit confirmation flag is sent only from the arm dialog's confirm button
  arm: (block) => post<DoorBlock>(`${BASE}/${block.id}/arm`, { confirmed: true, policy_revision: block.policy_revision }),
  disarm: (block) => post<DoorBlock>(`${BASE}/${block.id}/disarm`, {}),
  simulate: (block) => post<Simulation>(`${BASE}/${block.id}/simulate`, {}),
  remove: async (block) => { await del(`${BASE}/${block.id}`); },
  fires: async (block) => (await get<{ fires: FireRow[] }>(`${BASE}/${block.id}/fires`)).fires,
};

/** A new step: no door chosen yet, no time window (any time) and the installation's limits (owner decision 2026-10-21). */
export function defaultPolicy(): DoorPolicy {
  return { doors: [], windows: [] };
}

/** The demo / unit-test world: synthetic doors, one block per automation, nothing ever sent. */
export function mockDoorAutomations(opts: { visible?: boolean; available?: boolean; killed?: boolean } = {}): DoorAutomationsAdapter {
  const blocks = new Map<string, DoorBlock>();
  const doors: DoorChoice[] = [
    { station_id: 'demo-entry', relay: 1, name: 'כניסה ראשית', online: true, can_arm: true },
    { station_id: 'demo-dock', relay: 2, name: 'רציף · שער', online: true, can_arm: true },
    { station_id: 'demo-roof', relay: 1, name: 'יציאה לגג', online: false, can_arm: false },
  ];
  let n = 0;
  const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const named = (p: DoorPolicy) => p.doors.map((d) => ({ ...d, name: doors.find((x) => x.station_id === d.station_id && x.relay === d.relay)?.name ?? null }));
  const find = (id: string) => [...blocks.values()].find((b) => b.id === id);
  return {
    status: async () => (!opts.visible ? { visible: false } : { visible: true, feature: opts.available ? 'on' : 'off', go_live_permitted: !!opts.available, available: !!opts.available, killed: !!opts.killed, can_manage: true, can_lift_kill: true, can_configure: true, limits: { ...DEFAULT_LIMITS } }),
    doors: async () => doors.map((d) => ({ ...d })),
    forAutomation: async (automationId) => blocks.get(automationId) ?? null,
    create: async (automationId, name, policy) => {
      const at = now();
      const b: DoorBlock = { id: `da_demo${String(++n).padStart(27, '0')}`, automation_id: automationId, automation_name: null, name, state: 'draft', policy: structuredClone(policy),
        policy_revision: 1, doors: named(policy), bound_item_revision: null, armed_by: null, armed_by_name: null, armed_at: null, armed_until: null, disarm_reason: null,
        disarmed_at: null, created_at: at, updated_at: at };
      blocks.set(automationId, b);
      return structuredClone(b);
    },
    update: async (block, name, policy) => {
      const b = find(block.id)!;
      Object.assign(b, { name, policy: structuredClone(policy), doors: named(policy), policy_revision: b.policy_revision + 1, updated_at: now() });
      if (b.state === 'armed') Object.assign(b, { state: 'disarmed', disarm_reason: 'edited', disarmed_at: now() });
      return structuredClone(b);
    },
    arm: async (block) => {
      const b = find(block.id)!;
      const until = new Date(Date.now() + (b.policy.arm_days ?? DEFAULT_LIMITS.arm_days) * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      Object.assign(b, { state: 'armed', armed_by: 'demo', armed_by_name: 'מנהל המערכת', armed_at: now(), armed_until: until, disarm_reason: null, disarmed_at: null });
      return structuredClone(b);
    },
    disarm: async (block) => {
      const b = find(block.id)!;
      if (b.state === 'armed') Object.assign(b, { state: 'disarmed', disarm_reason: 'manual', disarmed_at: now() });
      return structuredClone(b);
    },
    simulate: async (block) => {
      const b = find(block.id)!;
      const gates: SimGate[] = [
        { gate: 'armed', ok: b.state === 'armed', reason: b.state === 'armed' ? null : 'not_armed' },
        { gate: 'feature', ok: !!opts.available, reason: opts.available ? null : 'feature_off' },
        { gate: 'kill', ok: !opts.killed, reason: opts.killed ? 'killed' : null },
      ];
      const ds = b.doors.map((d) => ({ door: d.name, decision: 'would_open' as const, reason: null }));
      return { at: now(), gates, doors: ds, would_send: gates.every((g) => g.ok) };
    },
    remove: async (block) => { for (const [k, v] of blocks) if (v.id === block.id) blocks.delete(k); },
    fires: async () => [],
  };
}

/** The demo shows the block only when asked (`?demo-door-automation` in the page URL), so the existing demo screens stay as they are. */
function demoAsked(): boolean {
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo-door-automation');
  } catch {
    return false;
  }
}

let mock: DoorAutomationsAdapter | null = null;
/** HTTP with a backend, the mock otherwise (demo mode). */
export const doorAutomations = (): DoorAutomationsAdapter => (isApi() ? httpDoorAutomations : (mock ??= mockDoorAutomations({ visible: demoAsked() })));
