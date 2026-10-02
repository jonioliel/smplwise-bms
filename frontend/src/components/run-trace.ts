import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { aIcon } from './automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { whenText } from '../screens/automations-logic';
import { bidi } from '../i18n/bidi';
import { traceView, type Mode, type RunTrace, type TraceRow } from '../api/automations';

const MODE_LABEL: Record<Mode, string> = { single: 'ריצה אחת בכל פעם', restart: 'התחלה מחדש', queued: 'בתור', parallel: 'במקביל' };

/**
 * CR-017 `<run-trace .trace .mode .now .timeZone>`: "למה זה רץ" (owner decision 9ג): the full trace of one run as the platform shows it, with the
 * short Hebrew sentence on top. Below it: the summary (result, start, duration, who, mode), then three ordered sections - the trigger (with the
 * variables it carried), every condition with passed / failed, and every action step (nested branches indented) with its result, start, duration,
 * the variables it changed and the error that stopped it. Secret-like values arrive masked from the server ("••••", client/traceView masks again);
 * the context user is a display name. The element renders what it is given; it never fetches.
 */
@customElement('run-trace')
export class RunTraceView extends LitElement {
  @property({ attribute: false }) trace: RunTrace | null = null;
  @property() mode: Mode | null = null;
  @property({ attribute: false }) now: Date = new Date();
  @property() timeZone: string | undefined = undefined;

  static styles = [...automationsStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .sum {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px 16px;
      padding: 12px 16px;
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: 13.5px;
    }
    .sum dt {
      color: var(--dv-text-2);
    }
    .sum dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .sec {
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      overflow: hidden;
    }
    .sec > h5 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--dv-text-2);
      background: var(--dv-surface-3);
    }
    .sec > h5 .ic {
      font-size: 14px;
    }
    .sec > h5 .cnt {
      margin-inline-start: auto;
      font-variant-numeric: tabular-nums;
    }
    .row {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      gap: 4px 12px;
      align-items: start;
      padding: 10px 14px;
      border-block-start: 1px solid var(--dv-border);
    }
    .sec > h5 + .row {
      border-block-start: 0;
    }
    .row .st {
      grid-row: 1 / span 2;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .row .st .ic {
      font-size: 15px;
    }
    .row.ok .st {
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
    }
    .row.bad .st {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .row.run .st {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .row.info .st {
      background: var(--dv-warning-soft);
      color: var(--au-warn-text);
    }
    .row .tx {
      font-size: 14px;
      line-height: 1.45;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .row.skip .tx {
      color: var(--dv-text-2);
    }
    .row .err {
      color: var(--dv-danger);
      font-size: 13px;
      margin-block-start: 2px;
    }
    .row .meta {
      grid-row: 1 / span 2;
      grid-column: 3;
      text-align: end;
      font-size: 12px;
      color: var(--dv-text-2);
      font-variant-numeric: tabular-nums;
      display: flex;
      flex-direction: column;
      gap: 2px;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .row .meta code,
    .row .path {
      font-family: var(--sw-font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
      font-size: 11.5px;
      color: var(--dv-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .row .path {
      grid-column: 2;
      text-align: start;
    }
    .vars {
      grid-column: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-block-start: 4px;
    }
    .vars span {
      font-family: var(--sw-font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
      font-size: 11.5px;
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--dv-surface-3);
      color: var(--dv-text);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .vars span b {
      font-weight: 700;
    }
    .row.nest {
      border-inline-start: 2px solid var(--dv-border);
    }
    .skip-note {
      padding: 10px 14px;
      font-size: 13px;
      color: var(--dv-text-2);
    }
    .vlist {
      padding: 10px 14px;
    }
    .vlist .vars {
      grid-column: auto;
      margin: 0;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  private resultChip(id: RunTrace['result'], label: string): TemplateResult {
    const tone = id === 'ok' ? 'ok' : id === 'error' ? 'bad' : id === 'running' ? 'info' : '';
    return html`<span class=${`chip ${tone}`} data-trace-result=${id}>${label}</span>`;
  }

  private statusIcon(r: TraceRow): TemplateResult {
    return r.status === 'ok' ? aIcon('check') : r.status === 'bad' ? aIcon('close') : r.status === 'run' ? aIcon('play') : r.status === 'info' ? aIcon('bolt') : aIcon('minus');
  }

  private vars(v: Array<[string, string]>): TemplateResult | typeof nothing {
    return v.length ? html`<div class="vars">${v.map(([k, x]) => html`<span><bdi>${k}</bdi>: <b>${x}</b></span>`)}</div>` : nothing;
  }

  private row(r: TraceRow, extra = '', varsOverride?: Array<[string, string]>): TemplateResult {
    const pad = r.depth > 0 ? `margin-inline-start:${Math.min(r.depth, 4) * 14}px` : '';
    return html`<div class=${`row ${r.status} ${r.depth > 0 ? 'nest' : ''} ${extra}`} style=${pad} data-trace-row=${r.path}>
      <span class="st">${this.statusIcon(r)}</span>
      <div class="tx">${bidi(r.sentence)}${r.error ? html`<div class="err">${r.error}</div>` : nothing}</div>
      <div class="meta">${r.time ? html`<span>${r.time}</span>` : nothing}${r.duration ? html`<span>${r.duration}</span>` : nothing}</div>
      <code class="path">${r.path}</code>
      ${this.vars(varsOverride ?? r.vars)}
    </div>`;
  }

  render() {
    const t = this.trace;
    if (!t) return nothing;
    const v = traceView(t, { timeZone: this.timeZone });
    const day = whenText(t.at, this.now, this.timeZone).replace(/\s\d\d:\d\d$/, '');
    return html`
      <div class="sentence" data-trace-sentence>${aIcon('help')}<div>${v.sentence}</div></div>
      <dl class="sum" data-trace-summary>
        <dt>תוצאה</dt><dd>${this.resultChip(v.result.id, v.result.label)}</dd>
        <dt>התחלה</dt><dd>${day} ${v.trigger.time ?? v.at}</dd>
        ${v.duration ? html`<dt>משך</dt><dd>${v.duration}</dd>` : nothing}
        <dt>הופעלה על ידי</dt><dd>${v.who}</dd>
        ${this.mode ? html`<dt>מצב</dt><dd>${MODE_LABEL[this.mode] ?? this.mode}</dd>` : nothing}
      </dl>
      <div class="sec" data-trace-trigger>
        <h5>${aIcon('bolt')}טריגר</h5>
        ${this.row({ ...v.trigger, status: 'info' }, '', variablesOf(t))}
      </div>
      <div class="sec" data-trace-conditions>
        <h5>${aIcon('help')}תנאים${v.counts.conditions ? html`<span class="cnt">עברו ${v.counts.conditions_passed}/${v.counts.conditions}</span>` : nothing}</h5>
        ${v.conditions.length ? v.conditions.map((c) => this.row(c)) : html`<div class="skip-note">אין תנאים</div>`}
      </div>
      <div class="sec" data-trace-steps>
        <h5>${aIcon('play')}פעולות${v.counts.steps ? html`<span class="cnt">בוצעו ${v.counts.steps_done}/${v.counts.steps}</span>` : nothing}</h5>
        ${v.steps.length ? v.steps.map((s) => this.row(s)) : html`<div class="skip-note">לא בוצעו פעולות</div>`}
      </div>`;
  }
}

/** The variables of the trigger row: the run's variables (masked), as short "key: value" pairs. */
function variablesOf(t: RunTrace): Array<[string, string]> {
  return traceView(t).variables;
}

declare global {
  interface HTMLElementTagNameMap {
    'run-trace': RunTraceView;
  }
}
