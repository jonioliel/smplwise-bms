/**
 * CR-008: evaluated before the shell module (main.ts imports it first). On the remote channel the `<sw-app>` element of
 * index.html is taken out of the page, so the shell does not start (and does not ask the server who we are) before the
 * Arx sign-in has a session; boot.ts puts it back. Under Ingress and in local previews nothing changes.
 */
import { isRemoteChannel } from './channel';

export const REMOTE = isRemoteChannel();
let parked: Element | null = null;

if (REMOTE) {
  parked = document.querySelector('sw-app');
  parked?.remove();
}

/** Mount the shell (once the remote sign-in is done). */
export function mountShell(): void {
  if (document.querySelector('sw-app')) return;
  document.body.appendChild(parked ?? document.createElement('sw-app'));
  parked = null;
}
