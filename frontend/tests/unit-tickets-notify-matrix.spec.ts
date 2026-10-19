import { test, expect } from '@playwright/test';
import { cycleMode, matrixOf, setCell, type NotifyMatrix } from '../src/tickets/notify-matrix-model';

// TKNOTIFMATRIX: the pure model of the notification matrix screen. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-notify-matrix.spec.ts

test('a missing cell is "now"; the department wins over "*"', () => {
  const m: NotifyMatrix = { '*': { 'ticket.done': 'off' }, d1: { 'ticket.done': 'now', 'ticket.stuck': 'digest' } };
  expect(matrixOf({}, 'd1', 'ticket.done')).toBe('now');
  expect(matrixOf(m, 'd2', 'ticket.done')).toBe('off');
  expect(matrixOf(m, 'd1', 'ticket.done')).toBe('now');
  expect(matrixOf(m, 'd1', 'ticket.stuck')).toBe('digest');
  expect(matrixOf(m, '*', 'ticket.stuck')).toBe('now');
});

test('setCell does not mutate, drops empty rows, and keeps "now" only as a department override', () => {
  const m: NotifyMatrix = { '*': { 'ticket.done': 'off' } };
  const a = setCell(m, 'd1', 'ticket.done', 'now');
  expect(a).toEqual({ '*': { 'ticket.done': 'off' }, d1: { 'ticket.done': 'now' } });
  expect(m).toEqual({ '*': { 'ticket.done': 'off' } });
  expect(setCell(m, '*', 'ticket.done', 'now')).toEqual({});
  expect(setCell(a, 'd1', 'ticket.done', null)).toEqual(m);
});

test('clicking the selected mode clears the cell', () => {
  expect(cycleMode('off', 'off')).toBeNull();
  expect(cycleMode('now', 'digest')).toBe('digest');
});
