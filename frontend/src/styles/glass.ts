/**
 * The glass host helper (code review 08:F13). It stood in `api/automations-demo.ts`, so every glass screen outside the automations
 * area (tickets, calendars, notices ...) imported the automations demo layer - and through it the automations adapter - for one
 * styling call. It is a style concern and lives with the other glass files (`media-glass.ts`, `automations-glass.ts`).
 *
 * The body is the one that stood in the demo layer, unchanged. The only thing it needs from that layer is the demo's scheme, read
 * here directly so that this file does not import the demo layer back (which re-exports this function for old importers).
 */
import { isApi } from '../api/session';
import { applyDevicesScheme } from '../screens/devices-style';
import { applyMediaGlass } from './media-glass';

/** The demo control of the automations screens (`DEMO_KEY` of api/automations-demo.ts - keep the two in step). */
const DEMO_KEY = 'sw.demo.automations';

/** `scheme` of the demo control ('light' | 'dark'), without a backend only: the same read as `demoControl().scheme`. */
function demoScheme(): 'light' | 'dark' | undefined {
  if (isApi()) return undefined;
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as { scheme?: 'light' | 'dark' }).scheme : undefined;
  } catch {
    return undefined;
  }
}

/** The glass style of the multimedia area (always glass), the installation's scheme with a backend, the demo control's scheme without one. */
export function applyAutomationsGlass(host: HTMLElement): void {
  void applyMediaGlass(host).then(() => {
    const scheme = demoScheme();
    if (!isApi() && scheme && host.isConnected) applyDevicesScheme(host, scheme);
  });
  const scheme = demoScheme();
  if (!isApi() && scheme) applyDevicesScheme(host, scheme);
}
