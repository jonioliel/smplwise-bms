// MULTI-BUILDING-NEXT-2500 (T119 MB-LOBBY-BOARD step 3): the notice editor's audience shortcut on a multi-building site - "כל מגדל א" picks
// (or clears) every floor of that building in the "לפי מקום" audience. Pure (tests/unit-mb-next-2500.spec.ts). A shortcut only: the audience
// is still the list of floors the server checks against the writer's scope (an out-of-scope floor is refused as before).

export interface AudienceFloor { id: string; name: string; building: string }

/** The buildings of the floors, in the floors' order ([] / one building = no shortcut row). */
export function audienceBuildings(floors: readonly AudienceFloor[]): string[] {
  return [...new Set(floors.map((f) => f.building).filter(Boolean))];
}

/** Whether every floor of the building is in the audience ('all'), some of them ('some') or none ('none'). */
export function buildingState(floors: readonly AudienceFloor[], selected: readonly string[], building: string): 'all' | 'some' | 'none' {
  const ids = floors.filter((f) => f.building === building).map((f) => f.id);
  const n = ids.filter((id) => selected.includes(id)).length;
  return !ids.length || n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
}

/** One press on the building's key: all its floors in when they were not all in, else all of them out. Other floors stay as they were. */
export function toggleBuilding(floors: readonly AudienceFloor[], selected: readonly string[], building: string): string[] {
  const ids = floors.filter((f) => f.building === building).map((f) => f.id);
  if (buildingState(floors, selected, building) === 'all') return selected.filter((id) => !ids.includes(id));
  return [...selected, ...ids.filter((id) => !selected.includes(id))];
}
