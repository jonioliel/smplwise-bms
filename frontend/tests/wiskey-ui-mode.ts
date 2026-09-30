import { test, request as pwRequest } from '@playwright/test';

// הגדרות › בקרות כניסה (CR-005 recorded decision 2026-09-28): #/wiskey/overview, /events and /people show WisKey's own
// Home Assistant panel embedded by default. The evidence specs of the SMPLWISE WisKey screens call this at file level:
// it switches the three screens to SMPLWISE for the file (live backend only) and puts the owner's previous choice back
// afterwards. Runs with --workers=1 like every live spec: the choice is installation-wide.

export const ACCESS_UI_KEYS = ['access.ui.overview', 'access.ui.events', 'access.ui.people'] as const;
export type AccessUi = Partial<Record<(typeof ACCESS_UI_KEYS)[number], 'wiskey' | 'smplwise'>>;

export async function setAccessUi(baseURL: string | undefined, values: AccessUi): Promise<AccessUi | null> {
  const ctx = await pwRequest.newContext({ baseURL });
  try {
    const r = await ctx.get('/api/v1/settings');
    if (!r.ok()) return null;
    const settings = ((await r.json()) as { settings: Record<string, string> }).settings;
    const before: AccessUi = {};
    for (const k of ACCESS_UI_KEYS) if (settings[k] === 'wiskey' || settings[k] === 'smplwise') before[k] = settings[k] as 'wiskey' | 'smplwise';
    const p = await ctx.patch('/api/v1/settings', { data: values });
    if (!p.ok()) throw new Error(`PATCH /settings ${p.status()}: ${await p.text()}`);
    return before;
  } finally {
    await ctx.dispose();
  }
}

/** הגדרות › "גודל תצוגת WisKey" (owner 2026-09-30, installation-wide): normal | fit (with a scale) | full. */
export interface WiskeySizeSetting {
  'ui.wiskey_size'?: 'normal' | 'fit' | 'full';
  'ui.wiskey_scale'?: '100' | '90' | '80' | '70';
}

/** Sets the WisKey size setting on the live backend and returns the previous values (to put back afterwards). */
export async function setWiskeySize(baseURL: string | undefined, values: WiskeySizeSetting): Promise<WiskeySizeSetting> {
  const ctx = await pwRequest.newContext({ baseURL });
  try {
    const r = await ctx.get('/api/v1/settings');
    const s = ((await r.json()) as { settings: Record<string, string> }).settings;
    const before = { 'ui.wiskey_size': s['ui.wiskey_size'] ?? 'normal', 'ui.wiskey_scale': s['ui.wiskey_scale'] ?? '90' } as WiskeySizeSetting;
    const p = await ctx.patch('/api/v1/settings', { data: values });
    if (!p.ok()) throw new Error(`PATCH /settings ${p.status()}: ${await p.text()}`);
    return before;
  } finally {
    await ctx.dispose();
  }
}

export function useSmplwiseWiskeyScreens(): void {
  let before: AccessUi | null = null;
  test.beforeAll(async ({}, testInfo) => {
    if (process.env.SW_LIVE !== '1') return;
    before = await setAccessUi(testInfo.project.use.baseURL, { 'access.ui.overview': 'smplwise', 'access.ui.events': 'smplwise', 'access.ui.people': 'smplwise' });
  });
  test.afterAll(async ({}, testInfo) => {
    if (process.env.SW_LIVE !== '1' || !before || !Object.keys(before).length) return;
    await setAccessUi(testInfo.project.use.baseURL, before);
  });
}
