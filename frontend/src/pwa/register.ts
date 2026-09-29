/**
 * CR-008 P3: the app side of the PWA - service-worker registration under the app's own base, the update notice, the
 * install prompt (`beforeinstallprompt` on Android / desktop Chromium) and the iOS "add to home screen" hint.
 *
 * The base is the page's own directory (`document.baseURI`, like every API call in api/client.ts): the Ingress prefix
 * `/api/hassio_ingress/<token>/` today, `/arx/` on the remote channel. The worker is `<base>arx-sw.js` with that base as
 * its scope, so it never touches Home Assistant's own pages or worker (scope `/`).
 */
import { inAndroidApp } from '../arx/android-app';

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

/** Show the install banner: Chromium offered to install, not installed, not framed, not dismissed recently, and not
 * already inside the Android app (CR-008 §9 - the app is the installed form). */
export function showInstall(): boolean {
  return !!pwa.installEvent && !pwa.installed && !isStandalone() && !isFramed() && !inAndroidApp() && !dismissed('install');
}

/** Show the iOS guide: Safari on iPhone/iPad, not already on the home screen, not framed, not dismissed recently. */
export function showIosHint(): boolean {
  return isIos() && !isStandalone() && !isFramed() && !inAndroidApp() && !dismissed('ios');
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

/** Let the waiting worker take over and reload once it controls the page. */
export function applyUpdate(): void {
  const waiting = pwa.registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  waiting.postMessage({ type: 'arx-skip-waiting' });
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
