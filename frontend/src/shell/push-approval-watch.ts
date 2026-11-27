import { inAndroidShell } from '../arx/android-app';

/**
 * MFA-T095-REST-2530 (CR-011 option D): inside the Android app that holds the phone key, look for approval requests made by another
 * screen of the same account (`GET auth/push-approvals`) and show the approval sheet (components/sw-push-approval-sheet.ts, a lazy
 * chunk). The request itself wakes the phone through the existing notice channels (inbox, the app's push); opening the app brings the
 * page to the front, and this watcher looks: at start, whenever the page becomes visible again, and every LOOK_MS while it is visible and
 * the installation has the feature on. Outside the app, or without a phone key, it does nothing at all (no request is ever made).
 */
const LOOK_MS = 5000;
/** SA-01 (FIX-PUSH-APPROVAL-2560): while nothing is pending the phone looks slowly; a request wakes the phone through the notice channels and
 * opening the app looks at once (`visibilitychange`), so the quiet look can be 3x slower without delaying an approval. */
export const IDLE_LOOK_MS = 15000;

let started = false;
let showing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
/** Requests already shown: closing the sheet without an answer does not bring the same request back every few seconds. */
const shown = new Set<string>();

type PushList = Awaited<ReturnType<typeof import('../api/push-approval').listPushApprovals>>;
type Pending = PushList['pending'][number];

export interface LookDeps {
  visible(): boolean;
  list(): Promise<PushList>;
  show(first: Pending, keyId: string): Promise<unknown>;
}

const realDeps: LookDeps = {
  visible: () => document.visibilityState === 'visible',
  list: async () => (await import('../api/push-approval')).listPushApprovals(),
  show: async (first, keyId) => (await import('../components/sw-push-approval-sheet')).showPushApproval(first, keyId),
};

/** One look. Answers the delay before the next one, or `false` when the feature is off (stop looking). */
export async function look(keyId: string, deps: LookDeps = realDeps): Promise<number | false> {
  if (showing || !deps.visible()) return LOOK_MS;
  let list: PushList;
  try {
    list = await deps.list();
  } catch {
    return IDLE_LOOK_MS; // signed out, offline: look again later
  }
  if (!list.enabled) return false;
  const first = list.pending.find((r) => !shown.has(r.request_id));
  if (!first) return IDLE_LOOK_MS;
  shown.add(first.request_id);
  showing = true;
  try {
    await deps.show(first, keyId);
  } catch {
    /* FE-06: a chunk that fails to load (a page left open across an update) or a sheet that throws must not end the watcher */
  } finally {
    showing = false;
  }
  return LOOK_MS;
}

export function resetPushApprovalWatchForTests(): void {
  showing = false;
  shown.clear();
}

function schedule(keyId: string, next: number | false) {
  if (timer) clearTimeout(timer);
  timer = next === false ? null : setTimeout(() => void look(keyId).then((again) => schedule(keyId, again)), next);
}

export function installPushApprovalWatch(): void {
  if (started || typeof window === 'undefined' || !inAndroidShell()) return;
  started = true;
  void import('../api/factor-screens').then(async ({ appDeviceKeyId }) => {
    const keyId = await appDeviceKeyId();
    if (!keyId) return;
    const run = () => void look(keyId).then((next) => schedule(keyId, next));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run();
    });
    run();
  });
}
