import { test, expect } from '@playwright/test';
import { infraPagesAsChip, infraPagesChip } from '../src/shell/infra-pages';
import { DD_PLACE_DECLINED } from '../src/shell/dd-place-fit';
import { HYBRID_MAX_ITEMS } from '../src/shell/tabs-mode';

// 2.9.2 (owner 2026-10-20): the infrastructure page rows (generator, electricity meters) follow the tab presentation mode and, in the
// dropdown form, become the shell's second chip (shell/tab-pair.ts) beside the area's chip. Plain data, no browser page.

test.describe('infrastructure page row as a dropdown chip (pure)', () => {
  test('tabs mode keeps the row; dropdown always turns it into the chip; hybrid only above HYBRID_MAX_ITEMS', () => {
    expect(infraPagesAsChip('tabs', 4)).toBe(false);
    expect(infraPagesAsChip('dropdown', 4)).toBe(true);
    expect(infraPagesAsChip('dropdown', 2)).toBe(true);
    expect(infraPagesAsChip('hybrid', HYBRID_MAX_ITEMS)).toBe(false);
    expect(infraPagesAsChip('hybrid', HYBRID_MAX_ITEMS + 1)).toBe(true);
  });

  test('a row of one page is never a chip', () => {
    for (const m of ['tabs', 'hybrid', 'dropdown'] as const) expect(infraPagesAsChip(m, 1)).toBe(false);
    expect(infraPagesAsChip('dropdown', 0)).toBe(false);
  });

  test('the chip carries the pages, the active page and the count; it belongs to the area group', () => {
    const picked: string[] = [];
    const chip = infraPagesChip('עמודים', [
      { id: 'live', label: 'מצב חי', href: '#/infra/generator/live' },
      { id: 'alerts', label: 'התראות פעילות', href: '#/infra/generator/alerts', count: 3 },
      { id: 'charts', label: 'גרפים', href: '#/infra/generator/charts' },
    ], 'charts', (id) => picked.push(id));
    expect(chip.group).toBe('area');
    expect(chip.label).toBe('עמודים');
    expect(chip.value).toBe('charts');
    expect(chip.items).toEqual([
      { id: 'live', label: 'מצב חי' },
      { id: 'alerts', label: 'התראות פעילות', count: 3 },
      { id: 'charts', label: 'גרפים' },
    ]);
    chip.onPick('live');
    expect(picked).toEqual(['live']);
  });

  test('infrastructure declines the title-row placements up front (no measured fallback, no jump)', () => {
    expect(DD_PLACE_DECLINED.infra).toEqual(['2', '3', '4']);
  });
});
