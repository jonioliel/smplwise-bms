import type { BulkKind } from '../api/device-bulk';
import type { CardId, DeviceRow } from '../api/devices';

/**
 * The area screen's redesign (owner decisions 2026-09-30; mockup docs/design/mockups/home/index.html): the two directions
 * of the same screen, the per-section "כבה הכל" registry and the main-sensors rules. Pure helpers - the screen
 * (devices-area.ts) draws, the layout editor (devices-layout.ts) stores; nothing here touches the network.
 */

/** "tiles" = אריחים צפופים (section cards in columns, dense tiles - the default); "sections" = מקטעים ברצף (one section
 * after the other, its title at the side, the sensors beside them). */
export type AreaDesign = 'tiles' | 'sections';
export const AREA_DESIGNS: AreaDesign[] = ['tiles', 'sections'];
export const AREA_DESIGN_LABEL: Record<AreaDesign, string> = { tiles: 'אריחים צפופים', sections: 'מקטעים ברצף' };
/** A user's own choice (this browser only) - honoured only for a holder of `screen.personalize`. */
export const AREA_DESIGN_KEY = 'sw.area.design';
export const PERSONALIZE_PERMISSION = 'screen.personalize';

export function isAreaDesign(v: unknown): v is AreaDesign {
  return v === 'tiles' || v === 'sections';
}

/** The direction in force: the installation's setting (`devices.area_design`), or - for someone allowed to personalise -
 * their own saved choice. Anything unknown is the default, dense tiles. */
export function resolveAreaDesign(installation: unknown, personal: unknown, mayPersonalize: boolean): AreaDesign {
  if (mayPersonalize && isAreaDesign(personal)) return personal;
  return isAreaDesign(installation) ? installation : 'tiles';
}

// ------------------------------------------------------------------------------------------------ section bulk button

export type BulkLook = 'icon' | 'text' | 'both';
export const BULK_LOOKS: BulkLook[] = ['icon', 'text', 'both'];
export const BULK_LOOK_LABEL: Record<BulkLook, string> = { icon: 'אייקון בלבד', text: 'טקסט בלבד', both: 'אייקון וטקסט' };

export interface SectionBulkAction {
  kind: BulkKind;
  label: string;
  icon: 'power' | 'arrowUp' | 'arrowDown';
}

/** Which built-in sections have a bulk button and what it does. Registry-driven: another kind of section is one entry
 * (media: `media: [{ kind: 'screens_off', label: 'כבה הכל', icon: 'power' }]` - the server already has screens_off; it stays
 * off here until the owner asks for it). Every action goes through the confirmation dialog of the bulk flow. */
export const SECTION_BULK: Partial<Record<CardId, SectionBulkAction[]>> = {
  lighting: [{ kind: 'lights_off', label: 'כבה הכל', icon: 'power' }],
  switches: [{ kind: 'switches_off', label: 'כבה הכל', icon: 'power' }],
  covers: [
    { kind: 'covers_open', label: 'פתח', icon: 'arrowUp' },
    { kind: 'covers_close', label: 'סגור', icon: 'arrowDown' },
  ],
  climate: [{ kind: 'climate_off', label: 'כבה הכל', icon: 'power' }],
};

export function isBulkLook(v: unknown): v is BulkLook {
  return v === 'icon' || v === 'text' || v === 'both';
}

// ------------------------------------------------------------------------------------------------ main sensors

/** A device the main strip may pick from. */
export interface MainCandidate {
  row: DeviceRow;
  card: CardId;
}

const MOTION_CLASSES = new Set(['motion', 'occupancy', 'presence', 'moving']);
const DOOR_CLASSES = new Set(['door', 'window', 'opening', 'garage_door']);

export type MainSlot = 'temperature' | 'humidity' | 'motion' | 'door';
export const MAIN_SLOTS: MainSlot[] = ['temperature', 'humidity', 'motion', 'door'];

/** Which main-strip slot a device fills, if any: temperature and humidity sensors, motion and door contacts. */
export function mainSlotOf(r: DeviceRow): MainSlot | null {
  if (r.domain === 'sensor') {
    if (r.device_class === 'temperature') return 'temperature';
    if (r.device_class === 'humidity') return 'humidity';
    return null;
  }
  if (r.domain === 'binary_sensor') {
    if (MOTION_CLASSES.has(r.device_class ?? '')) return 'motion';
    if (DOOR_CLASSES.has(r.device_class ?? '')) return 'door';
  }
  return null;
}

/** The automatic main strip: the first temperature, humidity, motion and door device the area HAS - a slot with no such
 * device is simply absent (never a placeholder). An owner's own list (`main`) replaces it. */
export function autoMain(rows: DeviceRow[]): DeviceRow[] {
  const out: DeviceRow[] = [];
  for (const slot of MAIN_SLOTS) {
    const hit = rows.find((r) => mainSlotOf(r) === slot && r.available);
    if (hit) out.push(hit);
  }
  return out;
}

/** The main strip for a section: the owner's list in its order (a device that is gone is skipped), else the automatic one. */
export function mainStrip(own: readonly string[] | undefined, byId: Map<string, DeviceRow>, areaRows: DeviceRow[]): { rows: DeviceRow[]; custom: boolean } {
  if (own && own.length) return { rows: own.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])), custom: true };
  return { rows: autoMain(areaRows), custom: false };
}
