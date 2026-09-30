// Skin registry + the "current skin" the generator renders with. A skin = full token set (light + dark)
// + a bounded set of per-skin component rules + a few strings for the foundation boards.
import { skin as domus } from '../skins/domus.mjs';
import { skin as ios } from '../skins/ios.mjs';
import { skin as tesla } from '../skins/tesla.mjs';
import { flatten, diffCount, ruleCount } from './token-helpers.mjs';

export const skins = { domus, ios, tesla };
export const skinIds = Object.keys(skins);

let cur = domus;
export function setSkin(id) {
  if (!skins[id]) throw new Error(`unknown skin: ${id}`);
  cur = skins[id];
  return cur;
}
export const current = () => cur;
export const currentAll = () => flatten(cur.groups);

// Numbers for the report: tokens that differ from the base skin, and the rule count of each skin.
export function stats() {
  const total = Object.keys(flatten(domus.groups)).length;
  return skinIds.map((id) => ({ id, total, changed: id === 'domus' ? 0 : diffCount(domus.groups, skins[id].groups), rules: ruleCount(skins[id].rules) }));
}
