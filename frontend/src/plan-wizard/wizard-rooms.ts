// FIX-MAPS2-2570 (deep review 2.57 MH2-01, MH2-04): the rooms step's save, out of plan-wizard.ts so it runs in node
// (tests/unit-fix-maps2-2570.spec.ts). Pure: the wizard hands in its backend calls and keeps the rooms it is told about.
import type { ZoneKind } from '../api/zones';
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
 */
export async function saveWizardRooms(b: RoomsSaveBackend, rows: RoomToSave[], replaceAuto: boolean, created: readonly CreatedRoom[], keep: (made: CreatedRoom[]) => void): Promise<void> {
  const made = await b.acceptRooms(rows.map(({ polygon, name, kind }) => ({ polygon, name, kind })), replaceAuto, created.map((c) => c.id));
  for (let i = 0; i < made.length; i++) await b.tagRoom(made[i], rows[i]?.tags ?? [], rows[i]?.areaId ?? null);
  keep(made);
}

/** The area a typed room name links to: the first area of exactly that name. */
export function areaOfName(areas: readonly { area_id: string; name: string; building_id?: string | null }[], name: string, _building: string | null): string | null {
  const n = name.trim();
  return n ? (areas.find((a) => a.name === n)?.area_id ?? null) : null;
}
