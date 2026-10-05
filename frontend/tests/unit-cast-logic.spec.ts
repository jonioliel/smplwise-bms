import { test, expect } from '@playwright/test';
import type { CastSession, CastTarget } from '../src/api/cast';
import {
  BLOCKED_TEXT, canExtend, castButtonVisible, extendLimitReached, groupTargets, isLow, leftText, needsConfirm, notReadyText, openSessions, pickerPresentation,
  pillLabel, powerOffOffered, refusedText, targetLine,
} from '../src/screens/cast-logic';
import { t } from '../src/i18n/he';

// CR-028 (CAST1 UI): the pure rules of the cast screens (src/screens/cast-logic.ts) - words, grouping, countdown, which controls exist. No browser page.

const T0 = Date.parse('2026-10-05T12:00:00Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const tg = (key: string, over: Partial<CastTarget> = {}): CastTarget => ({ key, name: key, kind: 'screen', floor_id: 'f0', floor_name: 'קרקע', area_name: 'סלון', state: 'free', blocked: null, confidence: 'confirmed', permanent_allowed: false, minutes: 30, main_allowed: false, casting_session_id: null, ...over });
const ss = (over: Partial<CastSession> = {}): CastSession => ({
  session_id: 's1', device_key: 'tv', screen_name: 'סלון', floor_name: null, area_name: null, kind: 'camera', camera_id: 'c1', camera_name: 'לובי', profile: 'sub', state: 'playing', started_at: at(0), expires_at: at(27 * 60_000 + 24_000),
  permanent: false, extended_n: 0, extensions_left: 8, first_segment_at: at(1000), started_by_name: 'דנה', mine: true, channel: 'local', stopped_at: null, stop_reason: null, power_off_after: false, power_off_state: null,
  can: { stop: true, extend: true, switch: true }, ...over,
});

test.describe('the cast words', () => {
  test('a blocked screen says why, an unblocked one says its state; the casting line names the camera', () => {
    expect(targetLine(tg('a', { blocked: 'not_allowed' }))).toBe(BLOCKED_TEXT.not_allowed);
    expect(targetLine(tg('a', { blocked: 'public' }))).toContain('ציבורי');
    expect(targetLine(tg('a'))).toBe('פנוי');
    expect(targetLine(tg('a', { state: 'off' }))).toBe('כבוי');
    expect(targetLine(tg('a', { state: 'playing_music' }))).toBe('מנגן מוזיקה');
    expect(targetLine(tg('a', { state: 'casting' }), ss({ camera_name: 'חניה' }))).toBe('משדר: חניה');
    expect(targetLine(tg('a', { state: 'casting' }), null)).toBe('משדר');
  });

  test('operator copy never names the technology or the platform', () => {
    const all = [...Object.values(BLOCKED_TEXT), notReadyText(null, false), t('cast.button'), t('cast.pickerTitle'), t('cast.mine'), t('cast.confirmBusy'), t('cast.stopOff'), t('cast.remoteNote'), t('cast.empty')].join(' ');
    for (const word of ['Cast', 'Chromecast', 'Home Assistant', 'HA ', 'Ingress', 'relay', 'DLNA']) expect(all).not.toContain(word);
  });

  test('a refused start (HTTP 200) maps the known codes and falls back to a calm sentence', () => {
    expect(refusedText('cast_unsupported')).toContain('לא יכול לקבל שידור');
    expect(refusedText('refused:unavailable')).toBe('המסך לא זמין.');
    expect(refusedText('weird_code')).toContain('סירב');
    expect(refusedText(null)).toContain('סירב');
  });

  test('the administrator learns where to fix a not-ready state; an operator only that it is unavailable', () => {
    expect(notReadyText('relay_off', true)).toBe(t('cast.notReadyAdmin'));
    expect(notReadyText('relay_off', false)).toBe(t('cast.notReady'));
  });
});

test.describe('the countdown', () => {
  test('mm:ss under an hour, h:mm:ss above, "קבוע" for a permanent cast', () => {
    expect(leftText(ss(), T0)).toBe('27:24');
    expect(leftText(ss({ expires_at: at(3_600_000 + 5 * 60_000) }), T0)).toBe('1:05:00');
    expect(leftText(ss({ expires_at: at(9_000) }), T0)).toBe('0:09');
    expect(leftText(ss({ expires_at: at(-5000) }), T0)).toBe('0:00');
    expect(leftText(ss({ permanent: true, expires_at: null }), T0)).toBe('קבוע');
  });

  test('it turns to a warning under five minutes and never for a permanent cast', () => {
    expect(isLow(ss({ expires_at: at(4 * 60_000) }), T0)).toBe(true);
    expect(isLow(ss({ expires_at: at(6 * 60_000) }), T0)).toBe(false);
    expect(isLow(ss({ permanent: true, expires_at: null }), T0)).toBe(false);
  });
});

test.describe('sessions and the pill', () => {
  test('open sessions: mine first, then the soonest to end; a stopped one is dropped', () => {
    const list = [ss({ session_id: 'a', mine: false, expires_at: at(60_000) }), ss({ session_id: 'b', expires_at: at(20 * 60_000) }), ss({ session_id: 'c', expires_at: at(5 * 60_000) }), ss({ session_id: 'd', state: 'stopped' }), ss({ session_id: 'e', permanent: true, expires_at: null })];
    expect(openSessions(list).map((x) => x.session_id)).toEqual(['c', 'b', 'e', 'a']);
  });

  test('the pill names the screen and the time for one cast, the count for several', () => {
    expect(pillLabel([], T0)).toBe('');
    expect(pillLabel([ss()], T0)).toBe('משדר · סלון · 27:24');
    expect(pillLabel([ss(), ss({ session_id: 's2' })], T0)).toBe('משדר 2');
  });

  test('extend: up to the server limit; never a permanent or a test cast; at the limit the control says why', () => {
    expect(canExtend(ss())).toBe(true);
    expect(canExtend(ss({ extensions_left: 0 }))).toBe(false);
    expect(extendLimitReached(ss({ extensions_left: 0 }))).toBe(true);
    expect(canExtend(ss({ permanent: true, expires_at: null }))).toBe(false);
    expect(canExtend(ss({ kind: 'test' }))).toBe(false);
    expect(canExtend(ss({ can: { stop: true, extend: false, switch: false } }))).toBe(false);
    expect(extendLimitReached(ss({ can: { stop: true, extend: false, switch: false }, extensions_left: 0 }))).toBe(false);
  });

  test('power-off is offered only for a session that carries the rule', () => {
    expect(powerOffOffered(ss({ power_off_after: true }))).toBe(true);
    expect(powerOffOffered(ss())).toBe(false);
  });
});

test.describe('the picker', () => {
  test('groups by floor (the screens without one last), blocked screens after the free ones in each floor', () => {
    const g = groupTargets([tg('b', { floor_name: 'קומה א', name: 'ב' }), tg('a', { floor_name: 'קרקע', name: 'א', blocked: 'not_allowed' }), tg('z', { floor_name: 'קרקע', name: 'ז' }), tg('n', { floor_name: null, name: 'נ' })], []);
    expect(g.map((x) => x.title)).toEqual(['קומה א', 'קרקע', t('cast.noFloor')]);
    expect(g[1].targets.map((x) => x.key)).toEqual(['z', 'a']);
  });

  test('"לאחרונה" appears first only with more than four screens, lists the free recent ones once, and removes them from their floor', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((k) => tg(k, { name: k }));
    const g = groupTargets(many, ['c', 'zz', 'a']);
    expect(g[0].id).toBe('recent');
    expect(g[0].targets.map((x) => x.key)).toEqual(['c', 'a']);
    expect(g[1].targets.map((x) => x.key)).toEqual(['b', 'd', 'e']);
    expect(groupTargets(many.slice(0, 3), ['a'])[0].id).not.toBe('recent');
    expect(groupTargets(many, ['c']).flatMap((x) => x.targets).length).toBe(5);
  });

  test('a screen playing music needs a confirmation; a blocked or unavailable one cannot be picked', () => {
    expect(needsConfirm(tg('a', { state: 'playing_music' }))).toBe(true);
    expect(needsConfirm(tg('a'))).toBe(false);
  });

  test('the button exists only for a caster on a backend with something to list, and not while casting is not ready', () => {
    expect(castButtonVisible({ api: true, hasCast: true, targets: 2, ready: true })).toBe(true);
    expect(castButtonVisible({ api: false, hasCast: true, targets: 2, ready: true })).toBe(false);
    expect(castButtonVisible({ api: true, hasCast: false, targets: 2, ready: true })).toBe(false);
    expect(castButtonVisible({ api: true, hasCast: true, targets: 0, ready: true })).toBe(false);
    expect(castButtonVisible({ api: true, hasCast: true, targets: null, ready: null })).toBe(false);
    expect(castButtonVisible({ api: true, hasCast: true, targets: 2, ready: false })).toBe(false);
  });

  test('presentation: a panel on a wide screen; on the phone the list by default and the sheet only when the owner chose it', () => {
    expect(pickerPresentation({ phone: false, ddPhone: 'sheet' })).toBe('panel');
    expect(pickerPresentation({ phone: true, ddPhone: undefined })).toBe('list');
    expect(pickerPresentation({ phone: true, ddPhone: null })).toBe('list');
    expect(pickerPresentation({ phone: true, ddPhone: 'list' })).toBe('list');
    expect(pickerPresentation({ phone: true, ddPhone: 'sheet' })).toBe('sheet');
  });
});
