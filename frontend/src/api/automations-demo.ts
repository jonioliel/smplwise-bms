/**
 * CR-017 S3: the demo layer of the automations screens (not part of the S0 client; screens call `autoApi()` instead of `automations()`).
 * With a backend (`isApi()`) it is exactly `automations()`. Without one (the static demo, the evidence specs) the S0 MOCK answers and this
 * module applies the persona the page was opened with, read from `localStorage['sw.demo.automations']` (a JSON object, every key optional):
 *
 *   user          'installer' | 'household' | 'viewer'   the fixture users of api/automations-mock.ts
 *   delegation    boolean                                the bridge's delegation switch (default on, like the approved mockup)
 *   available     AutomationsStatus['available']         'ha_unavailable' | 'config_api_unavailable' | 'feature_disabled' ...
 *   scheduler     boolean                                CR-014's scheduler component present
 *   empty         boolean                                the lists answer nothing (the empty state)
 *   error         boolean                                the list answers 503 (the error state)
 *   noPermission  boolean                                the status answers 403 (the "no permission" state)
 *   invalid       string[]                               entity ids of automations the platform reports as invalid ("לא פעילה – שגיאה בהגדרה")
 *   offline       boolean                                the platform is down but the last list is still served: status `ha_unavailable` + `stale` (the strip over the list)
 *   scheme        'light' | 'dark'                       the device screens' scheme (devices.scheme) for the demo
 *   phoneFilter   'fold' | 'rows'  ·  sensitiveChip 'amber' | 'red'   the two owner display settings
 *
 * `?state=loading` on the address keeps the screens in their loading state (like the schedules list). Nothing here runs with a backend.
 */
import { ApiError } from './client';
import { isApi } from './session';
import { automations, type AutomationsAdapter } from './automations';
import type { MockUserId } from './automations-mock';
import { applyDevicesScheme } from '../screens/devices-style';
import { applyMediaGlass } from '../styles/media-glass';

export interface DemoControl {
  user?: MockUserId;
  delegation?: boolean;
  available?: 'ok' | 'ha_unavailable' | 'config_api_unavailable' | 'feature_disabled' | 'not_configured' | 'error';
  scheduler?: boolean;
  empty?: boolean;
  error?: boolean;
  noPermission?: boolean;
  offline?: boolean;
  invalid?: string[];
  scheme?: 'light' | 'dark';
  phoneFilter?: 'fold' | 'rows';
  sensitiveChip?: 'amber' | 'red';
}

export const DEMO_KEY = 'sw.demo.automations';

export function demoControl(): DemoControl {
  if (isApi()) return {};
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as DemoControl) : {};
  } catch {
    return {};
  }
}

/** `?state=loading` of the address: the demo screens stay in their loading state. */
export const demoLoading = (): boolean => !isApi() && /[?&]state=loading\b/.test(window.location.hash);

let applied: Promise<void> | null = null;
let demoClock: (() => Date) | null = null;

/** Applies the persona to the shared mock store once per page load; resolves immediately with a backend. */
export function autoReady(): Promise<void> {
  if (isApi()) return Promise.resolve();
  applied ??= import('./automations-mock').then((m) => {
    const c = demoControl();
    const store = m.automationsMock();
    if (c.user) store.setUser(c.user);
    if (c.delegation !== undefined) store.delegation = c.delegation;
    if (c.available) store.available = c.available;
    if (c.scheduler !== undefined) store.schedulerPresent = c.scheduler;
    if (c.phoneFilter || c.sensitiveChip) store.settingsValue = { ...store.settingsValue, ...(c.phoneFilter ? { phone_filter: c.phoneFilter } : {}), ...(c.sensitiveChip ? { sensitive_chip: c.sensitiveChip } : {}) };
    for (const entity of c.invalid ?? []) { const e = store.entry('automation', store.idOf(entity)); if (e) e.meta.invalid = true; }
    demoClock = store.clock;
    // a spec hook (demo mode only): the evidence specs reach the store to stage a change made outside, an invalid item, a failing write
    (window as unknown as { __automationsMock?: unknown }).__automationsMock = store;
  });
  return applied;
}

/** "Now" for relative times: the mock's fixed clock in the demo (deterministic evidence), the real one with a backend. */
export const autoNow = (): Date => (isApi() || !demoClock ? new Date() : demoClock());

const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, { code, user_message: message, retryable: status >= 500, correlation_id: 'demo', details: {} });
};

/** The adapter the screens use: HTTP with a backend, else the mock with the persona applied and the demo's empty / error / forbidden switches. */
export function autoApi(): AutomationsAdapter {
  if (isApi()) return automations();
  return new Proxy({} as AutomationsAdapter, {
    get: (_t, name: string) => {
      if (name === 'then') return undefined;
      return async (...args: unknown[]) => {
        await autoReady();
        const c = demoControl();
        if (name === 'status' && c.noPermission) return fail(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
        if (name === 'status' && c.offline) { const st = await automations().status(); return { ...st, available: 'ha_unavailable', stale: true }; }
        if (name === 'list') {
          if (c.error) return fail(503, 'ha_unavailable', 'תשתית המערכת אינה זמינה כרגע.');
          if (c.empty) return { items: [], total: 0 };
        }
        if (name === 'trash' && c.empty) return [];
        const target = automations() as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
        return target[name](...args);
      };
    },
  });
}

/** The glass style of the multimedia area (always glass), the installation's scheme with a backend, the demo control's scheme without one. */
export function applyAutomationsGlass(host: HTMLElement): void {
  void applyMediaGlass(host).then(() => {
    const scheme = demoControl().scheme;
    if (!isApi() && scheme && host.isConnected) applyDevicesScheme(host, scheme);
  });
  const scheme = demoControl().scheme;
  if (!isApi() && scheme) applyDevicesScheme(host, scheme);
}
