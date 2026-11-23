import { uiLocale } from '../i18n/locale';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { setMultiBuilding } from '../api/mapping';
import { checkGate, loadCheck, orderedFindings, type MultiCheck, type MultiFinding } from '../api/mb-safety';
import { ltrNum } from '../i18n/bidi';
import { tr } from '../i18n/msg/system-b';

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '');
const num = (r: Row, k: string): number => (typeof r[k] === 'number' ? (r[k] as number) : 0);
const names = (list: unknown, max = 4): string => {
  const a = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  return a.length > max ? `${a.slice(0, max).join(', ')} ${tr('ועוד {n}', { n: a.length - max })}` : a.join(', ');
};

/**
 * MULTI-BUILDING-SAFETY-2500 `<mb-enable-check>` (owner 22.11, Q63): the check before the multi-building switch is turned on - the
 * findings the server worked out (blocking / to review / for information), "עברתי על הממצאים", and "הפעל" confirmed with the check's
 * digest. A blocking finding keeps "הפעל" disabled (the server refuses it too). Fires `enabled` when the switch is on, `close` otherwise.
 * Used by הגדרות › בניינים ומיפוי and by the mapping assistant's last step. Without a backend it shows the demo report. Its own events do
 * not bubble (the assistant itself closes on a bubbling `close`), and the inner dialog's `close` stops here.
 */
@customElement('mb-enable-check')
export class MbEnableCheck extends LitElement {
  @property({ type: Boolean }) open = false;
  @state() private report: MultiCheck | null = null;
  @state() private ack = false;
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    .lead {
      margin: 0 0 12px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .list {
      display: grid;
      gap: 8px;
    }
    .f {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 4px 10px;
      align-items: start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .f.blocking {
      background: var(--sw-danger-soft);
    }
    .f.warning {
      background: var(--sw-warning-soft);
    }
    .f > sw-icon {
      margin-block-start: 2px;
      color: var(--sw-text-2);
    }
    .f.blocking > sw-icon {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .f.warning > sw-icon {
      color: var(--sw-warning-text);
    }
    .f b {
      color: var(--sw-heading);
    }
    .f .sev {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      margin-inline-start: 6px;
      color: var(--sw-text-2);
    }
    .f.blocking .sev {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .f ul {
      grid-column: 2;
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .ok {
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      font-size: var(--sw-fs-sm);
    }
    .ack {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-block-start: 12px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      cursor: pointer;
    }
    .ack input {
      inline-size: 18px;
      block-size: 18px;
    }
    .msg {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
      margin-block-start: 8px;
    }
  `;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.report = null;
      this.ack = false;
      this.error = '';
      void this.load();
    }
  }

  private async load() {
    try {
      this.report = await loadCheck();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async enable() {
    const r = this.report;
    if (!r || !checkGate(r, this.ack).canEnable || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const out = await setMultiBuilding(true, r.digest);
      this.dispatchEvent(new CustomEvent('enabled', { detail: out }));
    } catch (err) {
      // the mapping or the permissions changed since the report: show the new one (the person reviews it again)
      if (err instanceof ApiError && (err.code === 'check_stale' || err.code === 'check_blocked')) {
        this.ack = false;
        await this.load();
      }
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private when(iso: string): string {
    const t = new Date(iso);
    return Number.isNaN(t.getTime()) ? iso : t.toLocaleString(uiLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /** The title of a finding and its lines (at most four, then "ועוד N"). */
  private words(f: MultiFinding): { title: string; lines: string[] } {
    const items = f.items as Row[];
    const n = ltrNum(f.count);
    const cut = (lines: string[]) => (f.count > lines.length && lines.length >= 4 ? [...lines.slice(0, 4), tr('ועוד {n}', { n: ltrNum(f.count - 4) })] : lines.slice(0, 4));
    switch (f.code) {
      case 'entity_cross_building':
        return { title: tr('{n} התקנים מוצבים במפה של בניין אחד, אבל האזור שלהם ממופה לבניין אחר', { n }),
          lines: cut(items.map((r) => tr('{name}: במפה של {placed}, ממופה ל{building} (אזור {area})', { name: str(r, 'name'), placed: str(r, 'placed_in'), building: str(r, 'building'), area: str(r, 'area') }))) };
      case 'reach_gain':
        return { title: tr('{n} התקנים יתווספו למי שיש לו הרשאה לבניין', { n }),
          lines: items.map((r) => `${tr('{building}: {devices} התקנים', { building: str(r, 'name'), devices: ltrNum(num(r, 'devices')) })}${num(r, 'sensitive') ? ` · ${tr('{n} רגישים ({names})', { n: ltrNum(num(r, 'sensitive')), names: names(r.sensitive_names, 2) })}` : ''} · ${num(r, 'holders') ? tr('בעלי הרשאה: {names}', { names: names(r.holder_names) }) : tr('אין בעלי הרשאה לבניין')}`).slice(0, 6) };
      case 'single_building':
        return { title: tr('באתר יש בניין אחד. המסך הראשי לא ישתנה, אבל המיפוי ייכנס להרשאות לפי בניין.'), lines: [] };
      case 'mapping_empty':
        return { title: tr('שום אזור עוד לא ממופה לבניין, ולכן ההפעלה לא תשנה כלום.'), lines: [] };
      case 'unmapped_areas':
        return { title: tr('{n} אזורים עם התקנים לא שייכים לאף בניין', { n }), lines: [names(items.map((r) => str(r, 'name')), 8)] };
      case 'versions_since':
        return { title: tr('{n} גרסאות מיפוי הוחלו מאז ההפעלה האחרונה', { n }),
          lines: cut(items.map((r) => tr('גרסה {number} · {when} · {by}', { number: ltrNum(num(r, 'number')), when: this.when(str(r, 'created_at')), by: str(r, 'by') }))) };
      case 'stale_rows':
        return { title: tr('{n} שורות מיפוי מצביעות על קומה או בניין שנמחקו. הן לא נחשבות.', { n }), lines: [] };
      default:
        return { title: f.code, lines: [] };
    }
  }

  private renderFinding(f: MultiFinding) {
    const w = this.words(f);
    const icon = f.severity === 'blocking' ? 'warning' : f.severity === 'warning' ? 'info' : 'check';
    const sev = f.severity === 'blocking' ? tr('חוסם') : f.severity === 'warning' ? tr('לבדיקה') : tr('לידיעה');
    return html`<div class="f ${f.severity}" data-mb-finding=${f.code} data-severity=${f.severity}>
      <sw-icon name=${icon} size=${16}></sw-icon>
      <span><b>${w.title}</b><span class="sev">${sev}</span></span>
      ${w.lines.length ? html`<ul>${w.lines.map((l) => html`<li>${l}</li>`)}</ul>` : nothing}
    </div>`;
  }

  render() {
    if (!this.open) return nothing;
    const r = this.report;
    const gate = checkGate(r, this.ack);
    return html`<sw-dialog open wide heading=${tr('בדיקה לפני הפעלת ריבוי בניינים')} subheading=${tr('מה ישתנה בהרשאות ובמסך הראשי כשמפעילים')} data-mb-check @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      ${r
        ? html`<p class="lead">${r.reach_mode === 'map_and_mapping'
            ? tr('אחרי ההפעלה, מי שיש לו הרשאה לבניין יגיע גם להתקנים שהאזור שלהם ממופה לבניין. עברו על הממצאים לפני שמפעילים.')
            : tr('ההרשאה לבניין היא לפי מיקום במפה בלבד, ולכן המיפוי לא מוסיף הרשאות. עברו על הממצאים לפני שמפעילים.')}</p>
          <div class="list" data-mb-findings>
            ${r.findings.length ? orderedFindings(r).map((f) => this.renderFinding(f)) : html`<div class="ok" data-mb-clean>${tr('לא נמצא שום דבר שדורש בדיקה.')}</div>`}
          </div>
          ${gate.blocked
            ? html`<div class="err" role="alert" data-mb-blocked>${tr('יש ממצא חוסם. תקנו אותו במפה או במיפוי, ואז בדקו שוב. מנהל הרשאות יכול גם להגדיר לדלג על הבדיקה.')}</div>`
            : html`<label class="ack"><input type="checkbox" data-mb-ack .checked=${this.ack} @change=${(e: Event) => (this.ack = (e.target as HTMLInputElement).checked)} />${tr('עברתי על הממצאים')}</label>`}`
        : this.error ? nothing : html`<div class="msg">${tr('בודק…')}</div>`}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => this.close()}>${tr('ביטול')}</sw-button>
      <sw-button slot="footer" variant="primary" icon="building" data-mb-enable ?disabled=${!gate.canEnable || this.busy} @click=${() => void this.enable()}>${tr('הפעל ריבוי בניינים')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mb-enable-check': MbEnableCheck;
  }
}
