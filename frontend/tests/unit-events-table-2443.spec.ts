import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { sevKind } from '../src/screens/investigate-events-logic';

// CR-EVENTS-TABLE-2443 (code review 06:EVT-3, 06:INFILE-1 severity badge; owner decision O17 = a, lead decision L13;
// docs/changes/CR-EVENTS-TABLE-2443.md). Node only: the one severity mapping, and the event centre's source pinned so that the
// review-window table styles its cells inline (sw-table renders them in its own shadow root, where the screen's stylesheet never reaches).
const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const src = code('screens/investigate-events.ts');
const between = (a: string, b: string) => {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i + 1);
  expect(i, a).toBeGreaterThanOrEqual(0);
  expect(j, b).toBeGreaterThan(i);
  return src.slice(i, j);
};

test('L13: one severity mapping - critical is an error (red), alert is stale, information and anything unknown is neutral', () => {
  expect(sevKind('critical')).toBe('error');
  expect(sevKind('alert')).toBe('stale');
  expect(sevKind('info')).toBe('neutral');
  expect(sevKind('')).toBe('neutral');
  expect(sevKind('bogus')).toBe('neutral');
});

test('06:INFILE-1: every severity badge of the screen goes through sevBadge; the review-window drawer no longer paints critical as "offline"', () => {
  // the only inline <sw-badge> carrying a severity is the helper itself
  const helper = between('function sevBadge(', '\n}');
  expect(helper).toContain('kind=${sevKind(sev)}');
  expect(src.replace(helper, '')).not.toMatch(/severity === 'critical' \?/);
  expect(src).not.toMatch(/'critical' \? 'offline'/);
  expect(between('private renderWindowDrawer(', 'private onPushed(')).toContain('${sevBadge(w.severity)}');
  expect(between('private renderEventDrawer(', '<div class="big">')).toContain('${sevBadge(ev.severity)}');
  expect(between('private apiColumns: TableColumn[] = [', '];')).toContain('sevBadge(String(r.severity))');
  // the demo table keeps its look (every severity a filled field): its baseline does not move
  expect(between('private columns: TableColumn[] = [', '];')).toContain('sevBadge(String(r.severity), true)');
});

test('06:EVT-3: the review-window columns carry their styles inline - no class the shadow root cannot see', () => {
  const cols = between('private windowColumns: TableColumn[] = [', '];');
  for (const cls of ['ty', 'sub', 'spot']) expect(cols, `class="${cls}"`).not.toContain(`class="${cls}"`);
  expect(cols).toContain('style=${C_TITLE}');
  expect(cols).toContain('${C_DOT}${EVENT_TONE[w.dominant_type]');
  expect(cols).toContain('style=${C_SPOT} data-window-spotlight');
  expect(cols).toContain('style=${C_SUB} data-window-manual');
  expect(cols).toContain('style=${C_TIME}');
  // the window picture is as big as its placeholder (was 64x40 next to an 88x56 box)
  const thumb = between('private renderWindowThumb(', 'private renderWindowDrawer(');
  expect(thumb.match(/C_WTHUMB/g)?.length).toBe(2);
  expect(thumb).not.toContain('64px');
});

test('06:EVT-3: the dead .thumb rules are gone from the screen stylesheet', () => {
  const styles = between('static styles = [', '`, bubbleChrome');
  expect(styles).not.toMatch(/\.thumb[\s.{,]/);
  expect(styles).not.toMatch(/sw-scene\.thumb/);
  expect(styles).not.toMatch(/@keyframes shimmer/);
});
