/**
 * MAPPING-ASSIST-2330: the mapping assistant's demo data (the static demo, `?mb=1`) - the synthetic home-system tree of the approved mockup
 * (round 10 mapping v3, mapping3.js): four buildings and "משותף", the floors named "א · קומה 1", the areas "א · לובי 1", and the messy
 * cases on purpose ("ג-גג", "ד : קומה 2" without a level, "מ · חדר חשמל ראשי", "ה · קומה 1" of a building that does not exist, names
 * without a mark, a name whose mark disagrees with its floor or label). Deterministic: the same names on every run.
 */
import type { BuildingRef, MapItem, OurFloor } from './mapping-engine';

export interface DemoMapping {
  items: MapItem[];
  buildings: (BuildingRef & { code: string })[];
  floors: OurFloor[];
}

const POOL = ['לובי', 'משרדים', 'חדר ישיבות', 'מטבחון', 'פרוזדור', 'מחסן', 'חדר מכונות', 'ארכיון', 'חדר שרתים', 'חדר דיירים', 'שירותים', 'חדר כושר', 'מרפסת', 'חדר ועד', 'מעבדה'];
const OURS: { id: string; code: string; name: string; shared?: boolean; floors: [string, number][] }[] = [
  { id: 'bA', code: 'א', name: 'בניין א', floors: [['קומה -1', -1], ['קרקע', 0], ['קומה 1', 1], ['קומה 2', 2], ['קומה 3', 3], ['קומה 4', 4], ['קומה 5', 5], ['קומה 6', 6]] },
  { id: 'bB', code: 'ב', name: 'בניין ב', floors: [['קרקע', 0], ['קומה 1', 1], ['קומה 2', 2], ['קומה 3', 3], ['קומה 4', 4], ['קומה 5', 5]] },
  { id: 'bC', code: 'ג', name: 'בניין ג', floors: [['קרקע', 0], ['קומה 1', 1], ['קומה 2', 2], ['קומה 3', 3], ['גג', 4]] },
  { id: 'bD', code: 'ד', name: 'בניין ד', floors: [['קרקע', 0], ['קומה 1', 1], ['קומה 2', 2]] },
  { id: 'bS', code: 'משותף', name: 'משותף', shared: true, floors: [['חניון -2', -2], ['חניון -1', -1], ['קרקע', 0]] },
];

export function demoMapping(): DemoMapping {
  const items: MapItem[] = [];
  let fid = 0;
  let aid = 0;
  let pi = 0;
  const floor = (name: string, level: number | null) => {
    const it: MapItem = { id: `hf${++fid}`, kind: 'floor', name, level };
    items.push(it);
    return it;
  };
  const area = (name: string, f: MapItem | null, labels: string[] = []) => items.push({ id: `ha${++aid}`, kind: 'area', name, floorId: f?.id ?? null, labels });
  const next = (pref: string, sep: string, tag: string) => `${pref}${sep}${POOL[pi++ % POOL.length]}${tag ? ' ' + tag : ''}`;
  const levelName = (lv: number) => (lv === 0 ? 'קרקע' : `קומה ${lv}`);
  const plan: Record<string, number[]> = { א: [-1, 0, 1, 2, 3, 4, 5, 6], ב: [0, 1, 2, 3, 4, 5], ג: [0, 1, 2, 3], ד: [0, 1] };
  const byName = new Map<string, MapItem>();
  for (const code of Object.keys(plan)) {
    for (const lv of plan[code]) {
      const f = floor(`${code} · ${levelName(lv)}`, lv);
      byName.set(f.name, f);
      const n = 5 + ((lv + 7) % 2);
      for (let i = 0; i < n; i++) area(next(code, ' · ', lv === 0 ? '' : String(lv)), f, [`בניין ${code}`]);
    }
  }
  const gRoof = floor('ג-גג', 4);
  for (let i = 0; i < 3; i++) area(next('ג', '-', 'גג'), gRoof, ['בניין ג']);
  const d2 = floor('ד : קומה 2', null);
  for (let i = 0; i < 4; i++) area(next('ד', ' : ', '2'), d2);
  const sh1 = floor('משותף · חניון -1', -1);
  for (let i = 0; i < 4; i++) area(next('משותף', ' · ', '-1'), sh1, ['משותף']);
  const sh2 = floor('משותף · חניון -2', -2);
  for (let i = 0; i < 3; i++) area(next('משותף', ' · ', '-2'), sh2, ['משותף']);
  const sh3 = floor('מ · חדר חשמל ראשי', 0);
  area('מ · חדר חשמל ראשי', sh3, ['משותף']);
  area('מ · גנרטור', sh3, ['משותף']);
  const sh4 = floor('משותף · גינה ושער', 0);
  area('משותף · גינה', sh4, ['משותף']);
  area('משותף · שער ראשי', sh4, ['משותף']);
  area('משותף · עמדת שומר', sh4);
  const fE = floor('ה · קומה 1', 1);
  area('ה · לובי', fE);
  area('ה · משרדים', fE);
  const fT = floor('קומה טכנית', 9);
  area('מכונות מעלית', fT);
  area('מאגר מים', fT);
  const fA0 = byName.get('א · קרקע')!;
  const fB2 = byName.get('ב · קומה 2')!;
  const fA1 = byName.get('א · קומה 1')!;
  const fAm1 = byName.get('א · קומה -1')!;
  area('חדר אשפה', fA0); // no mark, the floor says א -> by its floor
  area('ג · חדר ישיבות גדול', fB2, ['בניין ב']); // mark ג on a floor of ב -> a question
  area('א · חדר דיירים ב', fA1, ['בניין ב']); // mark א, label ב -> a question
  area('א-מחסן כללי', fA0); // "-" separator on an area
  area('א · חדר אשפה חיצוני', null); // no floor, mark א
  area('מחסן אופניים', null); // no floor, no mark, no label
  area('משאבות מים', null, ['משותף']); // no floor, no mark, a label
  area('א · חניון אופניים', fAm1, ['בניין א']);
  const floors: OurFloor[] = OURS.flatMap((b) => b.floors.map(([name, level], i) => ({ id: `${b.id}_f${i}`, building_id: b.id, name, level })));
  return { items, buildings: OURS.map((b) => ({ id: b.id, name: b.name, shared: b.shared, code: b.code })), floors };
}
