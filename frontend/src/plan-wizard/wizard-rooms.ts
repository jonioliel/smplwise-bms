// FIX-MAPS2-2570 (deep review 2.57 MH2-01, MH2-04): the rooms step's save, out of plan-wizard.ts so it runs in node
// (tests/unit-fix-maps2-2570.spec.ts). Pure: the wizard hands in its backend calls and keeps the rooms it is told about.
import { describeError } from '../api/client';
import type { ZoneKind } from '../api/zones';
import { tr } from '../i18n/msg/plan-wizard';
import type { CreatedRoom } from './wizard-backend';

/** One room of the rooms step as it is saved: its outline, its name, its kind, the tags of its type and the area it links to. */
export interface RoomToSave {
  polygon: { x: number; y: number }[];
  name: string;
  kind: ZoneKind;
  tags: string[];
  areaId: string | null;
}

/** The two backend calls of the save (wizard-backend.ts). */
export interface RoomsSaveBackend {
  acceptRooms(rooms: { polygon: { x: number; y: number }[]; name: string; kind: ZoneKind }[], replaceAuto: boolean, dropFirst: string[]): Promise<CreatedRoom[]>;
  tagRoom(room: CreatedRoom, tags: string[], areaId: string | null): Promise<void>;
}

/**
 * Save the rooms: the wizard's rooms of an earlier pass (`created`) are replaced by the new set, then every new room gets its type's
 * tags and its area link. `keep` receives the rooms the wizard now owns.
 *
 * MH2-01: the new rooms are live on the floor as soon as the accept answers, so `keep` gets them right then - before the tagging. A
 * tagging that fails afterwards (a refused area link, a dropped connection) no longer leaves them unknown to the wizard: "save" again
 * replaces them (one set on the floor, never two) and "discard" removes them. Every room is tried; the error names the rooms that
 * were left without their tags / area link.
 */
export async function saveWizardRooms(b: RoomsSaveBackend, rows: RoomToSave[], replaceAuto: boolean, created: readonly CreatedRoom[], keep: (made: CreatedRoom[]) => void): Promise<void> {
  const made = await b.acceptRooms(rows.map(({ polygon, name, kind }) => ({ polygon, name, kind })), replaceAuto, created.map((c) => c.id));
  keep(made);
  const failed: string[] = [];
  let first: unknown = null;
  for (let i = 0; i < made.length; i++) {
    try {
      await b.tagRoom(made[i], rows[i]?.tags ?? [], rows[i]?.areaId ?? null);
    } catch (err) {
      failed.push(rows[i]?.name ?? made[i].id);
      first ??= err;
    }
  }
  if (failed.length) {
    throw new Error(tr('החדרים נשמרו, אבל {n} מהם נשארו בלי סוג או קישור לאזור ({names}): {error}. שמירה נוספת תחליף אותם, בלי כפילות.', {
      n: failed.length, names: failed.join(', '), error: describeError(first),
    }));
  }
}

/**
 * The area a typed room name links to: the first area of exactly that name. MH2-04: when the floor's building is known, only an area of
 * that building or of no building yet (`building_id` null / absent, the server's building cut) - another building's area of the same
 * name is never linked (an installation-wide editor would move it silently; a building-scoped one is refused).
 */
export function areaOfName(areas: readonly { area_id: string; name: string; building_id?: string | null }[], name: string, building: string | null): string | null {
  const n = name.trim();
  if (!n) return null;
  return areas.find((a) => a.name === n && (!building || !a.building_id || a.building_id === building))?.area_id ?? null;
}

/** MH2-04: the area of that exact name that belongs to ANOTHER building (for the room field's hint), or null. */
export function otherBuildingArea<A extends { name: string; building_id?: string | null }>(areas: readonly A[], name: string, building: string | null): A | null {
  const n = name.trim();
  if (!n || !building) return null;
  return areas.find((a) => a.name === n && !!a.building_id && a.building_id !== building) ?? null;
}
