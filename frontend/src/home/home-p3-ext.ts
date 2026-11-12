// RELEASE-2430-TRAIN: phase 3 (HOME-V3-P3-2432, media + systems) joins phase 1's extension point (HOME-V3-P1-2430). Phase 3 was
// written before the registry existed; this one file is the adapter its change record describes: its screens go through
// registerScreen, and every entry of `p3.tiles()` becomes a tile of the "עוד בבית" hub (order 100+, shown only while `tiles()`
// offers it, so a switched-off capability or a missing permission keeps it out of the hub).
import { registerScreen, type HomeHost } from './home-ext';
import { registerMoreTile } from './more-registry';
import { P3_SCREENS } from './home-p3-logic';
import type { HubTile } from './home-p3';

registerScreen((h: HomeHost) => ({
  id: 'p3',
  names: [...P3_SCREENS],
  render: (n: string) => h.p3.screen(n),
  // the bill and water open from the electricity screen; the rest from the hub
  back: (n: string) => (n === 'bills' || n === 'water' ? 'energy' : 'more'),
  navCur: () => 'more',
}));

const tile = (h: HomeHost, id: HubTile['id']): HubTile | undefined => h.p3.tiles().find((t) => t.id === id);

const HUB: [HubTile['id'], string, string, string][] = [
  ['media', 'media', 'מוזיקה ומסכים', 'music'],
  ['announce', 'media', 'כריזה בבית', 'horn'],
  ['bills', 'bills', 'חשבון חשמל', 'bill'],
  ['water', 'water', 'מים', 'drop'],
  ['systems', 'systems', 'מערכות הבית', 'gen'],
  ['map', 'map', 'מפת הבית', 'map'],
];

HUB.forEach(([id, href, label, icon], i) =>
  registerMoreTile({
    id: 'p3-' + id,
    order: 100 + i * 10,
    href,
    label,
    icon,
    visible: (h) => tile(h, id) != null,
    act: (h) => tile(h, id)?.act,
    line: (h) => {
      const t = tile(h, id);
      return { text: t?.line ?? '', tone: t?.tone || undefined, badge: t?.badge || undefined };
    },
  }),
);
