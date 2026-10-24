import { test, expect } from '@playwright/test';
import { SEARCH_MODES, parseSearchRoles, searchModeOf, toggleSearchRole } from '../src/api/search-access';

// TOPPILL-295: the pill's search is off by default; the settings row reads and writes it through these helpers. No browser page.

test('the stored mode is off unless it is a known mode', () => {
  expect(searchModeOf(undefined)).toBe('off');
  expect(searchModeOf('')).toBe('off');
  expect(searchModeOf('sometimes')).toBe('off');
  for (const m of SEARCH_MODES) expect(searchModeOf(m)).toBe(m);
});

test('role ids are read from the comma list without blanks or repeats, and toggled', () => {
  expect(parseSearchRoles(undefined)).toEqual([]);
  expect(parseSearchRoles(' operator, ,viewer,operator')).toEqual(['operator', 'viewer']);
  expect(toggleSearchRole(['operator'], 'viewer', true)).toEqual(['operator', 'viewer']);
  expect(toggleSearchRole(['operator', 'viewer'], 'operator', false)).toEqual(['viewer']);
  expect(toggleSearchRole([], 'viewer', false)).toEqual([]);
});
