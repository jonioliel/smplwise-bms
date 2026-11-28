/**
 * BV1 (2026-10-05): the quick-launcher grid of the home screen - what a launch button may be and whether THIS user may press it.
 * Backend twin of the ids: services/home_config.py (LAUNCH_ROUTES, LAUNCH_KINDS; the configuration is validated there). The
 * permissions here are a UX guard (a button is not drawn without them); the server checks every launch on its own route
 * (the automations screen's apply / run, the home screen's bulk dialog, the screens' own guards).
 */
import type { IconName } from '../components/sw-icon';
import { canAnywhere } from './session';
// PERF-2490: the automations model (with its adapters) loads with the first scene / script launch, not with the home screen
import type { ItemKind } from './automations';
import type { RunAsk } from './run-confirm';
import { navigate } from '../router';
import { tr } from '../i18n/msg/api-home';

type LaunchKind = 'route' | 'scene' | 'script' | 'quick';
export interface LaunchItem {
  kind: LaunchKind;
  /** A route id of LAUNCH_ROUTES, a `scene.*` / `script.*` entity id, or a quick action. */
  id: string;
  /** The owner's own label ('' = the route's name / the entity's name / the action's name). */
  label: string;
}
export const LAUNCH_KINDS: LaunchKind[] = ['route', 'scene', 'script', 'quick'];
export const LAUNCH_KIND_LABEL: Record<LaunchKind, string> = { route: tr('מסך'), scene: tr('סצנה'), script: tr('סקריפט'), quick: tr('פעולה מהירה') };
export const LAUNCHER_ITEMS_MAX = 12;

interface LaunchRoute {
  id: string;
  label: string;
  icon: IconName;
  hash: string;
  /** Any of these grants the button; empty = everyone. */
  perms: string[];
}

/** The product's own screens a launch button may open (ids = the backend's LAUNCH_ROUTES). No platform name anywhere (UI_COPY_RULES). */
export const LAUNCH_ROUTES: LaunchRoute[] = [
  { id: 'home', label: tr('חשמל והתקנים'), icon: 'home', hash: '/devices/building', perms: ['devices.read'] },
  { id: 'live', label: tr('לייב'), icon: 'camera', hash: '/live/wall', perms: ['video.live'] },
  { id: 'events', label: tr('אירועים'), icon: 'history', hash: '/investigate/events', perms: ['events.read'] },
  { id: 'map', label: tr('מפה'), icon: 'map', hash: '/explore', perms: ['map.read'] },
  { id: 'alarm', label: tr('אזעקה'), icon: 'shield', hash: '/security/alarm', perms: ['alarm.view'] },
  { id: 'screens', label: tr('מסכים'), icon: 'media', hash: '/multimedia/screens', perms: ['media.read'] },
  { id: 'players', label: tr('נגנים'), icon: 'play', hash: '/multimedia/players', perms: ['media.read'] },
  { id: 'schedules', label: tr('תזמונים'), icon: 'clock', hash: '/devices/schedules', perms: ['schedule.view'] },
  { id: 'automations', label: tr('אוטומציות'), icon: 'rule', hash: '/devices/automations', perms: ['automation.manage', 'scene.manage', 'script.run', 'script.manage'] },
  { id: 'wiskey', label: tr('בקרת כניסה'), icon: 'door', hash: '/wiskey', perms: ['access.read'] },
  { id: 'energy', label: tr('חשמל'), icon: 'bolt', hash: '/infra/electricity/meters', perms: ['energy.view'] },
  { id: 'settings', label: tr('הגדרות'), icon: 'system', hash: '/system', perms: ['system.configure'] },
];
export const LAUNCH_ROUTE_IDS = LAUNCH_ROUTES.map((r) => r.id);
export const launchRoute = (id: string): LaunchRoute | undefined => LAUNCH_ROUTES.find((r) => r.id === id);

/** The permissions the apply / run routes gate on (routers/automations.py `_scene_gate`, `script.run`). */
const SCENE_PERMS = ['scene.manage', 'devices.control', 'ha.entity.control'];
const SCRIPT_PERMS = ['script.run'];

/** Whether this user may press the item: the route's permission, the scene's / script's gate, the quick action's bulk right. */
export function launchAllowed(item: LaunchItem, quickAllowed: Partial<Record<string, boolean>>, can: (p: string) => boolean = canAnywhere): boolean {
  if (item.kind === 'route') {
    const r = launchRoute(item.id);
    return !!r && (!r.perms.length || r.perms.some(can));
  }
  if (item.kind === 'scene') return SCENE_PERMS.some(can);
  if (item.kind === 'script') return SCRIPT_PERMS.some(can);
  return !!quickAllowed[item.id];
}

/** The icon a button shows for its kind (a route has its own). */
export function launchIcon(item: LaunchItem): IconName {
  if (item.kind === 'route') return launchRoute(item.id)?.icon ?? 'grid';
  if (item.kind === 'scene') return 'sparkle';
  if (item.kind === 'script') return 'route';
  return item.id === 'all_off' ? 'power' : 'light';
}

/** A short entity label from an id when no name is known: `scene.good_evening` -> "good evening". */
export const idLabel = (id: string): string => id.split('.').slice(1).join('.').replace(/_/g, ' ');

/**
 * Runs a scene or a script (the same requests the automations screen sends; the server checks the permission again). Routes and the
 * quick actions are the caller's: a route navigates, a quick action goes through the home screen's bulk dialog (`home-quick`).
 */
export async function runLaunch(item: LaunchItem, ask: RunAsk = async () => false): Promise<'sent' | 'cancelled' | 'none'> {
  if (item.kind === 'route') {
    const r = launchRoute(item.id);
    if (r) navigate(r.hash);
    return 'none';
  }
  if (item.kind === 'quick') return 'none';
  // a scene / script is addressed by its automations item id, not its entity id: the list (the same gate as apply / run) resolves it
  const kind: ItemKind = item.kind;
  const [{ activateScene, automations, runScriptNow }, { runConfirmed }] = await Promise.all([import('./automations'), import('./run-confirm')]);
  const { items } = await automations().list({ kind, limit: 500 });
  const found = items.find((x) => x.entity_id === item.id);
  if (!found) throw new Error(item.kind === 'scene' ? tr('הסצנה לא נמצאה') : tr('הסקריפט לא נמצא'));
  // FIX-FE2-2570 (FE2-01): a sensitive scene / script (a lock, the alarm, a siren, a door step) is asked about first; the server's
  // `confirmation_required` asks too and, on yes, the request goes ONE more time with `confirm: true`. Without `ask` nothing sensitive runs.
  const r = item.kind === 'scene'
    ? await runConfirmed(found, (o) => activateScene(found.id, o), ask)
    : await runConfirmed(found, (o) => runScriptNow(found.id, {}, o), ask);
  return r.sent ? 'sent' : 'cancelled';
}
