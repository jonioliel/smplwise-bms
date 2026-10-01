/**
 * CR-018 S3: the one client-side store behind the notification center, the avatar badge and the user menu chip. It owns the loaded inbox page, the
 * summary numbers, the installation facts the center needs (time zone, area names, quiet hours, the administrator's `center_layout`, this device's push
 * state) and the per-row actions (read, snooze, acknowledge) with their optimistic updates. The binding contract and every pure helper live in
 * api/notifications.ts; the live events of `/me/ws` and the 60 s poll of the shell keep it fresh.
 *
 * Without a backend (the static preview, specs) the adapter is the in-memory mock. The mock is only switched on for the badge when a scenario is set
 * (sessionStorage `sw-notify-mock`, see `readScenario`): a plain demo page keeps the shell exactly as before (no chip, no dot); the center itself always
 * opens on the mock in the demo.
 */
import {
  applyAck, applyRead, applySnooze, notify, notifyErrorText, snoozeUntil, summarize,
  type CenterLayout, type Notification, type NotifyAdapter, type NotifySettings, type NotifySummary, type SnoozeChoice,
} from '../api/notifications';
import { can, isApi, onMeEvent, session } from '../api/session';
import { productSettings } from '../api/prefs';
import { getDevicesTree } from '../api/devices';
import { currentSubscription, endpointHash, listSubscriptions, pushSupport, type PushSupport } from '../pwa/push';
import { applyMediaGlass } from '../styles/media-glass';
import { applyLiveEvent, replaceRow } from './notify-logic';

export type StorePhase = 'idle' | 'loading' | 'ready' | 'error';
export interface NotifyState {
  phase: StorePhase;
  error: string;
  rows: Notification[];
  nextBefore: string | null;
  summary: NotifySummary | null;
  /** The summary request failed (an older backend): the shell falls back to the rule-alert poll. */
  summaryFailed: boolean;
  /** The installation settings: only for a `notify.manage` holder (null for everyone else). */
  settings: NotifySettings | null;
  layout: CenterLayout;
  tz: string | undefined;
  areas: Record<string, string>;
  support: PushSupport;
  registeredHere: number;
  now: number;
  manage: boolean;
}

/** The mock scenario of a design review or a spec (sessionStorage `sw-notify-mock`, JSON). */
export interface MockScenario {
  viewer?: 'admin' | 'operator' | 'door' | 'planner';
  quietNow?: boolean;
  push?: PushSupport;
  registered?: number;
  emailConfigured?: boolean;
  emailHost?: string;
  stepUp?: boolean;
  /** Force the center's state: the list never answers (loading), answers nothing (empty) or fails (error). */
  state?: 'loading' | 'empty' | 'error';
  layout?: CenterLayout;
  /** The colour scheme of the notification surfaces in the demo (a real installation follows `devices.scheme`). */
  scheme?: 'light' | 'dark';
}
export const SCENARIO_KEY = 'sw-notify-mock';
export function readScenario(): MockScenario | null {
  try {
    const raw = window.sessionStorage.getItem(SCENARIO_KEY);
    return raw ? (JSON.parse(raw) as MockScenario) : null;
  } catch {
    return null;
  }
}

/** The glass style and the installation's palette / scheme on a notification surface (styles/media-glass.ts), plus the demo scenario's scheme. */
export async function applyNotifyGlass(host: HTMLElement): Promise<void> {
  await applyMediaGlass(host);
  const sc = readScenario();
  if (!isApi() && sc?.scheme && host.isConnected) host.setAttribute('data-devices-scheme', sc.scheme);
}

type Listener = (s: NotifyState) => void;
const DEFAULTS = (): NotifyState => ({
  phase: 'idle', error: '', rows: [], nextBefore: null, summary: null, summaryFailed: false, settings: null, layout: 'sheet', tz: undefined, areas: {}, support: 'ok', registeredHere: 1, now: Date.now(), manage: false,
});

class NotifyStore {
  state: NotifyState = DEFAULTS();
  private listeners = new Set<Listener>();
  private scenarioReady: Promise<void> | null = null;
  private started = false;
  private stopLive: (() => void) | null = null;
  private refetchTimer = 0;
  private loadSeq = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(patch: Partial<NotifyState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  private adapter(): NotifyAdapter {
    return notify();
  }

  /** Applies the mock scenario once (before the first mock use); a no-op against a real backend. */
  private async scenario(): Promise<MockScenario | null> {
    if (isApi()) return null;
    const sc = readScenario();
    // one shared promise: a second caller waits for the reset instead of reading the default mock while it is still being replaced
    this.scenarioReady ??= (async () => {
      if (!sc) return;
      const m = await import('../api/notifications-mock');
      m.resetNotifyMock({ viewer: sc.viewer, quietNow: sc.quietNow, push: sc.push, registered: sc.registered, emailConfigured: sc.emailConfigured, emailHost: sc.emailHost, stepUp: sc.stepUp });
      (window as unknown as { __swNotifyMock?: unknown }).__swNotifyMock = m.notifyMock(); // the specs read the mock's door releases and clock
    })();
    await this.scenarioReady;
    return sc;
  }

  /** The fixture's clock in the demo (stable relative times), the real one against a backend. */
  private async clock(): Promise<number> {
    if (isApi()) return Date.now();
    const m = await import('../api/notifications-mock');
    return m.notifyMock().clock;
  }

  /** Applies the mock scenario of a design review / spec before anything reads the mock (the Settings screen asks first). */
  async prepare(): Promise<void> {
    await this.scenario();
  }

  /** The session is known: start the badge (a summary now, the live events afterwards). Idempotent per session mode. */
  async start(): Promise<void> {
    if (this.started) return;
    const api = isApi();
    const sc = api ? null : readScenario();
    if (!api && !sc) return; // a plain demo page: nothing to count
    this.started = true;
    await this.refreshSummary();
    if (api) {
      this.stopLive = onMeEvent((env) => this.live(env));
    } else {
      const h = (e: Event) => this.live((e as CustomEvent<{ type: string; payload?: unknown }>).detail);
      window.addEventListener('sw-notify-event', h);
      this.stopLive = () => window.removeEventListener('sw-notify-event', h);
    }
  }

  stop(): void {
    this.stopLive?.();
    this.stopLive = null;
    this.started = false;
    window.clearTimeout(this.refetchTimer);
  }

  async refreshSummary(): Promise<void> {
    try {
      await this.scenario();
      const summary = await this.adapter().summary();
      this.set({ summary, summaryFailed: false, now: await this.clock() });
    } catch {
      this.set({ summaryFailed: true });
    }
  }

  /** The socket's events (api/session.ts `onMeEvent`): a new notification refetches, a state change patches in place, a summary replaces the numbers. */
  private live(env: { type: string; payload?: unknown }): void {
    const eff = applyLiveEvent(this.state.rows, env);
    this.set({ rows: eff.rows, ...(eff.summary ? { summary: { ...(this.state.summary ?? { by_category: {} }), ...eff.summary } as NotifySummary } : {}) });
    if (eff.refetch) {
      window.clearTimeout(this.refetchTimer);
      this.refetchTimer = window.setTimeout(() => {
        void this.refreshSummary();
        if (this.state.phase === 'ready') void this.reloadQuiet();
      }, 250);
    }
  }

  // ---------------------------------------------------------------------------------------------- loading the center

  /** Loads the inbox and the facts around it. `quiet` keeps the current rows on screen (no skeleton). */
  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.set({ phase: 'loading', error: '' });
    try {
      const sc = await this.scenario();
      if (sc?.state === 'loading') return; // the list never answers (the loading state of the evidence)
      if (sc?.state === 'error') throw new Error('mock error');
      const a = this.adapter();
      const [page, summary, env] = await Promise.all([sc?.state === 'empty' ? Promise.resolve({ notifications: [], next_before: null }) : a.list({ limit: 50 }), a.summary().catch(() => null), this.loadEnv(sc)]);
      if (seq !== this.loadSeq) return;
      this.set({ phase: 'ready', error: '', rows: page.notifications, nextBefore: page.next_before, summary: summary ?? this.state.summary, summaryFailed: summary === null && !this.state.summary, ...env });
    } catch (err) {
      if (seq !== this.loadSeq) return;
      this.set({ phase: 'error', error: err instanceof Error && err.message === 'mock error' ? 'לא ניתן לטעון התראות' : notifyErrorText(err) });
    }
  }
  private async reloadQuiet(): Promise<void> {
    try {
      const page = await this.adapter().list({ limit: Math.max(50, this.state.rows.length) });
      this.set({ rows: page.notifications, nextBefore: page.next_before, now: await this.clock() });
    } catch {
      /* the next poll tries again */
    }
  }

  private async loadEnv(sc: MockScenario | null): Promise<Partial<NotifyState>> {
    const out: Partial<NotifyState> = { now: await this.clock() };
    const api = isApi();
    const a = this.adapter();
    // the installation settings: the administrator's call; everyone else learns only the layout (a product setting)
    let settings: NotifySettings | null = null;
    if (!api || can('notify.manage')) settings = await a.settings().catch(() => null);
    out.settings = settings;
    out.manage = settings !== null;
    out.layout = (!api && sc?.layout) || settings?.center_layout || 'sheet';
    if (api) {
      const ps = (await productSettings().catch(() => ({}))) as Record<string, unknown>;
      out.tz = typeof ps['time.zone'] === 'string' ? (ps['time.zone'] as string) : undefined;
      if (!settings && (ps['notify.center_layout'] === 'page' || ps['notify.center_layout'] === 'sheet')) out.layout = ps['notify.center_layout'] as CenterLayout;
      out.areas = await getDevicesTree().then((t) => Object.fromEntries(t.floors.flatMap((f) => f.areas.map((x) => [x.area_id, x.name] as const)))).catch(() => ({}));
      out.support = pushSupport();
      out.registeredHere = await this.registeredHere(out.support);
    } else {
      const m = await import('../api/notifications-mock');
      const st = m.notifyMock();
      out.tz = m.MOCK_TZ;
      out.areas = { ...m.MOCK_AREAS };
      out.support = st.pushSupport;
      out.registeredHere = st.registered;
    }
    return out;
  }
  private async registeredHere(support: PushSupport): Promise<number> {
    if (support !== 'ok') return 0;
    try {
      const sub = await currentSubscription();
      if (!sub) return 0;
      const hash = await endpointHash(sub.endpoint);
      return (await listSubscriptions()).subscriptions.some((r) => r.endpoint_hash === hash) ? 1 : 0;
    } catch {
      return 0;
    }
  }

  async loadMore(): Promise<void> {
    const before = this.state.nextBefore;
    if (!before) return;
    try {
      const page = await this.adapter().list({ limit: 50, before });
      this.set({ rows: [...this.state.rows, ...page.notifications.filter((n) => !this.state.rows.some((r) => r.id === n.id))], nextBefore: page.next_before });
    } catch {
      /* the button stays; the user tries again */
    }
  }

  // ---------------------------------------------------------------------------------------------- per-row actions

  /** The clock moves on (a real backend; the demo's clock is the fixture's): relative times and the snooze state follow. */
  tick(): void {
    if (isApi()) this.set({ now: Date.now() });
  }

  /** The viewer's own display name ("אושר · דנה", "מחובר כ־יוני"). */
  async me(): Promise<string> {
    if (isApi()) return session.me?.user.display_name ?? '';
    const m = await import('../api/notifications-mock');
    return m.notifyMock().user.display;
  }
  private recompute(rows: Notification[]): void {
    this.set({ rows, summary: this.state.summary ? { ...summarize(rows, this.state.now), by_category: this.state.summary.by_category } : null });
  }
  private patch(id: string, fn: (n: Notification) => Notification): void {
    this.recompute(this.state.rows.map((n) => (n.id === id ? fn(n) : n)));
  }

  async read(id: string): Promise<void> {
    const now = this.state.now;
    this.patch(id, (n) => applyRead(n, now));
    try {
      const row = await this.adapter().read(id);
      if (row) this.set({ rows: replaceRow(this.state.rows, row) });
    } catch { /* the row stays read here; the next load corrects it */ }
    void this.refreshSummary();
  }
  async readAll(): Promise<void> {
    const now = this.state.now;
    this.recompute(this.state.rows.map((n) => applyRead(n, now)));
    try { await this.adapter().readAll(); } catch { /* corrected by the next load */ }
    void this.refreshSummary();
  }
  async snooze(id: string, choice: SnoozeChoice): Promise<string | null> {
    const row = this.state.rows.find((n) => n.id === id);
    if (!row) return 'ההתראה כבר לא זמינה';
    const until = snoozeUntil(choice, this.state.now, this.state.settings?.quiet, this.state.tz);
    this.patch(id, (n) => applySnooze(n, until));
    try {
      const r = await this.adapter().snooze(id, choice);
      if (r) this.set({ rows: replaceRow(this.state.rows, r) });
      void this.refreshSummary();
      return null;
    } catch (err) {
      await this.reloadQuiet();
      return notifyErrorText(err);
    }
  }
  async ack(id: string): Promise<string | null> {
    const row = this.state.rows.find((n) => n.id === id);
    if (!row || !row.can_ack) return 'אין הרשאה לאשר את ההתראה הזו';
    const who = await this.me();
    const now = this.state.now;
    this.patch(id, (n) => applyAck(n, who, now));
    try {
      const r = await this.adapter().ack(id);
      if (r) this.set({ rows: replaceRow(this.state.rows, r) });
      void this.refreshSummary();
      return null;
    } catch (err) {
      await this.reloadQuiet();
      return notifyErrorText(err);
    }
  }
}

/** The shell's store (one per page). */
export const notifyStore = new NotifyStore();
