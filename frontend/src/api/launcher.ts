/**
 * BV1 (2026-10-05): the quick-launcher grid of the home screen - what a launch button may be and whether THIS user may press it.
 * Backend twin of the ids: services/home_config.py (LAUNCH_ROUTES, LAUNCH_KINDS; the configuration is validated there). The
 * permissions here are a UX guard (a button is not drawn without them); the server checks every launch on its own route
 * (the automations screen's apply / run, the home screen's bulk dialog, the screens' own guards).
 */
import type { IconName } from '../components/sw-icon';
import { canAnywhere } from './session';
import { activateScene, automations, runScriptNow, type ItemKind } from './automations';
import { navigate } from '../router';

export type LaunchKind = 'route' | 'scene' | 'script' | 'quick';
export interface LaunchItem {
  kind: LaunchKind;
  /** A route id of LAUNCH_ROUTES, a `scene.*` / `script.*` entity id, or a quick action. */
  id: string;
  /** The owner's own label ('' = the route's name / the entity's name / the action's name). */
  label: string;
}
export const LAUNCH_KINDS: LaunchKind[] = ['route', 'scene', 'script', 'quick'];
export const LAUNCH_KIND_LABEL: Record<LaunchKind, string> = { route: 'מסך', scene: 'סצנה', script: 'סקריפט', quick: 'פעולה מהירה' };
export const LAUNCHER_ITEMS_MAX = 12;

export interface LaunchRoute {
  id: string;
  label: string;
  icon: IconName;
  hash: string;
  /** Any of these grants the button; empty = everyone. */
  perms: string[];
}

/** The product's own screens a launch button may open (ids = the backend's LAUNCH_ROUTES). No platform name anywhere (UI_COPY_RULES). */
export const LAUNCH_ROUTES: LaunchRoute[] = [
  { id: 'home', label: 'חשמל והתקנים', icon: 'home', hash: '/devices/building', perms: ['devices.read'] },
  { id: 'live', label: 'לייב', icon: 'camera', hash: '/live/wall', perms: ['video.live'] },
  { id: 'events', label: 'אירועים', icon: 'history', hash: '/investigate/events', perms: ['events.read'] },
  { id: 'map', label: 'מפה', icon: 'map', hash: '/explore', perms: ['map.read'] },
  { id: 'alarm', label: 'אזעקה', icon: 'shield', hash: '/security/alarm', perms: ['alarm.view'] },
  { id: 'screens', label: 'מסכים', icon: 'media', hash: '/multimedia/screens', perms: ['media.read'] },
  { id: 'players', label: 'נגנים', icon: 'play', hash: '/multimedia/players', perms: ['media.read'] },
  { id: 'schedules', label: 'תזמונים', icon: 'clock', hash: '/devices/schedules', perms: ['schedule.view'] },
  { id: 'automations', label: 'אוטומציות', icon: 'rule', hash: '/devices/automations', perms: ['automation.manage', 'scene.manage', 'script.run', 'script.manage'] },
  { id: 'wiskey', label: 'בקרת כניסה', icon: 'door', hash: '/wiskey', perms: ['access.read'] },
  { id: 'energy', label: 'חשמל', icon: 'bolt', hash: '/infra/electricity/meters', perms: ['energy.view'] },
  { id: 'settings', label: 'הגדרות', icon: 'system', hash: '/system', perms: ['system.configure'] },
];
export const LAUNCH_ROUTE_IDS = LAUNCH_ROUTES.map((r) => r.id);
export const launchRoute = (id: string): LaunchRoute | undefined => LAUNCH_ROUTES.find((r) => r.id === id);

/** The permissions the apply / run routes gate on (routers/automations.py `_scene_gate`, `script.run`). */
export const SCENE_PERMS = ['scene.manage', 'devices.control', 'ha.entity.control'];
export const SCRIPT_PERMS = ['script.run'];

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
export async function runLaunch(item: LaunchItem): Promise<void> {
  if (item.kind === 'route') {
    const r = launchRoute(item.id);
    if (r) navigate(r.hash);
    return;
  }
  if (item.kind === 'quick') return;
  // a scene / script is addressed by its automations item id, not its entity id: the list (the same gate as apply / run) resolves it
  const kind: ItemKind = item.kind;
  const { items } = await automations().list({ kind, limit: 500 });
  const found = items.find((x) => x.entity_id === item.id);
  if (!found) throw new Error(item.kind === 'scene' ? 'הסצנה לא נמצאה' : 'הסקריפט לא נמצא');
  if (item.kind === 'scene') await activateScene(found.id);
  else await runScriptNow(found.id);
}
