import { uiLocale } from '../i18n/locale';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import { describeError } from '../api/client';
import { isApi, can } from '../api/session';
import {
  getWiskeyDiagnostics,
  type WiskeyAuthorization,
  type WiskeyDiagnostics,
  type WiskeyFinding,
  type WiskeyIdentityDiagnostics,
  type WiskeyLevel,
} from '../api/intercom';
import type { StateKind } from '../components/sw-badge';
import { formatTime, UTC_ZONE } from './wiskey-format';
import { emitFoldSummary } from '../access-control/settings-cards-logic';
import { fill, sct } from '../i18n/settings-cards';
import { tr } from '../i18n/msg/system-b';

const AREAS: Array<[keyof WiskeyAuthorization['areas'], string]> = [
  ['overview', tr('סקירה')],
  ['users', tr('אנשים')],
  ['events', tr('אירועים')],
  ['stations', tr('עמדות')],
  ['management', tr('ניהול')],
];
const FIELDS: Array<[keyof WiskeyAuthorization['fields'], string]> = [
  ['phone', tr('טלפון')],
  ['photo', tr('תמונה')],
  ['credentials', tr('אישורי כניסה')],
  ['profile', tr('פרופיל')],
  ['access', tr('גישה')],
];
const LEVEL: Record<WiskeyLevel, string> = { none: tr('אין'), view: tr('צפייה'), manage: tr('ניהול'), unknown: tr('לא ידוע') };

const STATE_TEXT: Record<string, string> = {
  ready: tr('מחובר'),
  connecting: tr('מתחבר'),
  ha_unavailable: tr('תשתית המערכת אינה זמינה'),
  ha_not_configured: tr('אין גישה לתשתית המערכת'),
  not_installed: tr('WisKey אינו מותקן'),
  forbidden: tr('WisKey דחה את החשבון'),
  error: tr('שגיאה'),
  not_configured: tr('לא הוגדר'),
  shares_service_identity: tr('משתמש בזהות השירות'),
};
const AUTH_STATE_TEXT: Record<string, string> = {
  ok: tr('התקבלה תשובה'),
  not_asked: tr('לא נבדק'),
  not_ready: tr('הערוץ אינו מחובר'),
  forbidden: tr('WisKey דחה את הבקשה'),
  unauthorized: tr('WisKey דחה את הבקשה'),
  rate_limited: tr('נבדק הרגע - נסו שוב בעוד כמה שניות'),
  busy: tr('ממתין לבקשה קודמת'),
  timeout: tr('לא התקבלה תשובה בזמן'),
  invalid_response: tr('התשובה אינה בפורמט המוכר'),
  ha_unavailable: tr('תשתית המערכת אינה זמינה'),
};
const SUBSCRIBE_TEXT: Record<string, string> = { ok: tr('פעילה'), not_attempted: tr('לא נוסתה'), 'n/a': tr('לא רלוונטי') };

const FINDING_TEXT: Record<string, string> = {
  service_identity_is_admin: tr('זהות השירות היא מנהל ב־WisKey. זה המצב הנוכחי של הכתיבות הקיימות (שחרור דלת, אנשים, כרטיסים).'),
  background_shares_service_identity: tr('ערוץ הרקע עדיין משתמש בזהות השירות (מנהל). אחרי שבעל המוצר יוצר משתמש רקע ייעודי ומגדיר את האסימון שלו, הערוץ מתפצל לחיבור משלו.'),
  background_is_admin: tr('חשבון הרקע הוא מנהל ב־WisKey. הוא אמור להיות משתמש רגיל עם צפייה בסקירה בלבד.'),
  background_cannot_read_overview: tr('לחשבון הרקע אין צפייה בסקירה, ולכן ערוץ הרקע לא יקבל נתונים.'),
  background_has_more_than_overview: tr('לחשבון הרקע יש הרשאות מעבר לסקירה. ההמלצה: כל שאר האזורים והשדות ברמת "אין".'),
  background_scope_is_all_stations: tr('חשבון הרקע רואה את כל העמדות. ההמלצה: היקף עמדות מפורש וצר.'),
  background_authorization_unavailable: tr('לא התקבלה תשובת הרשאות מערוץ הרקע.'),
  background_subscribe_not_live: tr('ההרשמה לעדכונים של ערוץ הרקע אינה פעילה; הערוץ מתעדכן רק בבדיקה תקופתית.'),
  service_subscribe_not_live: tr('ההרשמה לעדכונים של זהות השירות אינה פעילה.'),
  connection_locked: tr('החיבור נעול ב־WisKey. קריאות יידחו עד שהמשתמש יפתח אותו ב־WisKey; Arx לא מנסה לעקוף.'),
  idle_or_reauth_configured: tr('ב־WisKey מוגדר זמן נעילה או אימות חוזר. אם הם יחולו על חיבור של Arx, פעולות יידחו עד שיפתחו בחלון האינטרקום.'),
};
const SUBJECT_TEXT: Record<string, string> = { service: tr('זהות השירות'), background: tr('ערוץ הרקע') };

function stateKind(state: string): StateKind {
  return state === 'ready' ? 'live' : state === 'connecting' ? 'unknown' : state === 'forbidden' ? 'forbidden' : state === 'error' ? 'error' : state === 'shares_service_identity' ? 'stale' : 'offline';
}

/**
 * הגדרות › מתגי מסכי כניסה › "WisKey רואה את Arx כ־" (B0, read-only, system administrators). WisKey's own answer to "who am I
 * talking to": one `authorization/session` per identity Arx uses - the service identity (the add-on's user, which also carries
 * the existing writes) and the background channel (its own account once the owner creates it; until then it says it shares the
 * service identity), plus the commands each channel may send. Permission facts only; nothing is changed in WisKey. The call is
 * made on request, not on every visit, and each run is audited server-side. (B0 also asked as the signed-in operator; CR-036
 * makes Arx RBAC the authority, so that probe was not ported.)
 */
@customElement('system-wiskey-diagnostics')
export class SystemWiskeyDiagnostics extends LitElement {
  /** SETTINGS-INTERCOM-CARDS-2401: drawn inside a card of layout a - no heading of its own; the summary line is reported instead. */
  @property({ type: Boolean, reflect: true }) bare = false;
  @state() private data: WiskeyDiagnostics | null = null;
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .block:last-of-type {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      font-size: var(--sw-fs-sm);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .chip.on {
      background: var(--sw-accent-soft);
    }
    .finding {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
      background: var(--sw-surface-2);
    }
    .finding.warn {
      background: var(--sw-warning-soft);
    }
    .findings {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-block-start: 10px;
    }
    .err {
      align-self: flex-start;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    bdi {
      unicode-bidi: isolate;
    }
    /* POLISH4-WP7: on a phone the head (label + check key) wraps and the key takes the line; the facts stack */
    @media (max-width: 767px) {
      .head {
        flex-wrap: wrap;
      }
      .head sw-button {
        flex: 1 1 100%;
      }
      .facts {
        flex-direction: column;
        gap: 4px;
      }
    }
  `;

  private async run() {
    this.busy = true;
    this.error = '';
    try {
      this.data = await getWiskeyDiagnostics();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderAuth(a: WiskeyAuthorization | null, stateText: string) {
    if (!a) return html`<div class="muted" data-wk-diag-auth-state>${stateText}</div>`;
    const sec = a.security;
    const scope = a.station_scope;
    return html`
      <div class="facts" data-wk-diag-identity>
        <span>${a.is_admin ? tr('מנהל ב־WisKey') : a.is_admin === false ? tr('לא מנהל') : tr('מנהל: לא ידוע')}</span>
        <span>${a.allowed === false ? tr('הגישה נדחתה') : a.allowed ? tr('הגישה מאושרת') : tr('גישה: לא ידוע')}</span>
        <span>${tr('עמדות:')} ${scope.kind === 'all' ? tr('כולן') : scope.kind === 'explicit' ? tr('{n} מפורשות', { n: scope.count ?? scope.ids.length }) : tr('לא ידוע')}</span>
        ${sec ? html`<span>${sec.locked ? tr('החיבור נעול') : sec.locked === false ? tr('החיבור פתוח') : tr('נעילה: לא ידוע')}${sec.idle_minutes ? ` · idle ${tr('{n} דק׳', { n: sec.idle_minutes })}` : ''}${sec.reauth_sensitive ? ` · ${tr('אימות חוזר')}` : ''}</span>` : html`<span class="muted">${tr('אין הגדרת נעילה ב־WisKey')}</span>`}
      </div>
      <div class="chips" aria-label=${tr('אזורים')}>${AREAS.map(([k, label]) => html`<span class="chip ${a.areas[k] === 'none' ? '' : 'on'}">${label}: ${LEVEL[a.areas[k]]}</span>`)}</div>
      <div class="chips" aria-label=${tr('שדות')}>${FIELDS.map(([k, label]) => html`<span class="chip ${a.fields[k] === 'none' ? '' : 'on'}">${label}: ${LEVEL[a.fields[k]]}</span>`)}</div>`;
  }

  private renderIdentity(title: string, id: WiskeyIdentityDiagnostics, key: string) {
    const stateText = STATE_TEXT[id.state] ?? id.state;
    return html`<div class="block" data-wk-diag=${key}>
      <div class="head"><span>${title}</span><sw-badge kind=${stateKind(id.state)} label=${stateText}></sw-badge></div>
      <div class="facts">
        ${id.wiskey_version ? html`<span>WisKey <bdi>${id.wiskey_version}</bdi></span>` : nothing}
        <span>${tr('הרשמה לעדכונים:')} ${SUBSCRIBE_TEXT[id.subscribe] ?? id.subscribe}</span>
      </div>
      ${this.renderAuth(id.authorization, AUTH_STATE_TEXT[id.authorization_state] ?? id.authorization_state)}
    </div>`;
  }

  private renderChannels(c: WiskeyDiagnostics['channels']) {
    return html`<div class="block" data-wk-diag="channels">
      <div class="head"><span>${tr('פקודות מותרות לכל ערוץ')}</span></div>
      <div class="facts"><span>${tr('ערוץ הרקע:')} <bdi>${c.background.join(', ')}</bdi></span></div>
      <div class="facts"><span>${tr('זהות השירות, קריאה:')} <bdi>${c.service.reads.join(', ')}</bdi></span></div>
      <div class="facts"><span>${tr('זהות השירות, כתיבה:')} <bdi>${c.service.writes.join(', ')}</bdi></span></div>
    </div>`;
  }

  private renderFinding(f: WiskeyFinding) {
    return html`<div class="finding ${f.level}" data-wk-diag-finding=${f.code}><b>${SUBJECT_TEXT[f.subject]}:</b> ${FINDING_TEXT[f.code] ?? f.code}</div>`;
  }

  /** SETTINGS-INTERCOM-CARDS-2401: the one-line summary (the card's header in layout a): not checked yet, or each identity's state. */
  summary(): string {
    const t = sct().sum;
    const d = this.data;
    if (this.busy) return sct().sum.loading;
    if (!d) return this.error ? t.diagFailed : t.diagIdle;
    return fill(t.diag, { service: STATE_TEXT[d.service.state] ?? d.service.state, background: STATE_TEXT[d.background.state] ?? d.background.state });
  }

  protected updated(): void {
    if (this.bare) emitFoldSummary(this, { card: 'diagnostics', summary: this.summary(), present: isApi() && can('system.configure') });
  }

  render() {
    if (!isApi()) return nothing;
    if (!can('system.configure')) return nothing;
    const d = this.data;
    return html`<sw-card heading=${this.bare ? '' : tr('WisKey רואה את Arx כ־')} subheading=${this.bare ? '' : tr('קריאה בלבד: מה ש־WisKey מדווח על זהות החיבורים של Arx אליו. הבדיקה נעשית לפי בקשה.')} data-wk-diag-card>
      <div class="block">
        <div class="head"><span class="muted">${d ? html`${tr('נבדק ב־')}<bdi>${formatTime(d.generated_at, uiLocale(), UTC_ZONE)}</bdi>` : tr('עדיין לא נבדק')}</span>
          <sw-button size="sm" variant="primary" icon="refresh" data-wk-diag-run ?disabled=${this.busy} @click=${() => this.run()}>${this.busy ? tr('בודק…') : d ? tr('בדיקה מחדש') : tr('בדיקה')}</sw-button></div>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      ${d
        ? html`${this.renderIdentity(tr('זהות השירות (המשתמש של ה־add-on)'), d.service, 'service')}
            ${this.renderIdentity(tr('ערוץ הרקע'), d.background, 'background')} ${this.renderChannels(d.channels)}
            ${d.findings.length ? html`<div class="findings">${d.findings.map((f) => this.renderFinding(f))}</div>` : nothing}`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-wiskey-diagnostics': SystemWiskeyDiagnostics;
  }
}
