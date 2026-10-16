import { css, html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import type { TicketDetail } from '../api/tickets';
import type { LinkBlock } from '../api/tickets-s4';
import { flowSteps, type DrawerAction } from './drawer-model';
import { dwt } from './drawer-text';
import { tIcon } from './icons';
import { ballOf, sentenceFor, slaState, statusChip, warningFor, type ViewerRole } from './status-sentence';

/**
 * TKUI1 (release 2.6.0): the request's STATUS BLOCK - the same block in the drawer (520 / 640 / full), on the phone sheet and as the hero of
 * the full page (IA §4.1, mock-up v5 `.stat`). It answers "what is happening and what do I do", and nothing else:
 *   the handler's avatar · ONE status chip (+ the "ממתין לחלק" sub-label) · the one-sentence status (`sentenceFor`, re-announced through ONE
 *   polite live region) · the SLA badge only when near or crossed · ONE ranked warning line · the read-only flow · ONE primary action and at
 *   most one quiet action (everything else is in the header's "⋯" menu).
 * Rendered inside the host's shadow root (`<ticket-detail>`) with `statusBlockStyles`; it never calls the API - `onAction` does.
 */

export interface StatusBlockCtx {
  role: ViewerRole;
  now: Date;
  busy: boolean;
  primary: DrawerAction | null;
  quiet: DrawerAction | null;
  onAction: (a: DrawerAction) => void;
}

/** Two letters of a name for the avatar ("אלון דוד" → "אד"). */
export function initials(name: string | null | undefined): string {
  const w = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

/** One action button of the block (also used by the phone sheet and the page hero). */
export function actionButton(a: DrawerAction, ctx: Pick<StatusBlockCtx, 'busy' | 'onAction'>, slot: 'primary' | 'quiet'): TemplateResult {
  const cls = `btn ${a.tone === 'quiet' ? 'quiet' : a.tone}`;
  return html`<button type="button" class=${cls} data-action=${a.key} ?data-primary=${slot === 'primary'} ?data-quiet=${slot === 'quiet'} ?data-assign=${a.kind === 'assign' || a.kind === 'reassign'}
    ?disabled=${ctx.busy} @click=${() => ctx.onAction(a)}>${tIcon(a.icon)}<span>${a.label}</span></button>`;
}

export function statusBlock(t: TicketDetail & { link?: LinkBlock | null }, ctx: StatusBlockCtx): TemplateResult {
  const chip = statusChip(t);
  const sentence = sentenceFor(t, ctx.role, ctx.now);
  const warn = warningFor(t, ctx.role);
  const sla = slaState(t, ctx.now).badge;
  const a = t.assignee;
  const steps = t.status === 'cancelled' || t.status === 'returned' ? [] : flowSteps(t.status);
  return html`<div class="stat" role="group" aria-label=${dwt('statusGroup')} data-status-block data-ball=${ballOf(t)} data-role=${ctx.role}>
    <div class="st-top">
      ${a ? html`<span class="pair" aria-hidden="true"><span class=${`av sm ${a.kind === 'contact' ? 'ext' : 'int'}`}>${initials(a.name)}</span></span>` : nothing}
      <span class=${`chip lg ${chip.tone}`} data-status-chip=${t.status}><i class=${`dot ${chip.tone === 'ok' ? 'ok' : chip.tone === 'info' ? 'run' : chip.tone === 'warn' ? 'warn' : ''}`}></i>${chip.label}${chip.sub ? html`<span class="subst" data-waiting-sub>${chip.sub}</span>` : nothing}</span>
      <span class="sent" data-sentence aria-live="polite">${bidi(sentence)}</span>
      ${sla ? html`<span class=${`badge sla ${sla.tone}`} data-sla=${sla.tone}>${tIcon('clock')}${sla.text}</span>` : nothing}
    </div>
    ${warn ? html`<div class=${`st-warn ${warn.tone}`} data-warning=${warn.key}>${tIcon('warning')}<span>${warn.text}</span></div>` : nothing}
    ${steps.length ? html`<ol class="flow" aria-label=${dwt('flowLabel')} data-flow>
      ${steps.map((s) => html`<li class=${`fc ${s.state}`} aria-current=${s.state === 'cur' ? 'step' : 'false'}>${s.state === 'done' ? tIcon('check') : nothing}${s.label}</li>`)}
    </ol>` : nothing}
    ${ctx.primary || ctx.quiet ? html`<div class="st-act">
      ${ctx.primary ? actionButton(ctx.primary, ctx, 'primary') : nothing}
      ${ctx.quiet ? actionButton(ctx.quiet, ctx, 'quiet') : nothing}
    </div>` : nothing}
  </div>`;
}

/** Tokens only (tests/unit-token-lint.spec.ts): the `--dv-*` glass palette + the `--sw-*` type / radius scale; logical properties only. */
export const statusBlockStyles = css`
  .stat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px 12px;
    border-block-end: 1px solid var(--dv-border);
    background: linear-gradient(180deg, var(--dv-accent-soft), color-mix(in srgb, var(--dv-accent-soft) 30%, transparent));
  }
  .st-top {
    display: flex;
    align-items: center;
    gap: 8px 10px;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  .st-top .sent {
    flex: 1 1 220px;
    min-inline-size: 0;
    font-size: var(--sw-fs-lg);
    font-weight: 500;
    line-height: 1.35;
    color: var(--dv-text);
    overflow-wrap: anywhere;
  }
  .chip.lg {
    block-size: 30px;
    padding-inline: 12px;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    flex: none;
  }
  .chip .dot {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .chip .subst {
    font-weight: 500;
    padding-inline-start: 6px;
    margin-inline-start: 2px;
    border-inline-start: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  }
  .pair {
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .av {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    flex: none;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .av.sm {
    inline-size: 28px;
    block-size: 28px;
    font-size: var(--sw-fs-xs);
  }
  .av.lg {
    inline-size: 44px;
    block-size: 44px;
    font-size: var(--sw-fs-md);
  }
  .av.int {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .av.ext {
    background: var(--dv-surface-3);
    color: var(--dv-text);
    box-shadow: inset 0 0 0 1px var(--dv-border-strong, var(--dv-border));
  }
  .badge.sla {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 26px;
    padding-inline: 10px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    white-space: nowrap;
    margin-inline-start: auto;
  }
  .badge.sla.warn {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .badge.sla.bad {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
  }
  .st-warn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--au-warn-text);
  }
  .st-warn.bad {
    color: var(--dv-danger);
  }
  .st-warn .ic {
    flex: none;
    font-size: var(--sw-fs-md);
  }
  .flow {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .flow .fc {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 26px;
    padding-inline: 10px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    background: var(--dv-surface-3);
    color: var(--dv-text-3);
  }
  .flow .fc.done {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .flow .fc.cur {
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
  }
  .flow .fc .ic {
    font-size: var(--sw-fs-xs);
  }
  .st-act {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .st-act .btn {
    min-block-size: 40px;
  }
  /* the mock-up's placement (the quiet push at the start, the primary at the end) while the focus order stays primary → quiet (IA §4.5) */
  .st-act [data-primary] {
    order: 2;
    margin-inline-start: auto;
  }
  .btn.success {
    background: var(--dv-success);
    border-color: transparent;
    color: var(--sw-text-inverse);
    box-shadow: none;
  }
  .btn.danger {
    color: var(--sw-text-inverse);
  }
  @media (max-width: 767px) {
    .stat {
      padding: 12px 14px 10px;
    }
    .st-top .sent {
      font-size: var(--sw-fs-md);
      flex-basis: 100%;
    }
    .badge.sla {
      margin-inline-start: 0;
    }
    .flow .fc {
      block-size: 24px;
      padding-inline: 8px;
    }
    .st-act {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .st-act .btn {
      inline-size: 100%;
      min-block-size: 44px;
    }
    .st-act [data-primary] {
      order: 0;
      margin-inline-start: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .st-act .btn {
      transition: none;
    }
  }
`;
