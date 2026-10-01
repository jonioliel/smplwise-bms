import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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
  type WiskeyOperatorDiagnostics,
} from '../api/intercom';
import type { StateKind } from '../components/sw-badge';
import { formatTime, UTC_ZONE } from './wiskey-format';

const AREAS: Array<[keyof WiskeyAuthorization['areas'], string]> = [
  ['overview', 'סקירה'],
  ['users', 'אנשים'],
  ['events', 'אירועים'],
  ['stations', 'עמדות'],
  ['management', 'ניהול'],
];
const FIELDS: Array<[keyof WiskeyAuthorization['fields'], string]> = [
  ['phone', 'טלפון'],
  ['photo', 'תמונה'],
  ['credentials', 'אישורי כניסה'],
  ['profile', 'פרופיל'],
  ['access', 'גישה'],
];
const LEVEL: Record<WiskeyLevel, string> = { none: 'אין', view: 'צפייה', manage: 'ניהול', unknown: 'לא ידוע' };

const STATE_TEXT: Record<string, string> = {
  ready: 'מחובר',
  connecting: 'מתחבר',
  ha_unavailable: 'תשתית המערכת אינה זמינה',
  ha_not_configured: 'אין גישה לתשתית המערכת',
  not_installed: 'WisKey אינו מותקן',
  forbidden: 'WisKey דחה את החשבון',
  error: 'שגיאה',
  not_configured: 'לא הוגדר',
  shares_service_identity: 'משתמש בזהות השירות',
};
const AUTH_STATE_TEXT: Record<string, string> = {
  ok: 'התקבלה תשובה',
  not_asked: 'לא נבדק',
  not_ready: 'הערוץ אינו מחובר',
  forbidden: 'WisKey דחה את הבקשה',
  unauthorized: 'WisKey דחה את הבקשה',
  rate_limited: 'נבדק הרגע - נסו שוב בעוד כמה שניות',
  busy: 'ממתין לבקשה קודמת',
  timeout: 'לא התקבלה תשובה בזמן',
  invalid_response: 'התשובה אינה בפורמט המוכר',
  token_invalid: 'האסימון של המשתמש אינו תקף',
  ha_unavailable: 'תשתית המערכת אינה זמינה',
};
const SUBSCRIBE_TEXT: Record<string, string> = { ok: 'פעילה', not_attempted: 'לא נוסתה', 'n/a': 'לא רלוונטי' };

const FINDING_TEXT: Record<string, string> = {
  service_identity_is_admin: 'זהות השירות היא מנהל ב־WisKey. זה המצב הנוכחי של הכתיבות הקיימות (שחרור דלת, אנשים, כרטיסים).',
  background_shares_service_identity: 'ערוץ הרקע עדיין משתמש בזהות השירות (מנהל). אחרי שבעל המוצר יוצר משתמש רקע ייעודי ומגדיר את האסימון שלו, הערוץ מתפצל לחיבור משלו.',
  background_is_admin: 'חשבון הרקע הוא מנהל ב־WisKey. הוא אמור להיות משתמש רגיל עם צפייה בסקירה בלבד.',
  background_cannot_read_overview: 'לחשבון הרקע אין צפייה בסקירה, ולכן ערוץ הרקע לא יקבל נתונים.',
  background_has_more_than_overview: 'לחשבון הרקע יש הרשאות מעבר לסקירה. ההמלצה: כל שאר האזורים והשדות ברמת "אין".',
  background_scope_is_all_stations: 'חשבון הרקע רואה את כל העמדות. ההמלצה: היקף עמדות מפורש וצר.',
  background_authorization_unavailable: 'לא התקבלה תשובת הרשאות מערוץ הרקע.',
  background_subscribe_not_live: 'ההרשמה לעדכונים של ערוץ הרקע אינה פעילה; הערוץ מתעדכן רק בבדיקה תקופתית.',
  service_subscribe_not_live: 'ההרשמה לעדכונים של זהות השירות אינה פעילה.',
  connection_locked: 'החיבור נעול ב־WisKey. קריאות יידחו עד שהמשתמש יפתח אותו ב־WisKey; Arx לא מנסה לעקוף.',
  idle_or_reauth_configured: 'ב־WisKey מוגדר idle או אימות חוזר: חיבור חדש של מפעיל ייפתח נעול, ולכן Arx יציג "פתח ב־WisKey".',
  operator_has_no_wiskey_access: 'ל־WisKey אין גישה למשתמש הנוכחי.',
};
const SUBJECT_TEXT: Record<string, string> = { service: 'זהות השירות', background: 'ערוץ הרקע', operator: 'המפעיל' };

function stateKind(state: string): StateKind {
  return state === 'ready' ? 'live' : state === 'connecting' ? 'unknown' : state === 'forbidden' ? 'forbidden' : state === 'error' ? 'error' : state === 'shares_service_identity' ? 'stale' : 'offline';
}

/**
 * הגדרות › בקרות כניסה › "WisKey רואה את Arx כ־" (B0, read-only, system administrators). WisKey's own answer to "who am I
 * talking to": one `authorization/session` per identity Arx uses - the service identity (the add-on's user, which also carries
 * the existing writes), the background channel (its own account once the owner creates it; until then it says it shares the
 * service identity) and, in the `/arx` channel only, the signed-in operator. Permission facts only; nothing is changed in WisKey.
 * The call is made on request, not on every visit.
 */
@customElement('system-wiskey-diagnostics')
export class SystemWiskeyDiagnostics extends LitElement {
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
      border-radius: 10px;
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
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    bdi {
      unicode-bidi: isolate;
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
        <span>${a.is_admin ? 'מנהל ב־WisKey' : a.is_admin === false ? 'לא מנהל' : 'מנהל: לא ידוע'}</span>
        <span>${a.allowed === false ? 'הגישה נדחתה' : a.allowed ? 'הגישה מאושרת' : 'גישה: לא ידוע'}</span>
        <span>עמדות: ${scope.kind === 'all' ? 'כולן' : scope.kind === 'explicit' ? `${scope.count ?? scope.ids.length} מפורשות` : 'לא ידוע'}</span>
        ${sec ? html`<span>${sec.locked ? 'החיבור נעול' : sec.locked === false ? 'החיבור פתוח' : 'נעילה: לא ידוע'}${sec.idle_minutes ? ` · idle ${sec.idle_minutes} דק׳` : ''}${sec.reauth_sensitive ? ' · אימות חוזר' : ''}</span>` : html`<span class="muted">אין הגדרת נעילה ב־WisKey</span>`}
      </div>
      <div class="chips" aria-label="אזורים">${AREAS.map(([k, label]) => html`<span class="chip ${a.areas[k] === 'none' ? '' : 'on'}">${label}: ${LEVEL[a.areas[k]]}</span>`)}</div>
      <div class="chips" aria-label="שדות">${FIELDS.map(([k, label]) => html`<span class="chip ${a.fields[k] === 'none' ? '' : 'on'}">${label}: ${LEVEL[a.fields[k]]}</span>`)}</div>`;
  }

  private renderIdentity(title: string, id: WiskeyIdentityDiagnostics, key: string) {
    const stateText = STATE_TEXT[id.state] ?? id.state;
    return html`<div class="block" data-wk-diag=${key}>
      <div class="head"><span>${title}</span><sw-badge kind=${stateKind(id.state)} label=${stateText}></sw-badge></div>
      <div class="facts">
        ${id.wiskey_version ? html`<span>WisKey <bdi>${id.wiskey_version}</bdi></span>` : nothing}
        <span>הרשמה לעדכונים: ${SUBSCRIBE_TEXT[id.subscribe] ?? id.subscribe}</span>
      </div>
      ${this.renderAuth(id.authorization, AUTH_STATE_TEXT[id.authorization_state] ?? id.authorization_state)}
    </div>`;
  }

  private renderOperator(op: WiskeyOperatorDiagnostics) {
    return html`<div class="block" data-wk-diag="operator">
      <div class="head"><span>המפעיל הנוכחי (במסלול /arx)</span></div>
      ${op.available
        ? this.renderAuth(op.authorization, AUTH_STATE_TEXT[op.state] ?? op.state)
        : html`<div class="muted" data-wk-diag-auth-state>בכניסה דרך Ingress או בכניסת מפתחים אין אסימון משתמש בשרת, ולכן אין כאן בדיקה בזהות המפעיל. היא זמינה כשנכנסים דרך /arx.</div>`}
    </div>`;
  }

  private renderFinding(f: WiskeyFinding) {
    return html`<div class="finding ${f.level}" data-wk-diag-finding=${f.code}><b>${SUBJECT_TEXT[f.subject]}:</b> ${FINDING_TEXT[f.code] ?? f.code}</div>`;
  }

  render() {
    if (!isApi()) return nothing;
    if (!can('system.configure')) return nothing;
    const d = this.data;
    return html`<sw-card heading="WisKey רואה את Arx כ־" subheading="קריאה בלבד: מה ש־WisKey מדווח על זהות החיבורים של Arx אליו. הבדיקה נעשית לפי בקשה." data-wk-diag-card>
      <div class="block">
        <div class="head"><span class="muted">${d ? html`נבדק ב־<bdi>${formatTime(d.generated_at, 'he-IL', UTC_ZONE)}</bdi>` : 'עדיין לא נבדק'}</span>
          <sw-button size="sm" variant="primary" icon="refresh" data-wk-diag-run ?disabled=${this.busy} @click=${() => this.run()}>${this.busy ? 'בודק…' : d ? 'בדיקה מחדש' : 'בדיקה'}</sw-button></div>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      ${d
        ? html`${this.renderIdentity('זהות השירות (המשתמש של ה־add-on)', d.service, 'service')}
            ${this.renderIdentity('ערוץ הרקע', d.background, 'background')} ${this.renderOperator(d.operator)}
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
