/**
 * CR-008 §9: is this page running inside a SmplWise Arx Android app?
 *
 * Two apps exist during the trial, and the page treats them the same way:
 * - the own-WebView shell (`mobile/android-shell/`, package com.smplwise.arx.app) injects `window.ArxApp`
 *   ({ platform: 'android', shell: 'webview', version, switchServer() }) - only into pages of the server the user chose;
 * - the Trusted Web Activity (package com.smplwise.arx) and the shell both append `?app=android` to the URL they open.
 *   The first page load records that in sessionStorage (later in-app navigations, reloads and hash routes still know)
 *   and drops the parameter from the address, so a copied link never carries it.
 *
 * Inside an app the page offers "החלף שרת": the shell's `ArxApp.switchServer()`, or navigating to `arx://servers`
 * (which both apps turn into their native server list). The function names match the TWA branch, so the merge of the
 * two is trivial.
 */
export const APP_PARAM = 'app';
export const ANDROID_VALUE = 'android';
export const STORAGE_KEY = 'arx.app.v1';
export const SWITCH_SERVER_URL = 'arx://servers';

/** What the own-WebView shell injects (mobile/android-shell BridgeScript.kt). */
export interface ArxAppBridge {
  readonly platform: string;
  readonly shell?: string;
  readonly version?: string;
  switchServer(): void;
}

declare global {
  interface Window {
    ArxApp?: ArxAppBridge;
  }
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Pure: the shell's injected interface, when it looks like one. */
export function shellBridge(w: { ArxApp?: unknown } | null | undefined): ArxAppBridge | null {
  const b = w?.ArxApp as Partial<ArxAppBridge> | undefined;
  if (!b || typeof b !== 'object') return null;
  if (b.platform !== ANDROID_VALUE || typeof b.switchServer !== 'function') return null;
  return b as ArxAppBridge;
}

/** Pure: whether the query string or the stored flag says "inside the Android app"; records a query hit in the store. */
export function detectAndroidApp(search: string, store: KeyValueStore | null): boolean {
  let fromQuery = false;
  try {
    fromQuery = new URLSearchParams(search).get(APP_PARAM) === ANDROID_VALUE;
  } catch {
    fromQuery = false;
  }
  try {
    if (fromQuery) {
      store?.setItem(STORAGE_KEY, ANDROID_VALUE);
      return true;
    }
    return store?.getItem(STORAGE_KEY) === ANDROID_VALUE;
  } catch {
    return fromQuery; // storage blocked: only this load knows
  }
}

/** Pure: the same URL without `app=android` (other parameters and the hash route are kept). */
export function withoutAppParam(href: string): string {
  const url = new URL(href);
  if (url.searchParams.get(APP_PARAM) !== ANDROID_VALUE) return href;
  url.searchParams.delete(APP_PARAM);
  return url.toString();
}

let cached: boolean | null = null;

/** True inside either Android app (the own-WebView shell or the Trusted Web Activity). */
export function inAndroidApp(): boolean {
  if (cached !== null) return cached;
  let store: KeyValueStore | null = null;
  try {
    store = window.sessionStorage;
  } catch {
    store = null;
  }
  const fromUrl = detectAndroidApp(window.location.search, store);
  if (fromUrl) {
    const clean = withoutAppParam(window.location.href);
    if (clean !== window.location.href) history.replaceState(history.state, '', clean);
  }
  cached = fromUrl || shellBridge(window) !== null;
  return cached;
}

/** True inside the own-WebView shell (not the TWA): no Web Push there, the shell has no browser underneath. */
export function inAndroidShell(): boolean {
  return shellBridge(window) !== null;
}

/** Opens the app's native server list (only meaningful inside the app; call from a click handler). */
export function switchServer(): void {
  const bridge = shellBridge(window);
  if (bridge) {
    bridge.switchServer();
    return;
  }
  window.location.href = SWITCH_SERVER_URL;
}

/** Tests only: forget the cached answer. */
export function resetAndroidAppForTests(): void {
  cached = null;
}
