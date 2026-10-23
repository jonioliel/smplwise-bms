/**
 * WAPACE-295: the module of the frontend that talks to `/api/v1/messaging/whatsapp/policy`
 * (smplwise_vms/backend/smplwise/routers/messaging_accounts.py) - the WhatsApp recipient allow-list (handlers and providers) and the
 * self-messages test window. Installation-level (Settings > messaging channel). No number is ever returned: an entry carries a label, a
 * role and the last four digits. Without a backend the in-memory demo below answers (fake data only).
 */
import { del, get, post, put } from './client';
import { isApi } from './session';

export type PolicyRole = 'handler' | 'provider' | 'other';
export const POLICY_ROLES: PolicyRole[] = ['handler', 'provider', 'other'];

export interface PolicyEntry { id: string; label: string; role: PolicyRole; last4: string | null }
export interface PolicyView {
  enforce: boolean;
  can_manage: boolean;
  max_entries: number;
  allow: PolicyEntry[];
  self_messages: { active: boolean; until: string | null; minutes_default: number; minutes_range: [number, number] };
}
export interface PolicyAdd { phone: string; label: string; role: PolicyRole }

export interface MessagingPolicyBackend {
  view(): Promise<PolicyView>;
  setEnforce(enforce: boolean): Promise<PolicyView>;
  add(body: PolicyAdd): Promise<PolicyView>;
  remove(id: string): Promise<PolicyView>;
  /** minutes = open (or restart) a window; null = switch it off now */
  selfWindow(minutes: number | null): Promise<PolicyView>;
}

const URL = 'messaging/whatsapp/policy';
const rest: MessagingPolicyBackend = {
  view: () => get<PolicyView>(URL),
  setEnforce: (enforce) => put<PolicyView>(URL, { enforce }),
  add: (body) => post<PolicyView>(`${URL}/allow`, body),
  remove: async (id) => {
    await del(`${URL}/allow/${encodeURIComponent(id)}`);
    return get<PolicyView>(URL);
  },
  selfWindow: (minutes) => put<PolicyView>(`${URL}/self-messages`, { minutes }),
};

function demoView(): PolicyView {
  return {
    enforce: false, can_manage: true, max_entries: 500,
    allow: [{ id: 'demo00000001', label: 'דנה כהן', role: 'handler', last4: '0191' }, { id: 'demo00000002', label: 'מעליות בע"מ', role: 'provider', last4: '0192' }],
    self_messages: { active: false, until: null, minutes_default: 30, minutes_range: [1, 240] },
  };
}

let demo: PolicyView | null = null;
let seq = 3;
const demoBackend: MessagingPolicyBackend = {
  async view() {
    demo ??= demoView();
    if (demo.self_messages.until && Date.parse(demo.self_messages.until) <= Date.now()) demo.self_messages = { ...demo.self_messages, active: false, until: null };
    return structuredClone(demo);
  },
  async setEnforce(enforce) {
    demo ??= demoView();
    demo.enforce = enforce;
    return structuredClone(demo);
  },
  async add(body) {
    demo ??= demoView();
    const digits = body.phone.replace(/[\s\-().+]/g, '');
    if (!/^\d{8,15}$/.test(digits) || !body.label.trim()) throw new Error('validation');
    demo.allow = [...demo.allow, { id: `demo${String(seq++).padStart(8, '0')}`, label: body.label.trim(), role: body.role, last4: digits.slice(-4) }];
    return structuredClone(demo);
  },
  async remove(id) {
    demo ??= demoView();
    demo.allow = demo.allow.filter((e) => e.id !== id);
    return structuredClone(demo);
  },
  async selfWindow(minutes) {
    demo ??= demoView();
    demo.self_messages = { ...demo.self_messages, active: minutes !== null, until: minutes === null ? null : new Date(Date.now() + minutes * 60_000).toISOString() };
    return structuredClone(demo);
  },
};

export function messagingPolicyApi(): MessagingPolicyBackend {
  return isApi() ? rest : demoBackend;
}

/** Tests only: forget the demo store's edits. */
export function resetDemoMessagingPolicy(): void {
  demo = null;
  seq = 3;
}
