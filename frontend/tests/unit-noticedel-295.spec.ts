import { test, expect } from '@playwright/test';
import type { Notice } from '../src/api/notices';
import { canConfirmDelete, canDeleteRow, isLive, isUrgentLive } from '../src/notices/delete-model';
import { kpiCounts, listRows } from '../src/notices/model';
import { PLACE_ALL, buildPlaces } from '../src/notices/places-model';
import { NT_KEYS, nt } from '../src/i18n/notices';

// NOTICEDEL-295: the delete dialog's rules, the list filter that can empty the table, the new strings. Node only.

const note = (id: string, o: Partial<Notice> = {}): Notice => ({
  id, title: 'הודעה ' + id, body: 'שורה', severity: 'info', starts_at: '2026-10-24T06:00:00Z', ends_at: null, pinned: false, state: 'active', dwell_s: null, when_text: null,
  published_at: null, updated_at: '2026-10-24T06:00:00Z', boards: [], read: true, audience: { everyone: true }, status: 'published', ...o,
});
const FLOORS = [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }, { id: 'f2', name: 'קומה 2', building: 'מבנה א' }];
const AREAS = [{ id: 'z1', name: 'לובי', floor: 'f1' }];
const base = { kpi: 'all' as const, seg: 'all' as const, q: '', manager: true, floors: FLOORS, areas: AREAS };

test('delete: only a notice on air needs the extra tick', () => {
  expect(isLive(note('a'))).toBe(true);
  for (const state of ['draft', 'scheduled', 'expired', 'archived'] as const) expect(isLive(note('a', { state }))).toBe(false);
  expect(isUrgentLive(note('a', { severity: 'critical' }))).toBe(true);
  expect(isUrgentLive(note('a', { severity: 'critical', state: 'expired' }))).toBe(false);
  expect(canConfirmDelete(note('a'), false, false)).toBe(false);
  expect(canConfirmDelete(note('a'), true, false)).toBe(true);
  expect(canConfirmDelete(note('a'), true, true)).toBe(false); // busy
  expect(canConfirmDelete(note('a', { state: 'expired' }), false, false)).toBe(true);
  expect(canConfirmDelete(null, true, false)).toBe(false);
});

test('delete: a draft is the writer\'s own, anything else needs notices.delete', () => {
  expect(canDeleteRow(note('a', { state: 'draft', status: 'draft' }), false)).toBe(true);
  expect(canDeleteRow(note('a'), false)).toBe(false);
  expect(canDeleteRow(note('a'), true)).toBe(true);
});

test('list: three active notices, an empty table - the place node narrows what the tile counts', () => {
  const all = [note('a'), note('b'), note('c')]; // all "for everyone": they belong to the whole building only
  expect(kpiCounts(all).all).toBe(3);
  expect(listRows(all, { ...base, place: PLACE_ALL }).length).toBe(3);
  const tree = buildPlaces(all, FLOORS, AREAS);
  expect(tree.find((p) => p.id === 'f:f1')?.count).toBe(0);
  expect(listRows(all, { ...base, place: 'f:f1' })).toEqual([]);
  // a tile, the search and the segment narrow it the same way
  expect(listRows(all, { ...base, place: PLACE_ALL, kpi: 'expired' })).toEqual([]);
  expect(listRows(all, { ...base, place: PLACE_ALL, q: 'אין כזה' })).toEqual([]);
  expect(listRows(all, { ...base, place: PLACE_ALL, seg: 'tv' })).toEqual([]);
});

test('strings: the new keys exist in he and en, with the notice named in the confirmation', () => {
  for (const k of ['delete', 'delTitle', 'delBody', 'delLiveTick', 'delUrgentTick', 'delConfirm', 'delDone', 'delRefused', 'noRows', 'clearFilters', 'dPlacesTree'] as const) {
    expect(NT_KEYS).toContain(k);
    expect(nt(k, { title: 'X' }, 'en')).not.toBe(nt(k, { title: 'X' }, 'he'));
  }
  expect(nt('delBody', { title: 'מים' }, 'he')).toContain('"מים"');
  expect(nt('delBody', { title: 'water' }, 'en')).toContain('cannot be undone');
});
