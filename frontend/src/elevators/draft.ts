/**
 * CR-INFRA-ELEVATORS: the add / edit dialog's draft, pure (unit-tested): from a managed elevator, to the request body, and the client-side
 * check that mirrors the server's first refusals (a name, at least one sensor, no sensor twice, at most four extras with labels). The server
 * repeats every check and also verifies the sensors exist and are visible to the setter.
 */
import { ELEVATOR_ROLES, MAX_EXTRAS, type ElevatorBody, type ElevatorRole, type ManagedElevator } from '../api/elevators';

export interface Draft {
  id: string | null;
  name: string;
  enabled: boolean;
  sensors: Record<ElevatorRole, string>;
  extras: { entity_id: string; label: string }[];
  revision?: number;
}

export type DraftProblem = 'name' | 'no_sensor' | 'duplicate_sensor' | 'too_many_extras' | 'extra_label' | null;

const emptySensors = (): Record<ElevatorRole, string> => Object.fromEntries(ELEVATOR_ROLES.map((r) => [r, ''])) as Record<ElevatorRole, string>;

export function newDraft(): Draft {
  return { id: null, name: '', enabled: true, sensors: emptySensors(), extras: [] };
}

export function draftOf(e: ManagedElevator): Draft {
  const sensors = emptySensors();
  for (const r of ELEVATOR_ROLES) sensors[r] = e.sensors[r]?.entity_id ?? '';
  return { id: e.id, name: e.name, enabled: e.enabled, sensors, extras: e.extras.map((x) => ({ entity_id: x.entity_id, label: x.label })), revision: e.revision };
}

export function problemOf(d: Draft): DraftProblem {
  if (!d.name.trim()) return 'name';
  if (d.extras.length > MAX_EXTRAS) return 'too_many_extras';
  if (d.extras.some((x) => x.entity_id && !x.label.trim())) return 'extra_label';
  const ids = [...ELEVATOR_ROLES.map((r) => d.sensors[r]), ...d.extras.map((x) => x.entity_id)].filter(Boolean);
  if (!ids.length) return 'no_sensor';
  if (new Set(ids).size !== ids.length) return 'duplicate_sensor';
  return null;
}

export function bodyOf(d: Draft): ElevatorBody {
  const sensors: Partial<Record<ElevatorRole, string | null>> = {};
  for (const r of ELEVATOR_ROLES) if (d.sensors[r]) sensors[r] = d.sensors[r];
  return {
    name: d.name.trim(), enabled: d.enabled, sensors,
    extras: d.extras.filter((x) => x.entity_id).map((x) => ({ entity_id: x.entity_id, label: x.label.trim() })),
    ...(d.revision !== undefined ? { revision: d.revision } : {}),
  };
}

/** The order after moving one elevator a step up (-1) or down (+1); unchanged at the edges. */
export function moved(ids: readonly string[], id: string, step: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
