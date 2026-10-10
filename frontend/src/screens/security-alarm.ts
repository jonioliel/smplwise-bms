import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import {
  ARM_LABEL,
  CODE_ERROR_LABEL,
  alarmPanels,
  panelAction,
  panelState,
  setMyPin,
  zoneBypass,
  zoneState,
  type AlarmAction,
  type AlarmPanel,
  type AlarmPanels,
  type AlarmZone,
  type CodePrompt,
} from '../api/alarm';
import { ApiError, describeError } from '../api/client';
import { awaitAction, subscribeHa, type HaActionRecord } from '../api/ha';
import { noteAlarmPanels } from '../api/alarm-presence';
import { isApi, onSession } from '../api/session';
import { navigate, parseRoute } from '../router';
import { DEMO_ALARM } from '../fixtures/alarm-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type Filter = 'all' | 'open' | 'bypassed' | 'faults';

/** What the keypad / confirmation is about to send. */
interface Pending {
  kind: 'panel' | 'bypass';
  action: AlarmAction | 'bypass_on' | 'bypass_off';
  panel: AlarmPanel;
  zone?: AlarmZone;
  prompt: CodePrompt;
  needsConfirm: boolean;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'open', label: 'פתוחים בלבד' },
  { id: 'bypassed', label: 'עקופים' },
  { id: 'faults', label: 'תקלות' },
];

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.round(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} שע׳`;
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * הגדרות › אבטחה › אזעקה (CR-010, moved from אבטחה › אזעקה 2026-09-30): the intrusion alarm - per panel a state card with the arm modes it supports and disarm, a
 * "ready to arm" summary, and its zones grouped by area with live state and the bypass switch of each. Codes are typed
 * into a masked keypad dialog (numeric keypad, no autocomplete) that is cleared when it closes and after sending; the
 * code never leaves this component except in the body of the one request that needs it.
 */
@customElement('security-alarm')
export class SecurityAlarm extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property() panelId = '';
  @state() private data: AlarmPanels | null = null;
  @state() private error = '';
  @state() private loading = true;
  @state() private filter: Filter = 'all';
  @state() private pending: Pending | null = null;
  @state() private code = '';
  @state() private codeError = '';
  @state() private busy = false;
  @state() private sent: { label: string; record: HaActionRecord | null; entity: string } | null = null;
  @state() private toast = '';
  @state() private pinOpen = false;
  @state() private pinForm = { current: '', next: '', again: '', panel: '' };
  @state() private pinError = '';
  private stopHa?: () => void;
  private stopSession?: () => void;
  private refetchTimer = 0;
  private pollTimer = 0;
  private toastTimer = 0;
  private watched = new Set<string>();

  static styles = [css`
    :host {
      display: block;
      --al-ok: var(--sw-success);
      --al-open: var(--sw-warning);
      --al-fault: var(--sw-danger);
      --al-bypass: var(--sw-purple);
      --al-motion: var(--sw-accent);
    }
    .switcher {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .switcher button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      border-radius: var(--sw-r-pill);
      padding: 6px 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
    }
    .switcher button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      flex: none;
    }
    .dot.disarmed {
      background: var(--al-ok);
    }
    .dot.armed,
    .dot.partial {
      background: var(--al-bypass);
    }
    .dot.pending {
      background: var(--al-open);
    }
    .dot.triggered {
      background: var(--al-fault);
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px 20px;
      align-items: center;
      padding: 20px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-2);
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 6px;
      background: var(--tone, var(--sw-offline));
    }
    .hero[data-tone='disarmed'] {
      --tone: var(--al-ok);
    }
    .hero[data-tone='armed'] {
      --tone: #6d28d9;
    }
    .hero[data-tone='partial'] {
      --tone: var(--al-bypass);
    }
    .hero[data-tone='pending'] {
      --tone: var(--al-open);
    }
    .hero[data-tone='triggered'] {
      --tone: var(--al-fault);
      background: color-mix(in srgb, var(--al-fault) 8%, var(--sw-surface));
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--al-fault) 35%, transparent);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .hero[data-tone='triggered'] {
        animation: none;
      }
    }
    .state-row {
      display: flex;
      align-items: center;
      gap: 14px;
      min-inline-size: 0;
    }
    .shield {
      inline-size: 56px;
      block-size: 56px;
      border-radius: var(--sw-r-lg);
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--tone, var(--sw-offline)) 14%, var(--sw-surface));
      color: var(--tone, var(--sw-offline));
      flex: none;
    }
    .state-label {
      font-size: clamp(22px, 5vw, 30px);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      line-height: 1.15;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-start: 4px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .actions sw-button {
      min-inline-size: 110px;
    }
    .ready {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .ready.no {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .ready ul {
      margin: 4px 0 0;
      padding-inline-start: 18px;
    }
    .sent {
      grid-column: 1 / -1;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chips button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      cursor: pointer;
      color: var(--sw-text-2);
      min-block-size: 32px;
    }
    .chips button[aria-pressed='true'] {
      background: var(--sw-text);
      color: var(--sw-surface);
      border-color: var(--sw-text);
    }
    .counts {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    h3 {
      margin: 6px 0 8px;
      font-size: var(--sw-fs-md);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 10px;
    }
    .zone {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 12px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
    }
    .zone[data-tone='open'] {
      border-color: color-mix(in srgb, var(--al-open) 55%, var(--sw-border));
    }
    .zone[data-tone='fault'] {
      border-color: color-mix(in srgb, var(--al-fault) 55%, var(--sw-border));
    }
    .zone[data-tone='bypassed'] {
      background: color-mix(in srgb, var(--al-bypass) 6%, var(--sw-surface));
    }
    .zicon {
      inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .zone[data-tone='open'] .zicon {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .zone[data-tone='fault'] .zicon {
      background: var(--sw-danger-soft);
      color: var(--al-fault);
    }
    .zone[data-tone='bypassed'] .zicon {
      background: color-mix(in srgb, var(--al-bypass) 14%, var(--sw-surface));
      color: var(--al-bypass);
    }
    .zone[data-tone='motion'] .zicon {
      background: var(--sw-accent-soft);
      color: var(--al-motion);
    }
    .zname {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .zsub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      grid-column: 2 / 3;
    }
    .zstate {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .zone[data-tone='open'] .zstate {
      color: var(--sw-warning-text);
    }
    .zone[data-tone='fault'] .zstate {
      color: var(--al-fault);
    }
    .zone[data-tone='bypassed'] .zstate {
      color: var(--al-bypass);
    }
    .zone[data-tone='ok'] .zstate {
      color: var(--sw-success-text);
    }
    .flag {
      color: var(--al-fault);
    }
    .bypass {
      grid-row: 1 / span 2;
      grid-column: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
    }
    button.tgl {
      inline-size: 46px;
      block-size: 28px;
      border-radius: 999px;
      border: 0;
      background: var(--sw-border-strong);
      position: relative;
      cursor: pointer;
      padding: 0;
    }
    button.tgl::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: var(--sw-shadow-1);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    button.tgl[aria-checked='true'] {
      background: var(--al-bypass);
    }
    button.tgl[aria-checked='true']::after {
      transform: translateX(-18px);
    }
    button.tgl:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    button.tgl:focus-visible,
    .keys button:focus-visible,
    .switcher button:focus-visible,
    .chips button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    details.unpaired {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 8px 12px;
    }
    details.unpaired li {
      margin-block: 2px;
    }
    .keypad {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
    .keypad input {
      font: inherit;
      font-size: var(--sw-fs-3xl);
      letter-spacing: 0.4em;
      text-align: center;
      padding: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      direction: ltr;
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .keys {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      direction: ltr;
    }
    .keys button {
      font: inherit;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-semibold);
      min-block-size: 56px;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .keys button:active {
      background: var(--sw-accent-soft);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .pinform {
      display: grid;
      gap: 8px;
    }
    .pinform input {
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      direction: ltr;
      text-align: center;
      letter-spacing: 0.3em;
    }
    .toast {
      position: fixed;
      inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom, 0px));
      inset-inline-start: 50%;
      transform: translateX(50%);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      padding: 10px 16px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      z-index: var(--sw-z-toast);
      max-inline-size: calc(100vw - 32px);
    }
    @media (max-width: 767px) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
        padding: 16px;
      }
      .actions {
        justify-content: stretch;
      }
      .actions sw-button {
        flex: 1 1 40%;
        min-inline-size: 0;
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stopSession = onSession((s) => {
      if (s.mode === 'loading') return;
      void this.load();
      if (s.mode === 'api' && !this.stopHa) {
        this.stopHa = subscribeHa((m) => {
          if (m.type === 'entity_state_changed' && this.watched.has(m.entity.entity_id)) this.scheduleRefetch();
          if (m.type === 'structure_changed') this.scheduleRefetch();
        });
        // a fallback for anything the push does not carry (a floor-scoped reader's unplaced zones, a dropped socket)
        this.pollTimer = window.setInterval(() => void this.load(true), 15_000);
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopHa?.();
    this.stopSession?.();
    window.clearInterval(this.pollTimer);
    window.clearTimeout(this.refetchTimer);
    window.clearTimeout(this.toastTimer);
    this.clearCode();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('panelId') && !this.panelId) {
      const p = parseRoute().params.get('panel');
      if (p) this.panelId = p;
    }
  }

  private scheduleRefetch() {
    window.clearTimeout(this.refetchTimer);
    this.refetchTimer = window.setTimeout(() => void this.load(true), 250);
  }

  private async load(quiet = false) {
    if (!quiet) this.loading = !this.data;
    try {
      this.data = isApi() ? await alarmPanels() : DEMO_ALARM;
      if (isApi()) noteAlarmPanels(this.data.panels.length); // the navigation's "is there a panel" answer, refreshed for free
      this.error = '';
      this.watched = new Set(this.data.panels.flatMap((p) => [p.entity_id, ...p.zones.flatMap((z) => [z.entity_id, ...z.aux, ...(z.bypass ? [z.bypass.entity_id] : [])]), ...p.unpaired_controls.map((c) => c.entity_id)]));
    } catch (err) {
      if (!quiet || !this.data) this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private get panel(): AlarmPanel | null {
    const ps = this.data?.panels ?? [];
    return ps.find((p) => p.entity_id === this.panelId) ?? ps[0] ?? null;
  }

  private choosePanel(id: string) {
    this.panelId = id;
    navigate('/system/security/alarm', { panel: id });
  }

  private flash(text: string) {
    this.toast = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 4000);
  }

  // ---- actions

  private start(p: Pending) {
    if (p.prompt === 'pin_missing') {
      // security review M3: the first PIN comes from an administrator - or from the panel's own code, when one is stored
      if (this.data?.panels.some((x) => x.panel_code_set)) {
        this.pinOpen = true;
        this.pinError = 'נדרש קוד אישי. הקלידו את קוד הלוח כדי להגדיר אותו, או פנו למנהל המערכת לקבלת קוד אישי.';
      } else this.flash('פנה למנהל המערכת לקבלת קוד אישי.');
      return;
    }
    if (p.prompt === 'unverifiable') {
      this.flash(CODE_ERROR_LABEL.code_unverifiable + ' - פנו למנהל המערכת.');
      return;
    }
    if (p.prompt === 'none' && !p.needsConfirm) {
      void this.send(p, '');
      return;
    }
    this.clearCode();
    this.pending = p;
  }

  private clearCode() {
    this.code = '';
    this.codeError = '';
    const input = this.renderRoot?.querySelector<HTMLInputElement>('input[data-code]');
    if (input) input.value = '';
  }

  private closeDialog() {
    this.pending = null;
    this.clearCode();
  }

  private async send(p: Pending, code: string) {
    if (!isApi()) {
      // the static preview: the dialogs are there for review, nothing is sent
      this.closeDialog();
      this.flash('נתוני הדגמה: לא נשלחה פקודה.');
      return;
    }
    this.busy = true;
    this.codeError = '';
    try {
      const rec =
        p.kind === 'panel'
          ? await panelAction(p.panel.entity_id, p.action as AlarmAction, { confirmed: p.action === 'disarm', code: code || undefined })
          : await zoneBypass(p.zone!.entity_id, p.action === 'bypass_on', { confirmed: true, code: code || undefined });
      this.closeDialog();
      const label = p.kind === 'panel' ? ARM_LABEL[p.action as AlarmAction] : p.action === 'bypass_on' ? `עקיפת ${p.zone!.name}` : `החזרת ${p.zone!.name} להגנה`;
      this.sent = { label, record: rec as unknown as HaActionRecord, entity: rec.entity_id };
      const signal = { stopped: false };
      void awaitAction(rec.id, (a) => {
        if (this.sent && this.sent.record && this.sent.record.id === a.id) this.sent = { ...this.sent, record: a };
      }, signal).then(() => this.load(true));
      void this.load(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.body.code : '';
      if (err instanceof ApiError && code === 'code_required') {
        // the server asks for a code after all (settings changed meanwhile): open the keypad
        this.pending = { ...p, prompt: ((err.body.details?.prompt as CodePrompt) ?? 'panel') };
        this.codeError = '';
      } else if (err instanceof ApiError && this.pending && ['wrong_code', 'code_locked', 'rate_limited', 'code_rejected'].includes(code)) {
        this.clearCode();
        this.codeError = CODE_ERROR_LABEL[code] ?? describeError(err);
      } else {
        this.closeDialog();
        this.flash(CODE_ERROR_LABEL[code] ?? describeError(err));
      }
    } finally {
      this.busy = false;
    }
  }

  private submitCode() {
    const p = this.pending;
    if (!p) return;
    if (p.prompt !== 'none' && !this.code) {
      this.codeError = 'הקלידו קוד';
      return;
    }
    const code = this.code;
    this.code = '';
    void this.send(p, p.prompt === 'none' ? '' : code);
  }

  private key(k: string) {
    if (k === 'back') this.code = this.code.slice(0, -1);
    else if (k === 'clear') this.code = '';
    else if (this.code.length < 32) this.code += k;
    this.codeError = '';
  }

  private async savePin() {
    const f = this.pinForm;
    if (!/^\d{4,8}$/.test(f.next)) {
      this.pinError = 'קוד אישי: 4–8 ספרות.';
      return;
    }
    if (f.next !== f.again) {
      this.pinError = 'הקודים אינם זהים.';
      return;
    }
    if (!isApi()) {
      this.pinOpen = false;
      this.flash('נתוני הדגמה: הקוד לא נשמר.');
      return;
    }
    this.busy = true;
    try {
      await setMyPin(f.next, f.current || undefined, f.panel || undefined);
      this.pinOpen = false;
      this.pinForm = { current: '', next: '', again: '', panel: '' };
      this.pinError = '';
      this.flash('הקוד האישי נשמר');
      await this.load(true);
    } catch (err) {
      this.pinError = err instanceof ApiError && err.body.code === 'wrong_code' ? (this.data?.me.pin_set ? 'הקוד הנוכחי שגוי.' : 'קוד הלוח שגוי.') : err instanceof ApiError ? (CODE_ERROR_LABEL[err.body.code] ?? describeError(err)) : describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ---- rendering

  render() {
    if (this.loading && !this.data) return html`<sw-page heading="אזעקה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.error && !this.data) {
      return html`<sw-page heading="אזעקה"><sw-state-panel state="error" heading="לא ניתן לטעון את האזעקה" hint=${this.error} actionLabel="נסו שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    }
    const d = this.data!;
    const p = this.panel;
    if (!p) {
      return html`<sw-page heading="אזעקה"><sw-state-panel data-alarm-empty state="empty" heading="לא נמצא לוח אזעקה"
        hint="המערכת לא מצאה לוח אזעקה מחובר. מתקין או מנהל המערכת יכול לבדוק בהגדרות › אבטחה › ניהול אזעקה שמערכת האזעקה מחוברת לתשתית המערכת ושההרשאות מאפשרות לראות אותה."></sw-state-panel></sw-page>`;
    }
    const sub = `${d.counts.zones} חיישנים · ${d.counts.open} פתוחים · ${d.counts.bypassed} עקופים${d.counts.faults ? ` · ${d.counts.faults} תקלות` : ''}${d.channel === 'remote' ? ' · מחוץ לרשת המקומית' : ''}`;
    return html`<sw-page heading="אזעקה" subheading=${sub}>
      <sw-button slot="actions" size="sm" variant="ghost" icon="lock" data-alarm-pin @click=${() => { this.pinOpen = true; this.pinError = ''; }}>הקוד האישי שלי</sw-button>
      ${d.panels.length > 1
        ? html`<div class="switcher" role="group" aria-label="בחירת לוח" data-alarm-switcher>${d.panels.map((x) => {
            const st = panelState(x.state, x.available);
            return html`<button type="button" aria-pressed=${x.entity_id === p.entity_id} data-panel=${x.entity_id} @click=${() => this.choosePanel(x.entity_id)}><i class="dot ${st.tone}"></i>${x.name}<span class="hint">· ${st.label}</span></button>`;
          })}</div>`
        : nothing}
      ${this.renderHero(p)}
      ${this.renderZones(p)}
      ${p.unpaired_controls.length
        ? html`<details class="unpaired" data-alarm-unpaired><summary>ללא שיוך · ${p.unpaired_controls.length} מתגי עקיפה שלא שויכו לחיישן</summary><ul>${p.unpaired_controls.map((c) => html`<li>${c.name}${c.bypassed ? ' · עוקף' : ''}</li>`)}</ul><div class="hint">שיוך ידני: הגדרות › אבטחה › ניהול אזעקה.</div></details>`
        : nothing}
    </sw-page>
    ${this.renderKeypad()} ${this.renderPin()} ${this.toast ? html`<div class="toast" role="status" aria-live="polite">${this.toast}</div>` : nothing}`;
  }

  private renderHero(p: AlarmPanel) {
    const st = panelState(p.state, p.available);
    const disarmed = p.state === 'disarmed';
    const zonesById = new Map(p.zones.map((z) => [z.entity_id, z]));
    const name = (id: string) => zonesById.get(id)?.name ?? id;
    const sent = this.sent && this.sent.entity === p.entity_id ? this.sent : null;
    return html`<section class="hero" data-tone=${st.tone} data-alarm-state=${p.state ?? 'unknown'} data-alarm-panel=${p.entity_id}>
      <div class="state-row">
        <span class="shield"><sw-icon name=${disarmed ? 'unlock' : 'shield'} size=${28}></sw-icon></span>
        <div>
          <div class="state-label" role="status" aria-live="polite">${st.label}</div>
          <div class="meta">${p.name}${p.changed_by ? ` · שונה על ידי ${p.changed_by}` : ''}${p.last_changed ? ` · ${when(p.last_changed)}` : ''}</div>
        </div>
      </div>
      <div class="actions">
        ${p.can.arm
          ? p.arm_modes.map((m) => html`<sw-button variant=${m === 'arm_away' ? 'primary' : 'secondary'} icon="shield" data-arm=${m} ?disabled=${this.busy || !p.available || p.state === m.replace('arm_', 'armed_')}
              @click=${() => this.start({ kind: 'panel', action: m, panel: p, prompt: p.code.arm, needsConfirm: false })}>${ARM_LABEL[m]}</sw-button>`)
          : nothing}
        ${p.can.disarm
          ? html`<sw-button variant="danger" icon="unlock" data-disarm ?disabled=${this.busy || !p.available || disarmed}
              @click=${() => this.start({ kind: 'panel', action: 'disarm', panel: p, prompt: p.code.disarm, needsConfirm: true })}>${ARM_LABEL.disarm}</sw-button>`
          : nothing}
      </div>
      ${disarmed
        ? html`<div class="ready ${p.ready.ready ? '' : 'no'}" data-alarm-ready=${p.ready.ready ? 'yes' : 'no'}>
            <sw-icon name=${p.ready.ready ? 'check' : 'warning'} size=${16}></sw-icon>
            <div>${p.ready.ready
              ? 'מוכנה לדריכה: כל החיישנים סגורים.'
              : html`<b>לא מוכנה לדריכה</b>
                  <ul>${p.ready.open.map((id) => html`<li>פתוח: ${name(id)}</li>`)}${p.ready.faults.map((id) => html`<li>תקלה: ${name(id)}</li>`)}</ul>
                  <span class="hint">אפשר לסגור, או לעקוף חיישן לפני הדריכה.</span>`}</div>
          </div>`
        : nothing}
      ${sent
        ? html`<div class="sent" data-alarm-sent=${sent.record?.status ?? 'pending'}>${sent.label}: ${sent.record?.status === 'confirmed'
            ? 'הלוח אישר.'
            : sent.record?.status === 'unknown'
              ? 'הלוח לא אישר את הפקודה בזמן (ייתכן שהקוד שגוי) - המצב המוצג הוא מה שהלוח מדווח.'
              : sent.record?.status === 'failed' || sent.record?.status === 'denied'
                ? `הפקודה לא בוצעה${sent.record.error ? ` (${CODE_ERROR_LABEL[sent.record.error] ?? sent.record.error})` : ''}.`
                : 'נשלח · ממתין לאישור הלוח…'}</div>`
        : nothing}
    </section>`;
  }

  private visibleZones(p: AlarmPanel): AlarmZone[] {
    switch (this.filter) {
      case 'open':
        return p.zones.filter((z) => z.open && !z.bypassed);
      case 'bypassed':
        return p.zones.filter((z) => z.bypassed);
      case 'faults':
        return p.zones.filter((z) => z.fault || z.tamper);
      default:
        return p.zones;
    }
  }

  private renderZones(p: AlarmPanel) {
    const zones = this.visibleZones(p);
    const groups = new Map<string, AlarmZone[]>();
    for (const z of zones) {
      const k = z.area_name ?? 'ללא אזור';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(z);
    }
    return html`<div class="toolbar">
        <div class="chips" role="group" aria-label="סינון חיישנים">${FILTERS.map((f) => html`<button type="button" aria-pressed=${this.filter === f.id} data-filter=${f.id} @click=${() => (this.filter = f.id)}>${f.label}</button>`)}</div>
        <span class="counts">${zones.length} מתוך ${p.zones.length} חיישנים</span>
      </div>
      ${!p.zones.length
        ? html`<sw-state-panel compact state="empty" heading="אין חיישנים ללוח הזה" hint="החיישנים מגיעים מאותה מערכת אזעקה. מנהל המערכת יכול לשייך חיישנים ידנית בהגדרות › אבטחה › ניהול אזעקה."></sw-state-panel>`
        : !zones.length
          ? html`<div class="hint" data-alarm-filter-empty>אין חיישנים שמתאימים לסינון.</div>`
          : [...groups.entries()].map(([area, list]) => html`<section data-area=${area}><h3>${area}</h3><div class="grid">${list.map((z) => this.renderZone(p, z))}</div></section>`)}`;
  }

  private renderZone(p: AlarmPanel, z: AlarmZone) {
    const st = zoneState(z);
    const icon = z.kind === 'motion' ? 'activity' : z.kind === 'fault' ? 'warning' : z.kind === 'opening' ? 'door' : 'sensor';
    const b = z.bypass;
    const canToggle = !!b && b.available && (z.bypassed ? p.can.restore : p.can.bypass);
    return html`<article class="zone" data-tone=${st.tone} data-zone=${z.entity_id}>
      <span class="zicon"><sw-icon name=${icon} size=${18}></sw-icon></span>
      <div class="zname" title=${z.name}>${z.zone_number !== null ? html`<span class="hint">${z.zone_number} · </span>` : nothing}${z.name}</div>
      ${b
        ? html`<div class="bypass"><button type="button" class="tgl" role="switch" aria-checked=${z.bypassed ? 'true' : 'false'} aria-label=${`עקיפת ${z.name}`} data-bypass=${z.entity_id}
              ?disabled=${!canToggle || this.busy} title=${canToggle ? '' : 'אין הרשאה או שהמתג אינו זמין'}
              @click=${() => this.start({ kind: 'bypass', action: z.bypassed ? 'bypass_off' : 'bypass_on', panel: p, zone: z, prompt: p.code.bypass, needsConfirm: true })}></button>עקיפה</div>`
        : html`<span></span>`}
      <div class="zsub">
        <span class="zstate" data-zone-state>${st.label}</span>
        ${z.last_changed ? html`<span>${when(z.last_changed)}</span>` : nothing}
        ${z.tamper ? html`<span class="flag">חבלה</span>` : nothing}
        ${z.battery_low ? html`<span class="flag">סוללה חלשה</span>` : z.battery_level !== null ? html`<span>סוללה ${z.battery_level}%</span>` : nothing}
        ${z.alarmed ? html`<span class="flag">גרם לאזעקה</span>` : nothing}
        ${z.shared ? html`<span title="החיישן משותף לכל המחיצות של המערכת">משותף</span>` : nothing}
      </div>
    </article>`;
  }

  private renderKeypad() {
    const p = this.pending;
    if (!p) return nothing;
    const verb = p.kind === 'panel' ? ARM_LABEL[p.action as AlarmAction] : p.action === 'bypass_on' ? `עקיפת ${p.zone!.name}` : `החזרת ${p.zone!.name} להגנה`;
    const heading = p.prompt === 'none' ? `${verb}?` : verb;
    const sub =
      p.prompt === 'pin'
        ? 'הקלידו את הקוד האישי שלכם'
        : p.prompt === 'panel'
          ? 'הקלידו את קוד לוח האזעקה'
          : p.kind === 'bypass' && p.action === 'bypass_on'
            ? 'החיישן לא יתריע עד שיוחזר להגנה.'
            : p.action === 'disarm'
              ? `${p.panel.name} תנוטרל.`
              : '';
    const needsCode = p.prompt === 'pin' || p.prompt === 'panel';
    return html`<sw-dialog open heading=${heading} subheading=${sub} data-alarm-dialog @close=${() => this.closeDialog()}>
      ${needsCode
        ? html`<form class="keypad" data-keypad autocomplete="off" @submit=${(e: Event) => { e.preventDefault(); this.submitCode(); }}>
            <input data-code type="password" inputmode="numeric" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" name="sw-alarm-code-nofill" aria-label="קוד"
              maxlength="32" .value=${this.code} @input=${(e: Event) => { this.code = (e.target as HTMLInputElement).value; this.codeError = ''; }} />
            <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((k) => html`<button type="button" data-key=${k} aria-label=${k === 'back' ? 'מחיקה' : k === 'clear' ? 'ניקוי' : k} @click=${() => this.key(k)}>${k === 'back' ? '⌫' : k === 'clear' ? 'C' : k}</button>`)}</div>
            ${this.codeError ? html`<div class="err" role="alert" data-code-error>${this.codeError}</div>` : nothing}
          </form>`
        : this.codeError
          ? html`<div class="err" role="alert">${this.codeError}</div>`
          : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => this.closeDialog()}>ביטול</sw-button>
      <sw-button slot="footer" variant=${p.action === 'disarm' || p.action === 'bypass_on' ? 'danger' : 'primary'} data-alarm-confirm ?disabled=${this.busy} @click=${() => this.submitCode()}>${p.kind === 'panel' ? ARM_LABEL[p.action as AlarmAction] : p.action === 'bypass_on' ? 'עקוף' : 'החזר להגנה'}</sw-button>
    </sw-dialog>`;
  }

  private renderPin() {
    if (!this.pinOpen) return nothing;
    const has = this.data?.me.pin_set;
    const set = (k: 'current' | 'next' | 'again' | 'panel') => (e: Event) => (this.pinForm = { ...this.pinForm, [k]: (e.target as HTMLInputElement).value });
    return html`<sw-dialog open heading="הקוד האישי שלי" subheading="קוד של 4–8 ספרות להפעלה ולנטרול מהאפליקציה. זה אינו קוד הלוח." data-alarm-pin-dialog
      @close=${() => { this.pinOpen = false; this.pinForm = { current: '', next: '', again: '', panel: '' }; }}>
      <form class="pinform" autocomplete="off" @submit=${(e: Event) => { e.preventDefault(); void this.savePin(); }}>
        ${has
          ? html`<label class="hint">הקוד הנוכחי<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-pin-current .value=${this.pinForm.current} @input=${set('current')} /></label>`
          : html`<label class="hint">קוד הלוח (להגדרת הקוד האישי הראשון)<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="32" data-pin-panel .value=${this.pinForm.panel} @input=${set('panel')} /></label>`}
        <label class="hint">קוד חדש<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-new .value=${this.pinForm.next} @input=${set('next')} /></label>
        <label class="hint">שוב, לאימות<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-again .value=${this.pinForm.again} @input=${set('again')} /></label>
        ${this.pinError ? html`<div class="err" role="alert">${this.pinError}</div>` : nothing}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${() => { this.pinOpen = false; this.pinForm = { current: '', next: '', again: '', panel: '' }; }}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-pin-save ?disabled=${this.busy} @click=${() => void this.savePin()}>שמירה</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'security-alarm': SecurityAlarm;
  }
}
