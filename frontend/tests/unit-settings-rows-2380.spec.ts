import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PORTRAIT_CHIPS, SAFE_MARGINS, TVFIT_FACTORY, TV_FIT_KEYS, effectiveTvFit, tvFitDefaultsOf, tvFitOwn, tvFitText,
} from '../src/notices/display-fit-model';
import { nt } from '../src/i18n/notices';
import { VALUE_CHECK_DEFAULT, VALUE_CHECK_MODES, valueCheckOf } from '../src/api/presence';
import { pt } from '../src/i18n/presence';
import { QUIET_CHANNELS, QW_DEFAULTS, QW_KEYS, qwChanges, qwEndsWindows, qwFromApi, qwProblem } from '../src/api/quiet-windows';
import { QWT_KEYS, QWT_TABLES, qwt } from '../src/i18n/quiet-windows';
import {
  APP_EXCHANGE_KEY, APP_REFRESH_KEY, APP_SIGNIN_OFF, EXCHANGE_ACCESS_MAX, appSignInBody, appSignInEnds, appSignInOf, appSignInProblem, onLocked, setAppSwitch,
} from '../src/api/app-signin';
import { AST_KEYS, AST_TABLES, ast } from '../src/i18n/app-signin';

// release/2380-train: the Settings rows the 2.38.0 server pieces were waiting for (the screen files were free once polish round 4 merged):
//  1. TV-SETTINGS-2380 - portrait_chips + safe_margin (installation default + per board, "ברירת מחדל" = null);
//  2. MOBILE-CONTRACT-V22-2380 - presence.value_check (off / normalize / strict, default off);
//  3. APP-SERVER-LEFTOVERS-2380 - quiet.windows.channels (push / all, default push) in a new quiet-window card;
//  4. the phone app's two sign-in switches (auth/app/settings) for a system administrator, the route's local-channel rule.
// Node only: the rules are pure modules; the template wiring is read from the source.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const HA_WORDS = /Home Assistant|\bHA\b|Supervisor|Ingress|Companion|add-on/i;

// ---------------------------------------------------------------- 1. TV rows

test('TV rows: the values and factory are the server\'s (rows / 0), an older backend reads as the factory', () => {
  expect(TV_FIT_KEYS).toEqual(['portrait_chips', 'safe_margin']);
  expect(PORTRAIT_CHIPS).toEqual(['rows', 'drop']);
  expect(SAFE_MARGINS).toEqual([0, 1, 2, 3, 4, 5]);
  expect(TVFIT_FACTORY).toEqual({ portrait_chips: 'rows', safe_margin: 0 });
  expect(tvFitDefaultsOf(undefined)).toEqual(TVFIT_FACTORY);
  expect(tvFitDefaultsOf({ portrait_chips: 'drop', safe_margin: 3 })).toEqual({ portrait_chips: 'drop', safe_margin: 3 });
  for (const bad of ['Drop', '', 2, null, true]) expect(tvFitDefaultsOf({ portrait_chips: bad }).portrait_chips).toBe('rows');
  for (const bad of [-1, 6, 2.5, '3', true, null]) expect(tvFitDefaultsOf({ safe_margin: bad }).safe_margin).toBe(0);
});

test('TV rows: a board follows the default until it chooses; its own 0 beats a default margin; null returns to the default', () => {
  const dflt = { portrait_chips: 'drop', safe_margin: 3 } as const;
  expect(tvFitOwn({}, 'safe_margin')).toBeNull();
  expect(tvFitOwn({ safe_margin: null }, 'safe_margin')).toBeNull();
  expect(tvFitOwn({ safe_margin: 0 }, 'safe_margin')).toBe(0); // a real choice, not "falsy = default"
  expect(effectiveTvFit({ safe_margin: 0 }, dflt).safe_margin).toBe(0);
  expect(effectiveTvFit({}, dflt)).toEqual(dflt);
  expect(effectiveTvFit({ portrait_chips: 'rows' }, dflt).portrait_chips).toBe('rows');
  expect(effectiveTvFit({ portrait_chips: null, safe_margin: null }, dflt)).toEqual(dflt);
  expect(tvFitOwn({ safe_margin: 7 as never }, 'safe_margin')).toBeNull(); // a bad stored value never reads as the board's own
});

test('TV rows: the Hebrew labels, button texts and hints are the change record\'s; English twins exist', () => {
  expect(nt('portraitChipsLabel', undefined, 'he')).toBe('תצוגת אייקוני המבנה במסך אנכי');
  expect(nt('portraitChips_rows', undefined, 'he')).toBe('שתי שורות');
  expect(nt('portraitChips_drop', undefined, 'he')).toBe('שורה אחת, מסתירים את התקינים קודם');
  expect(nt('safeMarginLabel', undefined, 'he')).toBe('שוליים בטוחים בקצוות המסך');
  expect(nt('safeMargin_0', undefined, 'he')).toBe('ללא');
  const [k3, v3] = tvFitText('safe_margin', 3);
  expect(nt(k3, v3, 'he')).toBe('3%');
  expect(tvFitText('safe_margin', 0)).toEqual(['safeMargin_0']);
  expect(tvFitText('portrait_chips', 'drop')).toEqual(['portraitChips_drop']);
  expect(nt('portraitChipsHint', undefined, 'he')).toContain('מעליות, גנרטור, חניה, חדר כושר');
  expect(nt('safeMarginHint', undefined, 'he')).toContain('?safe=3');
  expect(nt('safeMarginHint', undefined, 'he')).toContain('ברירת המחדל: ללא');
  expect(nt('portraitChipsLabel', undefined, 'en')).toBe('Building chips in portrait');
  expect(nt('safeMarginLabel', undefined, 'en')).toBe('Safe margin');
  expect(nt('safeMargin_0', undefined, 'en')).toBe('None');
});

test('TV rows: wired into the TV defaults card and the board display tab; "ברירת מחדל" sends null; the margin is sent as a number', () => {
  const comp = read('src/notices/display-fit.ts');
  expect(comp).toContain("this.emit(key, null)");
  expect(comp).toContain("nt('tvUseDefault')");
  expect(comp).toContain("data-seg=${seg}");
  expect(comp).toMatch(/'portrait-chips'/);
  expect(comp).toMatch(/'safe-margin'/);
  expect(comp).toContain('this.emit(key, v)'); // v is the number itself (SAFE_MARGINS), never String(v): the server takes a JSON integer
  const scr = read('src/screens/system-notices.ts');
  expect(scr).toContain('<notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=');
  expect(scr).toContain('<notice-display-fit .display=${d} .defaults=${this.tvFitDefaults()} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}>');
  expect(scr.indexOf('<notice-display-fit .display')).toBeGreaterThan(scr.indexOf('<notice-display-design .display'));
});

// ---------------------------------------------------------------- 2. presence.value_check

test('presence value check: three modes, default off, an older backend or a bad value reads as off', () => {
  expect(VALUE_CHECK_MODES).toEqual(['off', 'normalize', 'strict']);
  expect(VALUE_CHECK_DEFAULT).toBe('off');
  for (const m of VALUE_CHECK_MODES) expect(valueCheckOf(m)).toBe(m);
  for (const bad of [undefined, null, '', 'Strict', 'normal', 1, true]) expect(valueCheckOf(bad)).toBe('off');
});

test('presence value check: the row (כבוי / נרמול / קפדני, the go-live recommendation) is saved with the general settings', () => {
  expect(pt('valueCheck_off', undefined, 'he')).toBe('כבוי');
  expect(pt('valueCheck_normalize', undefined, 'he')).toBe('נרמול');
  expect(pt('valueCheck_strict', undefined, 'he')).toBe('קפדני');
  expect(pt('valueCheckHint', undefined, 'he')).toContain('מומלץ לבחור נרמול לפני הפעלת השיתוף');
  expect(pt('valueCheck', undefined, 'en')).toBe('Sensor value check');
  expect(pt('valueCheckHint', undefined, 'en')).toContain('Normalise before sharing is switched on');
  const scr = read('src/screens/system-presence.ts');
  expect(scr).toContain('data-presence-row="value-check"');
  expect(scr).toContain('data-presence-value-check');
  expect(scr).toContain('value_check: valueCheckOf(d.value_check)');
  expect(scr).toContain("this.patch({ value_check: m })");
  expect(HA_WORDS.test(pt('valueCheckHint', undefined, 'he'))).toBe(false);
});

// ---------------------------------------------------------------- 3. quiet-window card

test('quiet window: the five settings from the API strings, the factory for a missing / bad value (channels default push)', () => {
  expect(QUIET_CHANNELS).toEqual(['push', 'all']);
  expect(QW_DEFAULTS).toEqual({ enabled: false, default_minutes: 120, max_minutes: 240, mute_alerts: false, channels: 'push' });
  expect(qwFromApi(undefined)).toEqual(QW_DEFAULTS);
  expect(qwFromApi({ 'quiet.windows.enabled': 'on', 'quiet.windows.default_minutes': '60', 'quiet.windows.max_minutes': '90', 'quiet.windows.mute_alerts': 'on', 'quiet.windows.channels': 'all' }))
    .toEqual({ enabled: true, default_minutes: 60, max_minutes: 90, mute_alerts: true, channels: 'all' });
  expect(qwFromApi({ 'quiet.windows.channels': 'ALL' }).channels).toBe('push');
  expect(qwFromApi({ 'quiet.windows.default_minutes': '4' }).default_minutes).toBe(120);
  expect(qwFromApi({ 'quiet.windows.max_minutes': '721' }).max_minutes).toBe(240);
  expect(QW_KEYS.channels).toBe('quiet.windows.channels');
});

test('quiet window: the PUT sends only the changed keys as strings; the server refusals are checked first; switching off ends windows', () => {
  const saved = { ...QW_DEFAULTS };
  expect(qwChanges(saved, saved)).toEqual({});
  expect(qwChanges(saved, { ...saved, channels: 'all' })).toEqual({ 'quiet.windows.channels': 'all' });
  expect(qwChanges(saved, { ...saved, enabled: true, default_minutes: 30 })).toEqual({ 'quiet.windows.enabled': 'on', 'quiet.windows.default_minutes': '30' });
  expect(qwProblem(saved)).toBeNull();
  expect(qwProblem({ ...saved, default_minutes: 4 })).toBe('range');
  expect(qwProblem({ ...saved, max_minutes: 721 })).toBe('range');
  expect(qwProblem({ ...saved, default_minutes: 12.5 })).toBe('range');
  expect(qwProblem({ ...saved, default_minutes: 300, max_minutes: 240 })).toBe('default_over_max');
  expect(qwEndsWindows({ ...saved, enabled: true }, saved)).toBe(true);
  expect(qwEndsWindows(saved, { ...saved, enabled: true })).toBe(false);
});

test('quiet window: the card is in הגדרות › התראות, confirmed by a dialog, a sticky save row, Hebrew + English, no platform words', () => {
  expect(qwt('ch_push', undefined, 'he')).toBe('פוש בלבד');
  expect(qwt('ch_all', undefined, 'he')).toBe('כל הערוצים');
  for (const k of QWT_KEYS) {
    expect(QWT_TABLES.en[k], `en ${k}`).toBeTruthy();
    expect(HA_WORDS.test(qwt(k, undefined, 'he')), `he ${k}`).toBe(false);
  }
  const card = read('src/screens/system-quiet-windows.ts');
  expect(card).toContain('class="foot sticky"');
  expect(card).toContain('settingsStyles');
  expect(card).toContain("data-qw-row=\"channels\"");
  expect(card).toContain('data-qw-confirm-go');
  expect(read('src/api/quiet-windows.ts')).toContain("{ changes, confirmed: true }");
  const scr = read('src/screens/system-notifications.ts');
  expect(scr).toContain('<system-quiet-windows></system-quiet-windows>');
  expect(scr.indexOf('data-set-section="quiet-windows"')).toBeGreaterThan(scr.indexOf('data-set-section="quiet"'));
});

// ---------------------------------------------------------------- 4. app sign-in switches

test('app sign-in: the settings document as two switches; off is the factory; turning the saved sign-in off turns the exchange off', () => {
  expect(APP_REFRESH_KEY).toBe('security.app_refresh');
  expect(APP_EXCHANGE_KEY).toBe('security.app_session_exchange');
  expect(appSignInOf(undefined)).toEqual(APP_SIGNIN_OFF);
  expect(appSignInOf({ 'security.app_refresh': 'on', 'security.app_session_exchange': 'on', 'security.app_refresh_access_minutes': 15 })).toEqual({ refresh: true, exchange: true, accessMinutes: 15 });
  const both = { refresh: true, exchange: true, accessMinutes: 10 };
  expect(setAppSwitch(both, 'refresh', false)).toEqual({ refresh: false, exchange: false, accessMinutes: 10 });
  expect(setAppSwitch(both, 'exchange', false)).toEqual({ refresh: true, exchange: false, accessMinutes: 10 });
  expect(setAppSwitch(APP_SIGNIN_OFF, 'refresh', true)).toEqual({ ...APP_SIGNIN_OFF, refresh: true });
});

test('app sign-in: the route\'s rules - ON from the local channel only, OFF anywhere; the exchange needs the saved sign-in and <= 15 minutes', () => {
  const off = APP_SIGNIN_OFF;
  const on = { refresh: true, exchange: true, accessMinutes: 10 };
  expect(onLocked(off, 'refresh', true)).toBe(true);
  expect(onLocked(off, 'refresh', false)).toBe(false);
  expect(onLocked(on, 'refresh', true)).toBe(false); // already on: keeping it on from outside is allowed
  expect(appSignInProblem(off, { ...off, refresh: true }, true)).toBe('remote_on');
  expect(appSignInProblem(off, { ...off, refresh: true }, false)).toBeNull();
  expect(appSignInProblem(on, { ...on, refresh: false, exchange: false }, true)).toBeNull(); // OFF from the remote channel
  expect(appSignInProblem(off, { ...off, exchange: true }, false)).toBe('exchange_needs_refresh');
  expect(appSignInProblem(off, { refresh: true, exchange: true, accessMinutes: 30 }, false)).toBe('access_too_long');
  expect(appSignInProblem(off, { refresh: true, exchange: true, accessMinutes: EXCHANGE_ACCESS_MAX }, false)).toBeNull();
  expect(appSignInBody(off, off)).toEqual({});
  expect(appSignInBody(off, { refresh: true, exchange: true, accessMinutes: 10 })).toEqual({ 'security.app_refresh': 'on', 'security.app_session_exchange': 'on' });
  expect(appSignInBody(on, { ...on, exchange: false })).toEqual({ 'security.app_session_exchange': 'off' });
  expect(appSignInEnds(on, off)).toEqual(['refresh', 'exchange']);
  expect(appSignInEnds(off, on)).toEqual([]);
});

test('app sign-in: an admin card in הגדרות › גישה מרחוק, hidden on 403, a confirmation before sign-ins end, Hebrew + English, no platform words', () => {
  expect(ast('refresh', undefined, 'he')).toBe('כניסה שמורה באפליקציה');
  expect(ast('exchange', undefined, 'he')).toBe('חיבור מסך האפליקציה');
  for (const k of AST_KEYS) {
    expect(AST_TABLES.en[k], `en ${k}`).toBeTruthy();
    expect(HA_WORDS.test(ast(k, undefined, 'he')), `he ${k}`).toBe(false);
    expect(HA_WORDS.test(ast(k, undefined, 'en')), `en ${k}`).toBe(false);
  }
  const card = read('src/screens/system-app-signin.ts');
  expect(card).toContain("e.status === 403");
  expect(card).toContain("this.phase = 'hidden'");
  expect(card).toContain('onLocked(this.saved, sw, remote)');
  expect(card).toContain('class="foot sticky"');
  expect(card).toContain('data-app-signin-confirm-go');
  const diag = read('src/screens/system-diagnostics.ts');
  expect(diag).toContain("${api && can('system.configure') ? html`<system-app-signin></system-app-signin>` : nothing}");
  const remote = diag.slice(diag.indexOf('private renderRemote()'), diag.indexOf('private renderCodecSummary()'));
  expect(remote).toContain('<system-app-signin>');
});
