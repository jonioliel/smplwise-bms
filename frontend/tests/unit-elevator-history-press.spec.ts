import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LONG_PRESS_MS as DEVICE_MS } from '../src/components/device-activity-press';
import { LONG_PRESS_MS, elevatorIdOf, type PressNode } from '../src/elevators/history-press';
import { durationText, historyRows } from '../src/elevators/model';

// 2.9.0: long press on an elevator card opens its history, same gesture as the devices screen. Pure parts + source guards, no browser.

const node = (tagName: string, attrs: Record<string, string> = {}): PressNode => ({ tagName, getAttribute: (n) => attrs[n] ?? null });
const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

test('same hold time as the devices screen', () => {
  expect(LONG_PRESS_MS).toBe(DEVICE_MS);
  expect(LONG_PRESS_MS).toBe(500);
});

test('the card is found in the path; a link or button between pointer and card blocks it', () => {
  expect(elevatorIdOf([node('span'), node('div'), node('article', { 'data-elevator': 'e1' }), node('div')])).toBe('e1');
  expect(elevatorIdOf([node('button'), node('article', { 'data-elevator': 'e1' })])).toBeNull();
  expect(elevatorIdOf([node('a'), node('article', { 'data-elevator': 'e1' })])).toBeNull();
  expect(elevatorIdOf([node('div'), node('div')])).toBeNull();
});

test('history rows: newest first, clipped to 24 hours, zero-length dropped', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const h = (iso: string) => new Date(now - Number(iso) * 3600_000).toISOString();
  const rows = historyRows(
    [
      { state: 'waiting', from: h('30'), to: h('10') },
      { state: 'fault', from: h('10'), to: h('9') },
      { state: 'waiting', from: h('9'), to: h('9') },
      { state: 'waiting', from: h('9'), to: h('0') },
    ],
    now,
  );
  expect(rows.map((r) => r.state)).toEqual(['waiting', 'fault', 'waiting']);
  expect(rows[0].minutes).toBe(9 * 60);
  expect(rows[2].minutes).toBe(14 * 60); // clipped from 30 h to the 24 h window
  expect(historyRows(null, now)).toEqual([]);
});

test('duration text', () => {
  expect(durationText(45)).toBe('45 דק׳');
  expect(durationText(180)).toBe('3 שע׳');
  expect(durationText(130)).toBe('2 שע׳ 10 דק׳');
});

test('the screen wires the controller, a visible button alternative, and no text selection / touch callout on the card', () => {
  const src = readFileSync(join(SRC, 'screens/infra-elevators.ts'), 'utf8');
  expect(src).toContain('new ElevatorHistoryPress(this');
  expect(src).toContain('data-elevator-history');
  expect(src).toContain('tabindex="0" data-elevator=');
  expect(src).toContain('-webkit-touch-callout: none');
  expect(src).toContain('user-select: none');
  const ctl = readFileSync(join(SRC, 'elevators/history-press.ts'), 'utf8');
  for (const s of ['contextmenu', 'pointercancel', "'ContextMenu'", 'altKey', 'swallowUntil']) expect(ctl).toContain(s);
});
