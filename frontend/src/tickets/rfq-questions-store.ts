/**
 * RFQQUESTIONS: the navigation badge of "בקשות הצעת מחיר" (the tab) and of the tickets area (the rail / bottom bar) - the number of vendor
 * questions waiting in the open requests the user MANAGES (`GET tickets/rfqs/questions/summary`). Started by the shell once the tickets
 * module is on; refreshed every two minutes while the page is visible, when the notification centre changes (a new `rfq.question`
 * arrives there) and right after a manager answers / opens a thread. A user without the right (403) or a server without the route (404)
 * stops the polling and shows no badge. Navigation only - never access control.
 */
import { ApiError } from '../api/client';
import { isApi } from '../api/session';
import { ticketsRfqApi } from '../api/tickets-rfq';
import { notifyStore } from '../components/notify-store';
import { applyRfqQuestions } from '../shell/nav';
import { navCount } from './rfq-questions';

const EVERY_MS = 120_000;
let timer = 0;
let started = false;
let inflight = false;
let debounce = 0;
let stopNotify: (() => void) | null = null;

async function tick(): Promise<void> {
  if (inflight || !started) return;
  inflight = true;
  try {
    applyRfqQuestions(navCount(await ticketsRfqApi().questionsSummary()));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404 || e.status === 405)) stopRfqQuestions();
  } finally {
    inflight = false;
  }
}

/** Re-read the count now (after an answer, a "handled", a thread opened). Does nothing before the shell started the store. */
export function refreshRfqQuestions(): void {
  void tick();
}

export function startRfqQuestions(): void {
  if (started || !isApi()) return;
  started = true;
  void tick();
  timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void tick();
  }, EVERY_MS);
  stopNotify = notifyStore.subscribe(() => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void tick(), 2_000);
  });
}

export function stopRfqQuestions(): void {
  started = false;
  window.clearInterval(timer);
  window.clearTimeout(debounce);
  stopNotify?.();
  stopNotify = null;
  applyRfqQuestions(0);
}
