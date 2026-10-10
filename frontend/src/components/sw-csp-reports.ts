import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import { api, describeError, get } from '../api/client';
import { patchSettings } from '../api/media';

interface CspRow {
  disposition: 'enforce' | 'report';
  directive: string;
  blocked: string;
  count: number;
  first_at: string;
  last_at: string;
}

interface CspReports {
  mode: 'report_only' | 'enforce';
  rows: CspRow[];
  total: number;
  policy: { enforced: string; report_only: string | null };
}

const BLOCKED_LABEL: Record<string, string> = { inline: 'קוד או עיצוב מוטמע (inline)', eval: 'eval', self: 'מהאתר עצמו', data: 'data:', blob: 'blob:', none: '—', other: 'אחר' };

/**
 * CR-008 P2, הגדרות › גישה מרחוק: the Content-Security-Policy reports of the remote channel (counters per directive
 * and blocked origin - the server keeps nothing else) and the switch that makes the stricter policy enforced once the
 * owner has reviewed them. system.configure only (the parent renders it for administrators).
 */
@customElement('sw-csp-reports')
export class SwCspReports extends LitElement {
  @property({ type: Boolean }) canEdit = false;
  @state() private data: CspReports | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private armed = false;
  @state() private message = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.data = await get<CspReports>('csp-reports');
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async setEnforce(on: boolean) {
    if (!this.armed) {
      this.armed = true;
      return;
    }
    this.armed = false;
    this.busy = true;
    try {
      await patchSettings({ 'remote.csp_enforce': on ? 'true' : 'false' });
      this.message = on ? 'המדיניות המחמירה נאכפת מעכשיו.' : 'המדיניות המחמירה חזרה לדיווח בלבד.';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async clear() {
    this.busy = true;
    try {
      await api('csp-reports', { method: 'DELETE' });
      this.message = 'הספירה אופסה.';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const d = this.data;
    if (!d) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : html`<div class="muted">טוען דיווחים…</div>`;
    const enforcing = d.mode === 'enforce';
    // inline <style> elements seen by browsers: enforcing now would unstyle those screens - fix them first (CR-008 P2 review M4)
    const inlineStyles = d.rows.filter((r) => (r.directive === 'style-src-elem' || r.directive === 'style-src') && r.blocked === 'inline').reduce((n, r) => n + r.count, 0);
    const blocked = !enforcing && inlineStyles > 0;
    return html`
      <div class="mode" data-csp-mode=${d.mode}>
        <sw-badge kind=${enforcing ? 'live' : 'partial'} label=${enforcing ? 'נאכפת' : 'דיווח בלבד'}></sw-badge>
        <span>${enforcing
          ? 'המדיניות המחמירה (בלי עיצוב מוטמע בתגיות style) נאכפת בגישה מרחוק.'
          : 'המדיניות המחמירה נבדקת בדפדפנים ומדווחת, אבל עדיין לא נאכפת. אחרי שעוברים על הדיווחים אפשר לאכוף.'}</span>
      </div>
      ${d.rows.length
        ? html`<table data-csp-table>
            <thead><tr><th>הנחיה</th><th>מה נחסם</th><th>סוג</th><th>כמות</th><th>לאחרונה</th></tr></thead>
            <tbody>${d.rows.map((r) => html`<tr>
              <td class="ltr">${r.directive}</td>
              <td class="ltr">${BLOCKED_LABEL[r.blocked] ?? r.blocked}</td>
              <td>${r.disposition === 'enforce' ? 'נחסם' : 'דיווח'}</td>
              <td>${r.count}</td>
              <td>${new Date(r.last_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
            </tr>`)}</tbody>
          </table>`
        : html`<div class="muted" data-csp-empty>אין דיווחים. דפדפנים שולחים דיווח רק כשמשהו בדף חורג מהמדיניות.</div>`}
      <div class="muted">נשמרות ספירות בלבד (הנחיה, מקור חסום, סוג) - בלי כתובות דפים, תוכן או משתמשים. דיווחים ממקורות לא מוכרים הם לרוב תוספי דפדפן.</div>
      ${this.canEdit && blocked
        ? html`<div class="warn" role="note" data-csp-enforce-blocked>אי אפשר לאכוף עדיין: דפדפנים דיווחו על ${inlineStyles} מקרים של עיצוב מוטמע בתגית style, והאכיפה הייתה משאירה את המסכים האלה בלי עיצוב. אחרי תיקון בגרסה הבאה - לאפס את הספירה ולבדוק שוב.</div>`
        : nothing}
      ${this.canEdit
        ? html`<div class="foot">
            <sw-button size="sm" variant=${this.armed ? (enforcing ? 'secondary' : 'danger') : enforcing ? 'secondary' : 'primary'} icon="shield" data-csp-enforce ?disabled=${this.busy || blocked} @click=${() => void this.setEnforce(!enforcing)}>
              ${this.armed ? 'לאשר?' : enforcing ? 'חזרה לדיווח בלבד' : 'אכוף את המדיניות המחמירה'}
            </sw-button>
            ${this.armed ? html`<sw-button size="sm" variant="ghost" @click=${() => (this.armed = false)}>ביטול</sw-button>` : nothing}
            <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} @click=${() => void this.load()}>רענון</sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" data-csp-clear ?disabled=${this.busy || !d.rows.length} @click=${() => void this.clear()}>איפוס הספירה</sw-button>
          </div>`
        : nothing}
      ${this.message ? html`<div class="ok" role="status">${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .mode {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-xs);
    }
    th,
    td {
      text-align: start;
      padding: 5px 6px;
      border-block-end: 1px solid var(--sw-border);
    }
    th {
      color: var(--sw-text-3);
      font-weight: 500;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .warn {
      padding: 8px;
      border-radius: var(--sw-r-xs);
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-xs);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-csp-reports': SwCspReports;
  }
}
