/**
 * CR-008 SmplWise Arx: start-up on the remote channel. Register our own service worker (scope = the Arx base, so HA's
 * site-wide worker never serves our pages), resume a stored sign-in or show the sign-in page, then load the product
 * shell exactly as under Ingress (same API, same principal model, same screens).
 */
import { setUnauthorizedHandler } from '../api/client';
import { ArxAuthError, dropOrphanSeed, loadRemoteConfig, nativeReasonOf, refreshOutcome, remoteConfig, resume, startBackground, takeSignOutReason, type RefreshOutcome } from './auth';
import type { ArxReconnect } from './arx-reconnect';
import './arx-reconnect'; // in the start-up chunk itself: it is shown exactly when nothing more can be fetched
import { notifyNativeSignedOut } from './native-app';
import { mountShell } from './pre-gate';
import { inAndroidApp } from './android-app';
import { localMe, welcomeToken } from './local-auth';
import { lit } from '../i18n/local-identity';
import { syncUiLang } from '../i18n/ui-lang';
import './arx-login';
import './arx-welcome';

function registerWorker(): void {
  // The PWA shell (CR-008 P3, its own branch) ships `arx-sw.js`; registered with the scope of the Arx base. A missing
  // file only means no worker yet.
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('arx-sw.js', { scope: './' }).catch(() => undefined);
}

let started = false;

async function startApp(): Promise<void> {
  if (started) return;
  started = true;
  document.documentElement.setAttribute('data-channel', 'remote');
  // a 401 mid-session: refresh + re-exchange once; if that fails the sign-in has ended
  // CLIENT-RESILIENCE-2540 (review FC-03): only when it ENDED - with the sign-in service unreachable (no connection, a 5xx while the
  // platform restarts) the sign-in is kept, the request fails like an offline one and the refresh retries by itself
  setUnauthorizedHandler(async () => {
    const r = await refreshOutcome();
    if (r === 'ended') window.location.reload();
    return r === 'retry' ? 'unreachable' : r === 'ok';
  });
  startBackground((reason) => {
    notifyNativeSignedOut(nativeReasonOf(reason)); // SX-10: a no-op when logout() already told the shell
    window.location.reload();
  });
  mountShell();
  // LOWS-FRONTEND-2550 (review FC-07): the personal language is read again now that the session exists - main.ts's early read ran
  // before the remote sign-in (a 401, swallowed), so a user whose stored language differs from this browser's copy stayed in the
  // wrong language for the whole session. Same language: nothing happens; another one: the mirror is written and the page reloads once.
  void syncUiLang();
}

function showLogin(notice: string, kind: 'info' | 'error', mode: '' | 'local' = ''): void {
  const login = document.createElement('arx-login');
  login.notice = notice;
  login.noticeKind = kind;
  login.localEnabled = !!remoteConfig().local_identity; // USR2: the "משתמש Arx" mode, only while the server offers it
  login.initialMode = mode;
  login.passkeyFirst = !!remoteConfig().local_passkey_first; // USR2 phase 4: "כניסה עם מפתח גישה", only while the server allows it
  login.recoveryReenrol = remoteConfig().recovery_reenrol === true; // MFA-SCREENS-2510: the Q14 hook, off unless a server says on
  login.addEventListener('arx-signed-in', () => {
    login.remove();
    void startApp();
  });
  document.body.appendChild(login);
}

/** USR2: the welcome page of a first-login / reset link; afterwards the sign-in page in the "משתמש Arx" mode. */
function showWelcome(token: string): void {
  const cfg = remoteConfig();
  const page = document.createElement('arx-welcome');
  page.token = token;
  page.enabled = !!cfg.local_identity;
  page.minLength = cfg.local_password_min ?? 12;
  page.addEventListener('arx-password-set', (e) => {
    page.remove();
    showLogin(lit((e as CustomEvent<{ mustEnrol: boolean }>).detail.mustEnrol ? 'welcomeEnrol' : 'welcomeDone'), 'info', 'local');
  });
  document.body.appendChild(page);
}

/** CLIENT-RESILIENCE-2540 (FC-03): the waits between two tries of a stored sign-in while it cannot be checked (then every 30 s). */
const RECONNECT_MS = [5_000, 10_000, 20_000, 30_000] as const;

let reconnect: { el: ArxReconnect; timer: number; attempt: number; online: () => void } | null = null;

function stopReconnect(): void {
  if (!reconnect) return;
  window.clearTimeout(reconnect.timer);
  window.removeEventListener('online', reconnect.online);
  reconnect.el.remove();
  reconnect = null;
}

/** CLIENT-RESILIENCE-2540 (FC-03): the stored sign-in could not be checked (no connection, the sign-in service or the server said "try
 * again"). The sign-in is valid for its whole period, so the page says "no connection, trying again" - the shell's own offline state -
 * and tries again on a timer, when the browser is back online and on "try now"; it never falls to the sign-in form for this. */
function showReconnect(): void {
  if (!reconnect) {
    const el = document.createElement('arx-reconnect');
    const state = { el, timer: 0, attempt: 0, online: () => void tryAgain() };
    el.addEventListener('arx-reconnect-now', () => void tryAgain());
    window.addEventListener('online', state.online);
    document.body.appendChild(el);
    reconnect = state;
  }
  const r = reconnect;
  window.clearTimeout(r.timer);
  r.timer = window.setTimeout(() => void tryAgain(), RECONNECT_MS[Math.min(r.attempt, RECONNECT_MS.length - 1)]);
  r.attempt++;
}

let trying = false;

async function tryAgain(): Promise<void> {
  if (trying || !reconnect) return;
  trying = true;
  reconnect.el.busy = true;
  try {
    await startFromStored();
  } finally {
    trying = false;
    if (reconnect) reconnect.el.busy = false;
  }
}

/** The stored sign-in, checked: the shell, the reconnect state, or the sign-in page. */
async function startFromStored(): Promise<void> {
  let notice = takeSignOutReason() ?? '';
  let kind: 'info' | 'error' = 'info';
  try {
    const r: RefreshOutcome = await resume();
    if (r === 'ok') {
      stopReconnect();
      await startApp();
      return;
    }
    if (r === 'retry') {
      showReconnect();
      return;
    }
    // USR2: an Arx-only identity keeps no tokens in this page - its HttpOnly cookie is the session
    if (remoteConfig().local_identity) {
      const me = await localMe();
      if (me && !me.local_identity?.gate) {
        stopReconnect();
        await startApp();
        return;
      }
    }
    notice = takeSignOutReason() ?? notice; // CR-008 P2: resume() itself learnt that this sign-in was revoked
  } catch (err) {
    notice = err instanceof ArxAuthError ? err.message : '';
    kind = 'error';
  }
  stopReconnect();
  showLogin(notice, kind);
}

export async function bootRemote(): Promise<void> {
  inAndroidApp(); // CR-008 §9: record `?app=android` for this tab before any route change, and drop it from the address
  registerWorker();
  await loadRemoteConfig();
  const token = welcomeToken();
  if (token !== null || window.location.hash.startsWith('#/welcome')) {
    showWelcome(token ?? '');
    return;
  }
  dropOrphanSeed();
  await startFromStored();
}
