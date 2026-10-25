/**
 * CR-008 SmplWise Arx: start-up on the remote channel. Register our own service worker (scope = the Arx base, so HA's
 * site-wide worker never serves our pages), resume a stored sign-in or show the sign-in page, then load the product
 * shell exactly as under Ingress (same API, same principal model, same screens).
 */
import { setUnauthorizedHandler } from '../api/client';
import { ArxAuthError, dropOrphanSeed, loadRemoteConfig, nativeReasonOf, refreshNow, remoteConfig, resume, startBackground, takeSignOutReason } from './auth';
import { notifyNativeSignedOut } from './native-app';
import { mountShell } from './pre-gate';
import { inAndroidApp } from './android-app';
import { localMe, welcomeToken } from './local-auth';
import { lit } from '../i18n/local-identity';
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
  setUnauthorizedHandler(async () => {
    const ok = await refreshNow();
    if (!ok) window.location.reload();
    return ok;
  });
  startBackground((reason) => {
    notifyNativeSignedOut(nativeReasonOf(reason)); // SX-10: a no-op when logout() already told the shell
    window.location.reload();
  });
  mountShell();
}

function showLogin(notice: string, kind: 'info' | 'error', mode: '' | 'local' = ''): void {
  const login = document.createElement('arx-login');
  login.notice = notice;
  login.noticeKind = kind;
  login.localEnabled = !!remoteConfig().local_identity; // USR2: the "משתמש Arx" mode, only while the server offers it
  login.initialMode = mode;
  login.passkeyFirst = !!remoteConfig().local_passkey_first; // USR2 phase 4: "כניסה עם מפתח גישה", only while the server allows it
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
  let notice = takeSignOutReason() ?? '';
  let kind: 'info' | 'error' = 'info';
  try {
    if (await resume()) {
      await startApp();
      return;
    }
    // USR2: an Arx-only identity keeps no tokens in this page - its HttpOnly cookie is the session
    if (remoteConfig().local_identity) {
      const me = await localMe();
      if (me && !me.local_identity?.gate) {
        await startApp();
        return;
      }
    }
    notice = takeSignOutReason() ?? notice; // CR-008 P2: resume() itself learnt that this sign-in was revoked
  } catch (err) {
    notice = err instanceof ArxAuthError ? err.message : '';
    kind = 'error';
  }
  showLogin(notice, kind);
}
