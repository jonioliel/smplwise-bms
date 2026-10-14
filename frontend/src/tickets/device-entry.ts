/**
 * CR-038 slice 3 (section 12.1, owner decision D17): what a long press, a right click / the menu key / Shift+F10 and Alt+Enter do on a
 * device of the home screens, and which tabs the device window offers - pure functions, so the matrix of 12.1 is tested row by row
 * (tests/unit-tickets-device.spec.ts).
 *
 *   situation                                     | tracked device (server flag `activity`)          | other catalogued device
 *   module off, or no tickets.view / devices.read | as today: the window on "activity"               | as today: nothing
 *   module on, mode `sheet` (DEFAULT)             | the window on "activity"; tabs ... + "{tickets}" last | the window with the "{tickets}" tab only
 *   module on, mode `menu`                        | the opaque menu: new / the device's / open device / history | the same without history
 *
 * Right click (and its keyboard equivalents) opens the menu in BOTH modes: the existing activity items plus "open a {ticket}" (with
 * tickets.create). In mode `menu` the long press shows the very same menu. Items the user may not use are absent. "Open the device" is
 * offered only where the host has an "open" tap action of its own (a plain row pill); it never toggles a device.
 */
import { canAnywhere, session } from '../api/session';
import { ticketsModuleOn } from '../shell/nav';

export type LongPressMode = 'sheet' | 'menu';
export type DeviceTab = 'activity' | 'schedules' | 'tickets';
export type MenuItem = 'device' | 'activity' | 'schedules' | 'ticket_new' | 'tickets';
export type Held = (permission: string) => boolean;

let override: LongPressMode | null = null;

/** D17: the installation's long-press behaviour (`/me` › modules.tickets_long_press; 'sheet' when absent or unknown). */
export function longPressMode(): LongPressMode {
  if (override) return override;
  return session.me?.modules?.tickets_long_press === 'menu' ? 'menu' : 'sheet';
}

/** The settings screen applies a saved choice at once (the next /me carries it for everyone else). */
export function setLongPressMode(mode: LongPressMode | null): void {
  override = mode;
}

/** Whether the device entry points exist for this user: the module is on and they hold tickets.view and devices.read somewhere (the
 * server checks devices.read on the entity itself - the rows a host shows are already the ones the caller may read). */
export function deviceTicketsOn(held: Held = canAnywhere, moduleOn: boolean = ticketsModuleOn()): boolean {
  return moduleOn && held('tickets.view') && held('devices.read');
}

export interface PressContext {
  tracked: boolean;
  on: boolean;
  mode: LongPressMode;
}

export type PressPlan = { kind: 'sheet'; tab: DeviceTab } | { kind: 'menu' } | null;

/** What a completed LONG PRESS does (the matrix above). */
export function pressPlan(c: PressContext): PressPlan {
  if (!c.on) return c.tracked ? { kind: 'sheet', tab: 'activity' } : null;
  if (c.mode === 'menu') return { kind: 'menu' };
  return { kind: 'sheet', tab: c.tracked ? 'activity' : 'tickets' };
}

/** What Alt+Enter opens: the window on its first tab. */
export function directTab(c: Pick<PressContext, 'tracked' | 'on'>): DeviceTab | null {
  if (c.tracked) return 'activity';
  return c.on ? 'tickets' : null;
}

/** The tabs of the device window: activity and schedules for a tracked device (today's tabs), "{tickets}" LAST when the entry exists. */
export function sheetTabs(c: Pick<PressContext, 'tracked' | 'on'>): DeviceTab[] {
  const tabs: DeviceTab[] = c.tracked ? ['activity', 'schedules'] : [];
  if (c.on) tabs.push('tickets');
  return tabs;
}

export interface MenuContext extends PressContext {
  /** the menu was opened by a long press (mode `menu`) rather than by a right click / the menu key */
  source: 'press' | 'context';
  /** the host row has an "open" tap action of its own */
  canOpenDevice: boolean;
  held?: Held;
}

/** The items of the opaque menu, in order. Today's right-click menu (activity, schedules) stays as it is with the module off. */
export function menuItems(c: MenuContext): MenuItem[] {
  const held = c.held ?? canAnywhere;
  const items: MenuItem[] = [];
  const menuMode = c.on && c.mode === 'menu';
  if (menuMode && c.canOpenDevice) items.push('device');
  if (c.tracked) items.push('activity', 'schedules');
  if (c.on) {
    if (held('tickets.create')) items.push('ticket_new');
    // the device's list: always in mode `menu`; with a right click in mode `sheet` only for a device without the window's other tabs
    if (menuMode || !c.tracked) items.push('tickets');
  }
  return items;
}
