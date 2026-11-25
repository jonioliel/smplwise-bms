import { inAndroidShell } from '../arx/android-app';

/**
 * MFA-T095-REST-2530 (CR-011 option D): inside the Android app that holds the phone key, look for approval requests made by another
 * screen of the same account (`GET auth/push-approvals`) and show the approval sheet (components/sw-push-approval-sheet.ts, a lazy
 * chunk). The request itself wakes the phone through the existing notice channels (inbox, the app's push); opening the app brings the
 * page to the front, and this watcher looks: at start, whenever the page becomes visible again, and every LOOK_MS while it is visible and
 * the installation has the feature on. Outside the app, or without a phone key, it does nothing at all (no request is ever made).
 */
const LOOK_MS = 5000;

let started = false;
let showing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function look(keyId: string): Promise<boolean> {
  if (showing || document.visibilityState !== 'visible') return true;
  const { listPushApprovals } = await import('../api/push-approval');
  let list;
  try {
    list = await listPushApprovals();
  } catch {
    return true; // signed out, offline: look again later
  }
  if (!list.enabled) return false;
  const first = list.pending[0];
  if (first) {
    showing = true;
    const { showPushApproval } = await import('../components/sw-push-approval-sheet');
    await showPushApproval(first, keyId);
    showing = false;
  }
  return true;
}

function schedule(keyId: string, on: boolean) {
  if (timer) clearTimeout(timer);
  timer = on ? setTimeout(() => void look(keyId).then((again) => schedule(keyId, again)), LOOK_MS) : null;
}

export function installPushApprovalWatch(): void {
  if (started || typeof window === 'undefined' || !inAndroidShell()) return;
  started = true;
  void import('../api/factor-screens').then(async ({ appDeviceKeyId }) => {
    const keyId = await appDeviceKeyId();
    if (!keyId) return;
    const run = () => void look(keyId).then((on) => schedule(keyId, on));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run();
    });
    run();
  });
}
