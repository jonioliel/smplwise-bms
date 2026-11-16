/**
 * CR-008 P3: the app side of the PWA - service-worker registration under the app's own base, the update notice, the
 * install prompt (`beforeinstallprompt` on Android / desktop Chromium) and the iOS "add to home screen" hint.
 *
 * The base is the page's own directory (`document.baseURI`, like every API call in api/client.ts): the Ingress prefix
 * `/api/hassio_ingress/<token>/` today, `/arx/` on the remote channel. The worker is `<base>arx-sw.js` with that base as
 * its scope, so it never touches Home Assistant's own pages or worker (scope `/`).
 */
import { inAndroidApp } from '../arx/android-app';
import { inNativeApp } from '../arx/native-app';
import { quietScreenLoads } from '../shell/lazy-screens';

/** Chromium's install prompt event (not in the DOM typings). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  registration: ServiceWorkerRegistration | null;
  updateReady: boolean;
  installEvent: InstallPromptEvent | null;
  installed: boolean;
}

export const pwa: PwaState = { registration: null, updateReady: false, installEvent: null, installed: false };
const listeners = new Set<() => void>();

export function onPwa(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  listeners.forEach((fn) => fn());
}

/** The app's base URL (always ends in `/`). */
export function appBase(): string {
  return new URL('./', document.baseURI).href;
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Inside Home Assistant (Ingress) the app is a frame: installing it or showing install hints makes no sense there. */
export function isFramed(): boolean {
  try {
    return window.top !== window;
  } catch {
    return true;
  }
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const DISMISS_DAYS = 14;

export function dismissed(key: string): boolean {
  try {
    const at = Number(localStorage.getItem(`arx.pwa.${key}.dismissed`) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

export function dismiss(key: string): void {
  try {
    localStorage.setItem(`arx.pwa.${key}.dismissed`, String(Date.now()));
  } catch {
    /* private mode: the hint just comes back next time */
  }
  changed();
}

/** MOBILE214: inside either native app (Android or iOS): the app is the installed form, no install banner or hint. */
export function inNativeShell(): boolean {
  return inAndroidApp() || inNativeApp();
}

/** Show the install banner: Chromium offered to install, not installed, not framed, not dismissed recently, and not
 * already inside the Android app (CR-008 §9 - the app is the installed form). */
export function showInstall(): boolean {
  return !!pwa.installEvent && !pwa.installed && !isStandalone() && !isFramed() && !inNativeShell() && !dismissed('install');
}

/** Show the iOS guide: Safari on iPhone/iPad, not already on the home screen, not framed, not dismissed recently. */
export function showIosHint(): boolean {
  return isIos() && !isStandalone() && !isFramed() && !inNativeShell() && !dismissed('ios');
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const ev = pwa.installEvent;
  if (!ev) return 'unavailable';
  pwa.installEvent = null; // a prompt event can be used once
  await ev.prompt();
  const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  if (choice.outcome === 'accepted') pwa.installed = true;
  else dismiss('install');
  changed();
  return choice.outcome;
}

/** How long "רענון" waits for the new worker to start activating before it reloads the page anyway (applyUpdate). */
export const UPDATE_STALL_MS = 3000;
/** How long a reload of applyUpdate may stay pending (this document still here) before it is asked again. */
export const UPDATE_RELOAD_RETRY_MS = 8000;

/**
 * Let the waiting worker take over and reload once it controls the page.
 *
 * PWA-UPDATE-STALL-2435: Chromium hands over to a skip-waiting worker by stopping the old one first, and a request that reaches the
 * old worker in that moment is not handled well. Measured on the runner (CDP service-worker events, an instrumented worker script):
 * a fetch arriving while the old worker stops starts it again and the activation is dropped - the new worker stays `installed`, no
 * controllerchange comes, and asking it to skip waiting again does nothing (7 of 10 presses on main 0a8fb55e1). And a navigation
 * that reached the old worker just before it was stopped never finished. The start-up warm-up (shell/lazy-screens.ts) fetches the
 * screens' chunks right after load, which is exactly when a new release's notice shows. So:
 *  1. the warm-up stops and the chunk fetches in flight settle first (quietScreenLoads, at most 2 s);
 *  2. then the new worker is asked to skip waiting; its controllerchange reloads the page;
 *  3. when the new worker has not even started activating after UPDATE_STALL_MS, the page reloads anyway (a reload does make
 *     Chromium hand over: the old worker turns redundant at once);
 *  4. a reload still pending after UPDATE_RELOAD_RETRY_MS (this document is still here) is asked again, at most twice.
 */
export function applyUpdate(): void {
  const waiting = pwa.registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
    let again = 0;
    const retry = window.setInterval(() => {
      if (++again > 2) window.clearInterval(retry);
      else window.location.reload();
    }, UPDATE_RELOAD_RETRY_MS);
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload);
  void quietScreenLoads().then(() => {
    waiting.postMessage({ type: 'arx-skip-waiting' });
    window.setTimeout(() => {
      if (waiting.state === 'installed') reload();
    }, UPDATE_STALL_MS);
  });
}

function watchUpdates(reg: ServiceWorkerRegistration) {
  const mark = () => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      pwa.updateReady = true;
      changed();
    }
  };
  mark();
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed') mark();
    });
  });
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60_000) {
      last = Date.now();
      void reg.update().catch(() => undefined);
    }
  });
}

/** The top-level page that hosts the app: itself on the remote channel, the HA panel page under Ingress. */
function hostPage(): string {
  try {
    const top = window.top?.location;
    if (top && top.origin === window.location.origin) return top.pathname + top.search;
  } catch {
    /* cross-origin top: fall back to our own page */
  }
  return window.location.pathname;
}

/** A notification clicked while no Arx window was open leaves its route for the app to open on start. */
async function takePendingLink(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('arx-meta');
    const key = `${appBase()}__arx/pending`;
    const res = await cache.match(key);
    if (!res) return;
    await cache.delete(key);
    const { hash, at } = (await res.json()) as { hash?: string; at?: number };
    if (hash && /^#\//.test(hash) && at && Date.now() - at < 5 * 60_000) window.location.hash = hash;
  } catch {
    /* nothing pending */
  }
}

export async function startPwa(): Promise<void> {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // our own banner ("התקן את Arx") decides when to ask
    pwa.installEvent = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    pwa.installed = true;
    pwa.installEvent = null;
    changed();
  });
  if (!('serviceWorker' in navigator) || !window.isSecureContext || import.meta.env.DEV) return;
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; hash?: string } | null;
    if (d?.type === 'arx-navigate' && typeof d.hash === 'string' && /^#\//.test(d.hash)) window.location.hash = d.hash;
  });
  try {
    const reg = await navigator.serviceWorker.register(new URL('arx-sw.js', document.baseURI).href, { scope: appBase() });
    pwa.registration = reg;
    watchUpdates(reg);
    changed();
    const ready = await navigator.serviceWorker.ready;
    ready.active?.postMessage({ type: 'arx-context', openUrl: hostPage() });
    await takePendingLink();
  } catch {
    /* no worker (blocked, private mode): the app works without it, only offline and push are missing */
  }
}
