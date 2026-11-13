// The dense floor of the evidence: the perf spec's generated 20 x 14 m house (4 x 3 rooms a level, furniture, lamps, doors).
import { buildScene } from 'C:/cloude/smplwise-furnmerge/frontend/src/map/scene-builder';
import { lookup3dOf, lookupMaterialsOf } from 'C:/cloude/smplwise-furnmerge/frontend/src/api/plan-catalog';
import { houseDoc } from 'C:/cloude/smplwise-furnmerge/frontend/tests/perf-3d-mocks';
import { houseCatalog } from 'C:/cloude/smplwise-furnmerge/frontend/tests/lookdev/house';

export function denseDesc(level: string | null) {
  const lib = houseCatalog();
  return buildScene({ doc: houseDoc(), width: 2000, height: 1400, anchors: [], entityStates: {}, circuitStates: {}, catalog: lookup3dOf(lib), materialsCatalog: lookupMaterialsOf(lib), level, walk: false, realistic: true } as any);
}
