import type { Page } from '@playwright/test';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';
import { wizardState, type StepStatuses } from './secrets-setup-mocks';
import { demoReadiness } from '../src/api/readiness';

/**
 * DOCS-ONBOARDING-2530 (T071): the mocked backend of the getting-started checklist and the support tab - the Frigate mock's admin
 * session underneath, with the setting `onboarding.enabled`, the user's own `onboarding.dismissed`, the wizard state, the readiness
 * report (the demo fixture) and the bridge / home-system versions on top. Every write is recorded.
 */
export interface OnboardingMockOptions {
  enabled?: boolean;
  dismissed?: boolean;
  steps?: StepStatuses;
  /** the readiness report answers 500 (the checklist shows the wizard and the support page only) */
  readinessFails?: boolean;
}

export interface OnboardingMock {
  enabled: boolean;
  dismissed: boolean;
  puts: Record<string, unknown>[];
  patches: Record<string, unknown>[];
}

const HA_STATUS = {
  configured: true,
  sync: { connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 412, started_at: null, ha_version: '2026.11.2' },
  bridge: { paired: true, paired_at: '2026-11-20T08:00:00Z', directory_users: 4, last_directory_at: null, integration_version: '0.10.9' },
  integration: { state: 'active', source_version: '0.10.9', installed_version: '0.10.9', active_version: '0.10.9', installed_at: null, config_dir: null, last_error: null, discovery_posted_at: null, addon_url: '', up_to_date: true },
};

export async function installOnboardingMock(page: Page, o: OnboardingMockOptions = {}): Promise<OnboardingMock> {
  const st: OnboardingMock = { enabled: o.enabled ?? true, dismissed: o.dismissed ?? false, puts: [], patches: [] };
  await installFrigate(page, newFrigateMock({ perms: ADMIN }));
  // registered after the Frigate mock, so it answers first; everything else falls back to it
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me/prefs') {
      if (req.method() === 'PUT') {
        const b = req.postDataJSON() as Record<string, unknown>;
        st.puts.push(b);
        if ('onboarding.dismissed' in b) st.dismissed = b['onboarding.dismissed'] === true;
      }
      return json({ prefs: st.dismissed ? { 'onboarding.dismissed': true } : {}, stored: st.dismissed ? ['onboarding.dismissed'] : [], updated_at: null });
    }
    if (p === 'settings') {
      if (req.method() === 'PATCH') {
        const b = req.postDataJSON() as Record<string, unknown>;
        st.patches.push(b);
        if ('onboarding.enabled' in b) st.enabled = b['onboarding.enabled'] === 'true';
      }
      return json({ settings: { 'time.zone': 'Asia/Jerusalem', 'media.max_live_sessions': 16, 'onboarding.enabled': st.enabled ? 'true' : 'false' }, can_edit: true, nvr_channels: 8, warnings: [] });
    }
    if (p === 'setup/state') return json(wizardState(o.steps ?? { go2rtc: 'todo', floor: 'todo', camera: 'todo' }));
    if (p === 'readiness') return o.readinessFails ? json({ error: { code: 'internal', message: 'שגיאה' } }, 500) : json(demoReadiness());
    if (p === 'ha/status') return json(HA_STATUS);
    return route.fallback();
  });
  return st;
}
