import type { Page } from '@playwright/test';

// 0.1.157: the screens that got the bubble CHROME (security, device lists, automations lists, settings) and the helpers the
// layout guard (layout-bubble-lists.spec.ts) and the evidence spec (evidence-bubble-lists.spec.ts) share. Demo mode throughout:
// no backend answers, every screen draws its demo data or its empty state - the chrome is what is measured and shot.

export interface ChromeScreen {
  id: string;
  hash: string;
  /** the screen element inside sw-app's shadow root */
  outer: string;
  group: 'security' | 'devices' | 'automations' | 'settings';
}

export const CHROME_SCREENS: ChromeScreen[] = [
  { id: 'live', hash: '/live', outer: 'live-overview', group: 'security' },
  { id: 'wall', hash: '/live/wall', outer: 'live-wall', group: 'security' },
  { id: 'views', hash: '/live/views', outer: 'live-views', group: 'security' },
  { id: 'events', hash: '/investigate/events', outer: 'investigate-events', group: 'security' },
  { id: 'cases', hash: '/investigate/cases', outer: 'investigate-cases', group: 'security' },
  { id: 'rules', hash: '/investigate/rules', outer: 'investigate-rules', group: 'security' },
  { id: 'exports', hash: '/investigate/exports', outer: 'investigate-exports', group: 'security' },
  { id: 'alarm', hash: '/security/alarm', outer: 'security-alarm', group: 'security' },
  { id: 'entities', hash: '/system/entities', outer: 'explore-entities', group: 'devices' },
  { id: 'cameras', hash: '/system/devices', outer: 'system-devices', group: 'devices' },
  { id: 'schedules', hash: '/devices/schedules', outer: 'devices-schedules', group: 'devices' },
  { id: 'automations', hash: '/devices/automations', outer: 'devices-automations', group: 'automations' },
  { id: 'settings', hash: '/system/diagnostics', outer: 'system-diagnostics', group: 'settings' },
  { id: 'access', hash: '/system/access', outer: 'system-access', group: 'settings' },
  { id: 'settings-tabs', hash: '/system/diagnostics?tab=tabs', outer: 'system-diagnostics', group: 'settings' },
  { id: 'settings-devices', hash: '/system/diagnostics?tab=devices', outer: 'system-diagnostics', group: 'settings' },
  { id: 'notifications', hash: '/system/notifications', outer: 'system-notifications', group: 'settings' },
  { id: 'automations-settings', hash: '/system/automations', outer: 'system-automations', group: 'settings' },
];

const LOOK_URL = '/src/design/look.ts';

/** Saves a personal look (the dials) through the app's own module: needs the Vite dev server. */
export async function setLook(page: Page, look: Record<string, string | number>) {
  await page.evaluate(
    async ([url, l]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnLook(l);
    },
    [LOOK_URL, look] as const,
  );
}

/** Opens a route in the demo mode with the bubble skin and waits for the screen element to have rendered. */
export async function openChrome(page: Page, s: ChromeScreen, theme: string, query = '', skin = 'bubble') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${theme}${query}#${s.hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(
    (o) => {
      const el = document.querySelector('sw-app')?.shadowRoot?.querySelector(o);
      return !!el && !!el.shadowRoot && el.shadowRoot.childElementCount > 0;
    },
    s.outer,
    { timeout: 20_000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
