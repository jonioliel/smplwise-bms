/**
 * Plan Studio 6, slice S5-B (CR-030 section 4.2, docs/changes/CR-029-ST7-S5B-NOTES.md): one theme column for a subtree. The product's
 * tokens switch on the root (`:root[data-theme="dark"]`), so an element deep inside the page cannot ask for the other column - but a
 * wall display has its OWN theme (`theme: dark | light | follow`, CR-030), independent of the installation's scheme: a dark wall on a
 * light installation must not hold a light plan (a bright rectangle on a screen that runs all night). `themeScope` returns the
 * declarations of a skin's table in the wanted column, to be set as inline custom properties on the plan's wrapper: everything inside
 * (the 3D element's backdrop, the scene's colours it reads from the computed style, the stills) then reads that column. Pure.
 */
import { skinTable } from '../design/css';
import { DEFAULT_SKIN, isSkinId, type SkinId } from '../design/skins';

const cache = new Map<string, string>();

/** `--sw-name:value;...` for every token of the skin in one column. */
export function themeScope(theme: 'light' | 'dark', skin: SkinId): string {
  const key = `${skin}/${theme}`;
  let hit = cache.get(key);
  if (hit === undefined) {
    hit = Object.entries(skinTable(skin))
      .map(([name, v]) => `${name}:${v[theme]}`)
      .join(';');
    cache.set(key, hit);
  }
  return hit;
}

/** The skin in force on a page (`data-skin` of the root); the default skin when the attribute is missing or unknown. */
export function skinOf(root: { getAttribute(name: string): string | null }): SkinId {
  const v = root.getAttribute('data-skin');
  return isSkinId(v) ? v : DEFAULT_SKIN;
}
