/**
 * WISKEY-WA-QUEUE-2400: the pure logic of the installed-client messaging card (no DOM): which honest word a job gets, what blocks a
 * template send right now, and which sync outcome means what. Unit-tested in tests/unit-wa-installed.spec.ts.
 */
import type { InstalledJob, InstalledView, SyncOutcome } from '../api/wa-installed';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';
export type JobWord = 'pending' | 'sent' | 'cancelled' | 'paced' | 'expired' | 'not_sent' | 'unknown';

/** A job's honest word. `sent` = accepted by the provider (delivery stays unknown); an unknown is never shown as sent or failed. */
export function jobWord(job: Pick<InstalledJob, 'state' | 'outcome' | 'code'>): JobWord {
  if (job.outcome === 'pending') return 'pending';
  if (job.outcome === 'accepted') return 'sent';
  if (job.outcome === 'not_sent') {
    if (job.code === 'cancelled_before_dispatch') return 'cancelled';
    if (job.code === 'rate_limited') return 'paced';
    if (job.code === 'queue_expired') return 'expired';
    return 'not_sent';
  }
  return 'unknown';
}

export function jobTone(word: JobWord): Tone {
  if (word === 'sent') return 'ok';
  if (word === 'unknown') return 'warn';
  if (word === 'pending') return 'muted';
  return 'bad';
}

export type Blocker = 'messaging_off' | 'template_switch_off' | 'permit_closed' | 'queue_unavailable';

/** Why nothing can be sent through the installed client now, in the order the server checks (empty = nothing known stands in the way). */
export function blockers(v: Pick<InstalledView, 'gates' | 'commands'>): Blocker[] {
  const out: Blocker[] = [];
  if (!v.gates.messaging_enabled) out.push('messaging_off');
  if (!v.gates.template_switch) out.push('template_switch_off');
  if (!v.gates.permit) out.push('permit_closed');
  if (!v.commands['whatsapp/template_enqueue_v1'] && !v.commands['whatsapp/template_send_v3']) out.push('queue_unavailable');
  return out;
}

export function syncTone(outcome: SyncOutcome | null | undefined): Tone {
  if (outcome === 'synced') return 'ok';
  if (outcome === 'unknown') return 'warn';
  if (!outcome) return 'muted';
  return 'bad';
}

/** The paced-send switch can be turned on only while WisKey lists the command; turning it OFF is always possible. */
export function pacedEditable(v: Pick<InstalledView, 'settings' | 'commands'>): boolean {
  return v.settings.send_pacing_v1 || v.commands['whatsapp/send_pacing_v1'];
}

/** The newest `limit` jobs (the server already sorts newest first; this keeps the card short). */
export function recentJobs(jobs: InstalledJob[], limit = 5): InstalledJob[] {
  return jobs.slice(0, Math.max(0, limit));
}
