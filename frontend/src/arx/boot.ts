/**
 * CR-008 SmplWise Arx: start-up on the remote channel. Register our own service worker (scope = the Arx base, so HA's
 * site-wide worker never serves our pages), resume a stored sign-in or show the sign-in page, then load the product
 * shell exactly as under Ingress (same API, same principal model, same screens).
 */
import { setUnauthorizedHandler } from '../api/client';
import { ArxAuthError, dropOrphanSeed, loadRemoteConfig, refreshNow, resume, startBackground, takeSignOutReason } from './auth';
import { mountShell } from './pre-gate';
import './arx-login';

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
  startBackground(() => window.location.reload());
  mountShell();
}

function showLogin(notice: string, kind: 'info' | 'error'): void {
  const login = document.createElement('arx-login');
  login.notice = notice;
  login.noticeKind = kind;
  login.addEventListener('arx-signed-in', () => {
    login.remove();
    void startApp();
  });
  document.body.appendChild(login);
}

export async function bootRemote(): Promise<void> {
  registerWorker();
  await loadRemoteConfig();
  dropOrphanSeed();
  let notice = takeSignOutReason() ?? '';
  let kind: 'info' | 'error' = 'info';
  try {
    if (await resume()) {
      await startApp();
      return;
    }
    notice = takeSignOutReason() ?? notice; // CR-008 P2: resume() itself learnt that this sign-in was revoked
  } catch (err) {
    notice = err instanceof ArxAuthError ? err.message : '';
    kind = 'error';
  }
  showLogin(notice, kind);
}
