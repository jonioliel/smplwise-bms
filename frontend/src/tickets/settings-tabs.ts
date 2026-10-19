/**
 * TKUI6: the seven tabs of Settings › the service-management module (mock-up v5), and which of them a viewer is offered. Pure: the
 * session's permission check in, the ids out. The ids of the old tabs are unchanged (`messages` is the templates tab), so every
 * address that points into the settings keeps working; `display` is the new one.
 */
export type SettingsTab = 'general' | 'departments' | 'locations' | 'display' | 'channel' | 'messages' | 'costs' | 'rules' | 'permissions';
/** CR-ORG-LOCATIONS: `locations` ("מיקומים", the organisation's locations) sits next to the departments (tickets.configure). */
/** TKRULES-291: `rules` ("פתיחה אוטומטית", tickets opened from alerts) is the installation's (system.configure). */
export const SETTINGS_TABS: readonly SettingsTab[] = ['general', 'departments', 'locations', 'display', 'channel', 'messages', 'costs', 'rules', 'permissions'];

export function isSettingsTab(v: string | null | undefined): v is SettingsTab {
  return !!v && (SETTINGS_TABS as readonly string[]).includes(v);
}

/** The tabs a viewer is offered: the display, channel and costs tabs are the installation document (system.configure), the templates
 * are tickets.configure; with no backend (the demo store) all of them. */
export function visibleTabs(o: { api: boolean; can: (perm: string) => boolean }): SettingsTab[] {
  const system = !o.api || o.can('system.configure');
  const configure = !o.api || o.can('tickets.configure');
  return SETTINGS_TABS.filter((t) => (t === 'display' || t === 'channel' || t === 'costs' || t === 'rules' ? system : t === 'messages' || t === 'locations' ? configure : true));
}

/** The next tab index for an arrow key in a tab list (the visual order follows the text direction: in RTL the first tab is at the right,
 * so ArrowLeft moves forward). Home / End jump to the ends; any other key returns null. */
export function rovingIndex(key: string, index: number, count: number, rtl: boolean): number | null {
  if (count < 1) return null;
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward) return (index + 1) % count;
  if (key === backward) return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
