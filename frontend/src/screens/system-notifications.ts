import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../pwa/notifications-settings';
import {
  CENTER_LAYOUTS, CENTER_LAYOUT_LABEL, CHANNEL_LABEL, DELIVERY_STATUS_LABEL, FAILURES_AUDIENCES, FAILURE_SOURCES, LOCKSCREEN_LABEL, LOCKSCREEN_LEVELS, RECIPIENT_LABEL, RETENTION_CHOICES,
  SEVERITIES, SEVERITY_LABEL, SOURCE_CATALOG, WEEKDAYS, WEEKDAY_LETTER, channelCell, channelStatus, clockText, deliveryReasonText, errorCode, hhmmToMin, notify, notifyErrorText,
  policyBody, recipientsRuleFor, relativeTime, settingsBody, validateSettings, parseRecipients, NOTIFY_ERROR_LABEL,
  type CenterLayout, type Channel, type Delivery, type EmailSecurity, type EscalationSettings, type FailuresAudience, type LockscreenLevel, type NotifyPolicy,
  type NotifySettings, type NotifyStats, type RetentionDays, type Severity, type Weekday,
} from '../api/notifications';
import { can, cap, isApi } from '../api/session';
import { needsNvrSource } from '../api/capabilities';
import { productSettings } from '../api/prefs';
import { listSubscriptions } from '../pwa/push';
import { mediaGlassStyles } from '../styles/media-glass';
import { mediaPageStyles } from '../styles/media-page';
import { nIcon } from '../components/notify-icons';
import { notifyControls, notifyKnobs } from '../components/notify-css';
import {
  enabledCount, escalationLines, mailFormError, mailResultText, type MailBody, type MailTestResult, failedCount, failurePanel, logRows, lockPreview, matrixGroups, policyWithChannel, policyWithRule, policyWithSeverity, stepAfterMin, toggleDay, togglePass,
  type MatrixGroup,
} from '../components/notify-logic';
import { applyNotifyGlass, notifyStore } from '../components/notify-store';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type SecId = 'sources' | 'quiet' | 'esc' | 'lock' | 'keep' | 'mail' | 'chan' | 'log';
const SECTIONS: { id: SecId; label: string; icon: string }[] = [
  { id: 'sources', label: 'מקורות והרשאות – מה נשלח', icon: 'list' },
  { id: 'quiet', label: 'שעות שקט ומה עובר', icon: 'moon' },
  { id: 'esc', label: 'הסלמה', icon: 'escal' },
  { id: 'lock', label: 'פרטיות מסך נעול', icon: 'lock' },
  { id: 'keep', label: 'שמירה', icon: 'calendar' },
  { id: 'mail', label: 'דואר יוצא', icon: 'mail' },
  { id: 'chan', label: 'ערוצים', icon: 'phone' },
  { id: 'log', label: 'יומן מסירה וכשלים', icon: 'inbox' },
];
type Phase = 'loading' | 'ready' | 'user' | 'error';
interface MailDraft { linkBase: string; host: string; port: string; security: EmailSecurity; user: string; password: string; pwEdit: boolean; from: string; recipients: string }
interface Person { id: string; name: string }
const DEMO_USERS: Person[] = [{ id: 'u-yoni', name: 'יוני' }, { id: 'u-dana', name: 'דנה' }, { id: 'u-uri', name: 'אורי' }, { id: 'u-roni', name: 'רוני' }];
const RULES: NotifyPolicy['recipients']['rule'][] = ['scope', 'managers', 'initiator', 'users'];
const STATUS_ICON: Record<Delivery['status'], string> = { sent: 'check', failed: 'warning', gone: 'warning', skipped: 'moon', queued: 'clock', retry: 'refresh' };
const STATUS_TONE: Record<Delivery['status'], string> = { sent: 'ok', failed: 'bad', gone: 'bad', skipped: 'skp', queued: 'skp', retry: 'skp' };

/** The log table reaches back 14 days; the failures panel above it counts the last 24 hours (each is labelled with its own window). */
const s14 = () => '14 יום';
const mailDraftOf = (s: NotifySettings): MailDraft => ({
  linkBase: (s.email as { link_base?: string }).link_base ?? '', host: s.email.host, port: String(s.email.port), security: s.email.security, user: s.email.user, password: '', pwEdit: !s.email.password_set, from: s.email.from, recipients: s.email.recipients.join(', '),
});

/**
 * CR-018 / CR §19: הגדרות › התראות. For a holder of `notify.manage`: the eight sections of the approved mockup - מקורות והרשאות (the source x severity x recipients x channel
 * matrix), שעות שקט ומה עובר, הסלמה, פרטיות מסך נעול (with the three lock-screen previews), שמירה, דואר יוצא (with the test button), ערוצים (the center's presentation, the
 * channel slots, this device) and יומן מסירה וכשלים (the failures panel and the delivery table) - and the two owner choices (`notify.center_layout`, `notify.failures_audience`).
 * Every change is saved at once through the revisioned PUTs of the contract (a stale revision reloads); the mail form saves on its own button. Everyone else sees only this
 * device's registration (no personal preferences exist, owner 4ב). Without a backend the in-memory mock answers.
 */
@customElement('system-notifications')
export class SystemNotifications extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** `?section=<id>` of the address. */
  @property() section = '';
  @state() private phase: Phase = 'loading';
  @state() private error = '';
  @state() private settings: NotifySettings | null = null;
  @state() private policies: NotifyPolicy[] = [];
  @state() private stats: NotifyStats | null = null;
  @state() private log: Delivery[] = [];
  @state() private titles: Record<string, string> = {};
  @state() private users: Person[] | null = null;
  @state() private devices = 0;
  @state() private onlyFailed = false;
  @state() private sec: SecId = 'sources';
  @state() private phone = window.matchMedia('(max-width: 1099px)').matches;
  @state() private toast: { text: string; bad: boolean } | null = null;
  @state() private invalid: string | null = null;
  @state() private mail: MailDraft = { linkBase: '', host: '', port: '587', security: 'starttls', user: '', password: '', pwEdit: true, from: '', recipients: '' };
  @state() private mailBusy: 'save' | 'test' | null = null;
  @state() private mailResult: MailTestResult | null = null;
  @state() private mailError = '';
  @state() private picker: { target: 'esc' | string; selected: string[] } | null = null;
  @state() private now = Date.now();
  @state() private tz: string | undefined = undefined;
  private rev = 1;
  private chain: Promise<void> = Promise.resolve();
  private toastTimer = 0;
  private phoneMq = window.matchMedia('(max-width: 1099px)');
  private obs: IntersectionObserver | null = null;

  static styles = [
    bubbleChrome,
    mediaGlassStyles,
    mediaPageStyles,
    notifyKnobs,
    notifyControls,
    css`
      :host {
        --nt-sheet-w: 480px;
      }
      .page {
        padding-block-start: 0;
      }
      .dh {
        position: static;
      }
      .dh .crumb {
        font-size: 14px;
        color: var(--dv-text-2);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .dh .crumb .ic {
        font-size: 14px;
      }
      .set {
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .setnav {
        position: sticky;
        inset-block-start: 20px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px;
      }
      .setnav button {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: 44px;
        padding: 0 12px;
        border-radius: 14px;
        border: 0;
        background: transparent;
        text-align: start;
        font-size: 13.5px;
        font-weight: 500;
        color: var(--dv-text-2);
      }
      .setnav button .ic {
        font-size: 17px;
        color: var(--dv-text-3);
      }
      .setnav button:hover {
        background: var(--dv-surface-3);
        color: var(--dv-text);
      }
      .setnav button[aria-current='true'] {
        background: var(--dv-accent-soft);
        color: var(--dv-accent-text);
        font-weight: 600;
      }
      .setnav button[aria-current='true'] .ic {
        color: var(--dv-accent-text);
      }
      .secs {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-inline-size: 0;
      }
      .sec {
        padding: var(--dv-card-pad-block) var(--dv-card-pad-inline);
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
        scroll-margin-block-start: 20px;
      }
      .sec header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .sec header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .sec header h2 .ic {
        font-size: 19px;
        color: var(--dv-text-2);
      }
      .sec header .sp {
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .frow {
        display: flex;
        align-items: center;
        gap: 14px;
        min-block-size: 52px;
        padding: 4px 0;
        border-block-start: 1px solid var(--dv-border);
        flex-wrap: wrap;
      }
      .sec header + .frow {
        border-block-start: 0;
      }
      .frow .l {
        flex: 1 1 180px;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }
      .frow .l b {
        font-size: 14px;
        font-weight: 600;
      }
      .frow .l small {
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .frow .r {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .frow.dis .l {
        opacity: 0.55;
      }
      .frow.dis .r {
        opacity: 0.55;
        pointer-events: none;
      }
      .fgrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px 14px;
      }
      .fgrid label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--dv-text-2);
        min-inline-size: 0;
      }
      .fgrid label.w2 {
        grid-column: span 2;
      }
      .errline {
        color: var(--dv-danger);
        font-size: 13px;
        font-weight: 600;
      }
      /* the sources matrix */
      .mxw {
        overflow-x: auto;
      }
      .mx {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 13px;
        table-layout: fixed;
        min-inline-size: 860px;
      }
      .mx th {
        font-size: 12px;
        font-weight: 600;
        color: var(--dv-text-3);
        text-align: start;
        padding: 8px;
        background: var(--nt-matrix-head);
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
      }
      .mx th:first-child {
        border-start-start-radius: 12px;
      }
      .mx th:last-child {
        border-start-end-radius: 12px;
      }
      .mx th.c,
      .mx td.c {
        text-align: center;
      }
      .mx td {
        padding: 6px 8px;
        border-block-end: 1px solid var(--dv-border);
        vertical-align: middle;
        block-size: 56px;
      }
      .mx tr:last-child td {
        border-block-end: 0;
      }
      .mx tr.cat td {
        background: transparent;
        border-block-end: 0;
        padding: 16px 8px 6px;
        font-weight: 700;
        font-size: 12.5px;
        color: var(--dv-text-2);
        letter-spacing: 0.02em;
        block-size: auto;
      }
      .mx tr.cat td .ic {
        font-size: 14px;
        vertical-align: -2px;
        margin-inline-end: 6px;
      }
      .mx tr.off td:not(.keep) {
        opacity: 0.45;
      }
      .nm {
        display: flex;
        align-items: center;
        gap: 10px;
        min-inline-size: 0;
      }
      .nm .ring {
        inline-size: 32px;
        block-size: 32px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        display: grid;
        place-items: center;
        font-size: 15px;
        flex: none;
      }
      .nm b {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sevseg {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: 999px;
        background: var(--dv-surface-3);
      }
      .sevseg button {
        border: 0;
        background: transparent;
        border-radius: 999px;
        block-size: 40px;
        min-inline-size: 36px;
        padding: 0 10px;
        font-size: 12px;
        font-weight: 600;
        color: var(--dv-text-2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .sevseg button[aria-pressed='true'] {
        background: var(--mm-seg-thumb);
        color: var(--dv-text);
        box-shadow: var(--dv-shadow-control);
      }
      .sevseg button i {
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--sev);
      }
      .chs {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        flex-wrap: nowrap;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        block-size: 40px;
        padding: 0 11px;
        border-radius: 999px;
        border: 1px solid var(--dv-border);
        background: var(--dv-surface-2);
        font-size: 12px;
        font-weight: 600;
        color: var(--dv-text-2);
        white-space: nowrap;
      }
      .chip .ic {
        font-size: 14px;
      }
      .chip[aria-pressed='true'] {
        background: var(--dv-accent-soft);
        border-color: transparent;
        color: var(--dv-accent-text);
      }
      .chip.lock {
        background: var(--dv-neutral-soft);
        color: var(--dv-text-2);
        border-color: transparent;
      }
      .chip.soon {
        border-style: dashed;
        inline-size: 40px;
        padding: 0;
        justify-content: center;
        opacity: 0.55;
      }
      .chip.unconf {
        border-style: dashed;
      }
      .scards {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .scard {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-radius: 18px;
      }
      .scard .top {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .scard .top b {
        flex: 1;
        min-inline-size: 0;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .scard .ln {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .scard .ln > small {
        font-size: 12px;
        color: var(--dv-text-3);
        font-weight: 600;
        min-inline-size: 52px;
      }
      .scard.off .ln {
        opacity: 0.45;
      }
      /* quiet hours matrix */
      .qmx {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 13px;
      }
      .qmx th,
      .qmx td {
        padding: 6px 8px;
        border-block-end: 1px solid var(--dv-border);
        text-align: center;
      }
      .qmx td {
        block-size: 52px;
      }
      .qmx th {
        font-size: 12px;
        font-weight: 600;
        color: var(--dv-text-3);
        background: var(--nt-matrix-head);
      }
      .qmx td:first-child,
      .qmx th:first-child {
        text-align: start;
      }
      .qmx tr:last-child td {
        border-block-end: 0;
      }
      .qmx .sv {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      .qmx .sv i {
        inline-size: 10px;
        block-size: 10px;
        border-radius: 50%;
        background: var(--sev);
      }
      .qmx td .chk {
        margin-inline: auto;
      }
      .escprev {
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .escprev.dis {
        opacity: 0.5;
      }
      .escprev .tl .ev {
        min-block-size: 40px;
      }
      /* the lock screens */
      .lockrow {
        display: flex;
        gap: 18px;
        justify-content: center;
        flex-wrap: wrap;
        padding: 6px 0;
      }
      .lphone {
        position: relative;
        inline-size: 250px;
        block-size: 500px;
        border-radius: 34px;
        overflow: hidden;
        background: radial-gradient(500px 340px at 20% -10%, #8fb4ff 0%, transparent 60%), radial-gradient(420px 300px at 100% 100%, #ffb36b 0%, transparent 55%), linear-gradient(180deg, #1b2a4a, #0b1020);
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35), inset 0 0 0 7px #0d0f14, inset 0 0 0 8px rgba(255, 255, 255, 0.08);
        color: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 14px;
        opacity: 0.72;
        transition: opacity var(--mm-motion), transform var(--mm-motion) var(--mm-ease);
      }
      .lphone.sel {
        opacity: 1;
        transform: translateY(-4px);
        box-shadow: 0 22px 54px rgba(0, 0, 0, 0.42), inset 0 0 0 7px #0d0f14, inset 0 0 0 8px rgba(255, 255, 255, 0.08), 0 0 0 3px var(--dv-accent);
      }
      :host([data-devices-scheme='dark']) .lphone {
        background: radial-gradient(500px 340px at 20% -10%, #2a3f6e 0%, transparent 60%), radial-gradient(420px 300px at 100% 100%, #5a3a16 0%, transparent 55%), linear-gradient(180deg, #0a0d16, #000);
      }
      .lphone .notch {
        inline-size: 82px;
        block-size: 24px;
        background: #0d0f14;
        border-radius: 0 0 16px 16px;
        margin-block-start: 7px;
        flex: none;
      }
      .lphone .llabel {
        margin-block-start: 12px;
        block-size: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        font-size: 11.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .lphone.sel .llabel {
        background: #2767ed;
        border-color: #2767ed;
      }
      .lphone .ltime {
        margin-block-start: 8px;
        font-size: 54px;
        font-weight: 600;
        letter-spacing: -0.04em;
        line-height: 1;
        direction: ltr;
        font-variant-numeric: tabular-nums;
      }
      .lphone .ldate {
        font-size: 13px;
        font-weight: 500;
        opacity: 0.9;
        margin-block-start: 4px;
      }
      .lphone .lcards {
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: 7px;
        margin-block-start: 18px;
      }
      .pushcard {
        inline-size: 100%;
        background: rgba(255, 255, 255, 0.78);
        color: #1c1c1e;
        border-radius: 16px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-family: var(--dv-font);
        -webkit-backdrop-filter: var(--sw-perf-blur, blur(30px));
        backdrop-filter: var(--sw-perf-blur, blur(30px));
        border: 1px solid rgba(255, 255, 255, 0.6);
      }
      :host([data-devices-scheme='dark']) .pushcard {
        background: rgba(44, 44, 46, 0.72);
        color: #f5f5f7;
        border-color: rgba(255, 255, 255, 0.12);
      }
      .pushcard .ph {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        color: #6e6e73;
      }
      :host([data-devices-scheme='dark']) .pushcard .ph {
        color: rgba(235, 235, 245, 0.6);
      }
      .pushcard .ph .app {
        inline-size: 16px;
        block-size: 16px;
        border-radius: 5px;
        background: #2767ed;
        color: #fff;
        font-weight: 800;
        font-size: 9px;
        display: grid;
        place-items: center;
      }
      .pushcard .ph .ago {
        margin-inline-start: auto;
        font-variant-numeric: tabular-nums;
      }
      .pushcard b {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
      }
      .pushcard p {
        margin: 0;
        font-size: 11px;
        color: #3a3a3c;
        line-height: 1.3;
      }
      :host([data-devices-scheme='dark']) .pushcard p {
        color: rgba(235, 235, 245, 0.76);
      }
      .pushcard .acts {
        display: flex;
        gap: 4px;
        margin-block-start: 2px;
        flex-wrap: wrap;
      }
      .pushcard .acts span {
        block-size: 24px;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(120, 120, 128, 0.14);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10.5px;
        font-weight: 600;
      }
      :host([data-devices-scheme='dark']) .pushcard .acts span {
        background: rgba(235, 235, 245, 0.14);
      }
      .pushcard .acts span .ic {
        font-size: 11px;
      }
      .pushcard .acts span.door .ic {
        color: #ff9f0a;
      }
      /* the log */
      .lgw {
        overflow-x: auto;
        border-radius: 14px;
        border: 1px solid var(--dv-border);
      }
      .lg {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 12.5px;
      }
      .lg th {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--dv-text-3);
        text-align: start;
        padding: 8px;
        background: var(--nt-matrix-head);
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
      }
      .lg td {
        padding: 9px 8px;
        border-block-end: 1px solid var(--dv-border);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-inline-size: 260px;
      }
      .lg tr:last-child td {
        border-block-end: 0;
      }
      .lg td .ic {
        font-size: 14px;
        vertical-align: -2px;
        margin-inline-end: 4px;
      }
      .lg .ok {
        color: var(--dv-success);
        font-weight: 600;
      }
      .lg .bad {
        color: var(--dv-danger);
        font-weight: 600;
      }
      .lg .skp {
        color: var(--dv-text-3);
        font-weight: 600;
      }
      .fails {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
      }
      .fstat {
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .fstat b {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .fstat.bad b {
        color: var(--dv-danger);
      }
      .fstat small {
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .fstat .ch {
        font-size: 12px;
        color: var(--dv-text-3);
        font-weight: 600;
      }
      .chgrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .chc {
        padding: 14px;
        border-radius: 18px;
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-block-size: 120px;
      }
      .chc .ring {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        display: grid;
        place-items: center;
        font-size: 19px;
      }
      .chc b {
        font-size: 14.5px;
        font-weight: 700;
      }
      .chc small {
        font-size: 12.5px;
        color: var(--dv-text-2);
      }
      .chc.soon {
        border-style: dashed;
        opacity: 0.8;
      }
      .chc .tag {
        align-self: flex-start;
      }
      .devbox {
        border-block-start: 1px solid var(--dv-border);
        padding-block-start: 12px;
      }
      .skbox {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .skbox .skl {
        block-size: 160px;
        border-radius: var(--dv-radius-md);
      }
      .pick {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pick button {
        display: flex;
        align-items: center;
        gap: 12px;
        min-block-size: 44px;
        padding: 0 10px;
        border: 0;
        background: transparent;
        border-radius: 12px;
        text-align: start;
        font-size: 14px;
      }
      .pick button:hover {
        background: var(--dv-surface-3);
      }
      .tagrow {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      @media (max-width: 1099px) {
        .set {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .setnav {
          position: static;
          flex-direction: row;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 4px 0;
          background: transparent;
          border: 0;
          box-shadow: none;
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
        }
        .setnav::-webkit-scrollbar {
          display: none;
        }
        .setnav button {
          flex: none;
          block-size: 44px;
          border: 1px solid var(--dv-border);
          background: var(--dv-surface-2);
          border-radius: 999px;
          padding: 0 14px;
        }
        .setnav button[aria-current='true'] {
          background: var(--dv-text);
          color: var(--mm-text-inverse);
          border-color: transparent;
        }
        .setnav button[aria-current='true'] .ic {
          color: inherit;
        }
        .setnav button .ic {
          display: none;
        }
        .fgrid label.w2 {
          grid-column: span 1;
        }
        .lphone:not(.sel) {
          display: none;
        }
        .lphone {
          opacity: 1;
        }
        .dh {
          padding-block-end: 4px;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void applyNotifyGlass(this);
    this.phoneMq.addEventListener('change', this.onMq);
    void this.load();
  }
  disconnectedCallback() {
    this.phoneMq.removeEventListener('change', this.onMq);
    this.obs?.disconnect();
    window.clearTimeout(this.toastTimer);
    super.disconnectedCallback();
  }
  private onMq = () => (this.phone = this.phoneMq.matches);

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('section') && SECTIONS.some((s) => s.id === this.section)) this.sec = this.section as SecId;
  }
  protected updated(changed: Map<string, unknown>) {
    if (changed.has('phase') && this.phase === 'ready' && !this.phone) this.watchSections();
  }

  // ---------------------------------------------------------------------------------------------- loading

  private async load() {
    this.phase = 'loading';
    this.error = '';
    try {
      await notifyStore.prepare();
      if (isApi() && !can('notify.manage')) {
        this.phase = 'user';
        return;
      }
      const a = notify();
      let s: NotifySettings;
      try {
        s = await a.settings();
      } catch (err) {
        if (errorCode(err) === 'forbidden') {
          this.phase = 'user';
          return;
        }
        throw err;
      }
      const [policies, stats, log, rows, users, devices, clock] = await Promise.all([
        a.policies(), a.stats().catch(() => null), a.adminDeliveries({ limit: 200 }).catch(() => [] as Delivery[]), a.list({ limit: 100 }).catch(() => null),
        this.loadUsers(), this.countDevices(), this.clockAndZone(),
      ]);
      this.settings = s;
      this.rev = s.revision;
      this.policies = policies;
      this.stats = stats;
      this.log = log;
      this.titles = Object.fromEntries((rows?.notifications ?? []).map((n) => [n.id, n.title]));
      this.users = users;
      this.devices = devices;
      this.now = clock.now;
      this.tz = clock.tz;
      this.mail = mailDraftOf(s);
      this.mailResult = null;
      this.phase = 'ready';
    } catch (err) {
      this.error = notifyErrorText(err);
      this.phase = 'error';
    }
  }
  private async clockAndZone(): Promise<{ now: number; tz: string | undefined }> {
    if (isApi()) {
      const ps = (await productSettings().catch(() => ({}))) as Record<string, unknown>;
      return { now: Date.now(), tz: typeof ps['time.zone'] === 'string' ? (ps['time.zone'] as string) : undefined };
    }
    const m = await import('../api/notifications-mock');
    return { now: m.notifyMock().clock, tz: m.MOCK_TZ };
  }
  private async loadUsers(): Promise<Person[] | null> {
    if (!isApi()) return DEMO_USERS;
    try {
      const { listUsers } = await import('../api/access');
      return (await listUsers()).users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name || u.username }));
    } catch {
      return null;
    }
  }
  private async countDevices(): Promise<number> {
    if (!isApi()) return (await import('../api/notifications-mock')).notifyMock().registered;
    try {
      return (await listSubscriptions()).subscriptions.length;
    } catch {
      return 0;
    }
  }

  private watchSections() {
    this.obs?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    this.obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = (hit?.target as HTMLElement | undefined)?.dataset.setSection as SecId | undefined;
        if (id) this.sec = id;
      },
      { root: this, rootMargin: '-80px 0px -65% 0px' },
    );
    this.renderRoot.querySelectorAll('[data-set-section]').forEach((el) => this.obs?.observe(el));
  }

  // ---------------------------------------------------------------------------------------------- saving

  private say(text: string, bad = false) {
    this.toast = { text, bad };
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 3000);
  }
  private enqueue(fn: () => Promise<void>) {
    this.chain = this.chain.then(fn).catch(() => undefined);
  }
  private async conflict(err: unknown) {
    this.say(notifyErrorText(err), true);
    await this.load();
  }

  /** A settings change: shown at once, validated like the server (quiet_invalid / escalation_invalid), saved in order through the revisioned PUT. */
  private patchSettings(patch: Partial<NotifySettings>) {
    if (!this.settings) return;
    this.settings = { ...this.settings, ...patch };
    const bad = validateSettings(settingsBody(this.settings));
    this.invalid = bad;
    if (bad) return;
    this.enqueue(async () => {
      if (!this.settings) return;
      try {
        const saved = await notify().saveSettings(settingsBody(this.settings), this.rev);
        this.rev = saved.revision;
        this.say('נשמר');
      } catch (err) {
        await this.conflict(err);
      }
    });
  }
  private patchPolicy(source: string, fn: (p: NotifyPolicy) => NotifyPolicy) {
    const cur = this.policies.find((p) => p.source === source);
    if (!cur) return;
    let next: NotifyPolicy;
    try {
      next = fn(cur);
    } catch (err) {
      this.say(notifyErrorText(err), true);
      return;
    }
    this.policies = this.policies.map((p) => (p.source === source ? next : p));
    this.enqueue(async () => {
      const now = this.policies.find((p) => p.source === source);
      if (!now) return;
      try {
        const saved = await notify().savePolicy(source, policyBody(now), now.revision);
        this.policies = this.policies.map((p) => (p.source === source ? { ...p, revision: saved.revision } : p));
        this.say('נשמר');
      } catch (err) {
        await this.conflict(err);
      }
    });
  }

  private setSec(id: SecId) {
    this.sec = id;
    if (!this.phone) this.renderRoot.querySelector(`[data-set-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------------------------------------- the mail form

  private mailBody(): MailBody | null {
    const m = this.mail;
    const body: MailBody = { host: m.host.trim(), port: Number(m.port), security: m.security, user: m.user.trim(), from: m.from.trim(), recipients: parseRecipients(m.recipients), link_base: m.linkBase.trim() };
    if (m.pwEdit && m.password) body.password = m.password;
    return mailFormError(body) ? null : body;
  }
  private async saveMail() {
    const body = this.mailBody();
    if (!body) {
      this.mailError = NOTIFY_ERROR_LABEL.email_invalid;
      return;
    }
    this.mailError = '';
    this.mailBusy = 'save';
    try {
      const saved = await notify().saveEmail(body);
      if (this.settings) this.settings = { ...this.settings, email: saved };
      this.mailResult = null; // a result belongs to the settings it tested
      this.mail = { ...this.mail, password: '', pwEdit: !saved.password_set };
      this.say('הגדרות הדואר נשמרו');
    } catch (err) {
      this.mailError = notifyErrorText(err);
    } finally {
      this.mailBusy = null;
    }
  }
  private async testMail() {
    this.mailBusy = 'test';
    this.mailError = '';
    try {
      this.mailResult = (await notify().testEmail()) as MailTestResult;
      const s = await notify().settings().catch(() => null);
      if (s && this.settings) this.settings = { ...this.settings, email: s.email };
    } catch (err) {
      this.mailResult = null;
      this.mailError = notifyErrorText(err);
    } finally {
      this.mailBusy = null;
    }
  }

  // ---------------------------------------------------------------------------------------------- pickers

  private nameOf = (to: EscalationSettings['to']): string => {
    if (to === 'managers') return 'מנהלי התראות';
    const names = to.map((id) => this.users?.find((u) => u.id === id)?.name ?? id);
    return names.length ? names.join(', ') : 'משתמשים נבחרים';
  };
  private openPicker(target: 'esc' | string) {
    const cur = target === 'esc' ? (Array.isArray(this.settings?.escalation.to) ? (this.settings?.escalation.to as string[]) : []) : this.policies.find((p) => p.source === target)?.recipients.user_ids ?? [];
    this.picker = { target, selected: [...cur] };
  }
  private savePicker() {
    const p = this.picker;
    if (!p || !p.selected.length) return;
    if (p.target === 'esc') this.patchSettings({ escalation: { ...(this.settings as NotifySettings).escalation, to: p.selected } });
    else {
      const ids = p.selected;
      this.patchPolicy(p.target, (pol) => ({ ...pol, recipients: { rule: 'users', user_ids: ids } }));
    }
    this.picker = null;
  }

  // ---------------------------------------------------------------------------------------------- sections

  private sevSeg(source: string, cur: Severity) {
    return html`<span class="sevseg" role="radiogroup" aria-label="חומרה">${SEVERITIES.slice().reverse().map((s) => html`<button type="button" role="radio" aria-checked=${String(cur === s)} aria-pressed=${String(cur === s)} data-pol-sev=${`${source}:${s}`} style=${`--sev:var(--nt-sev-${s})`} title=${SEVERITY_LABEL[s]} @click=${() => this.patchPolicy(source, (p) => policyWithSeverity(p, s))}><i></i>${cur === s ? SEVERITY_LABEL[s] : ''}</button>`)}</span>`;
  }
  private whoSel(p: NotifyPolicy) {
    const forced = FAILURE_SOURCES.includes(p.source);
    const eff = this.settings ? recipientsRuleFor(p, this.settings) : p.recipients.rule;
    const shown = forced ? eff : p.recipients.rule;
    return html`<select class="inp sm" data-pol-who=${p.source} aria-label="מי מקבל" ?disabled=${forced} @change=${(e: Event) => {
      const v = (e.target as HTMLSelectElement).value as NotifyPolicy['recipients']['rule'];
      if (v === 'users') {
        this.openPicker(p.source);
        (e.target as HTMLSelectElement).value = shown;
      } else this.patchPolicy(p.source, (x) => policyWithRule(x, v));
    }}>${RULES.map((r) => html`<option value=${r} .selected=${shown === r}>${r === 'users' && p.recipients.rule === 'users' ? `${RECIPIENT_LABEL.users} (${p.recipients.user_ids?.length ?? 0})` : RECIPIENT_LABEL[r]}</option>`)}</select>`;
  }
  private chans(p: NotifyPolicy) {
    const s = this.settings;
    const push = channelCell(p, 'webpush', s);
    const mail = channelCell(p, 'email', s);
    const app = channelCell(p, 'app', s);
    const chip = (c: Channel, cell: ReturnType<typeof channelCell>, icon: string) => html`<button type="button" class=${classMap({ chip: true, unconf: cell.note === 'unconfigured' })} aria-pressed=${String(cell.on)} data-pol-ch=${`${p.source}:${c}`} title=${cell.note === 'unconfigured' ? 'הדוא"ל לא מוגדר' : ''} @click=${() => this.patchPolicy(p.source, (x) => policyWithChannel(x, c, !cell.on))}>${nIcon(icon)}${CHANNEL_LABEL[c]}</button>`;
    return html`<span class="chs"><span class="chip lock" title="תמיד">${nIcon('inbox')}${CHANNEL_LABEL.inbox}</span>${chip('webpush', push, 'phone')}${chip('email', mail, 'mail')}${chip('app', app, 'phone')}<span class="chip soon" aria-disabled="true" title="Companion – בקרוב" aria-label="Companion – בקרוב">${nIcon('phone')}</span><span class="chip soon" aria-disabled="true" title="WhatsApp – בקרוב" aria-label="WhatsApp – בקרוב">${nIcon('chat')}</span></span>`;
  }
  private tog(on: boolean, attr: string, label: string, click: () => void, disabled = false) {
    return html`<button type="button" class="tog" role="switch" aria-checked=${String(on)} aria-label=${label} ?disabled=${disabled} data-tog=${attr} @click=${click}></button>`;
  }
  private polToggle(p: NotifyPolicy) {
    return html`<button type="button" class="tog" role="switch" aria-checked=${String(p.enabled)} aria-label="פעיל" data-pol-on=${p.source} @click=${() => this.patchPolicy(p.source, (x) => ({ ...x, enabled: !x.enabled }))}></button>`;
  }

  private renderSources() {
    // NN1: the recorder's own sources (recorder offline, recorder storage, camera lost) are not offered without an NVR
    const shown = cap('nvr') ? this.policies : this.policies.filter((p) => !needsNvrSource(p.source));
    const groups = matrixGroups(shown, SOURCE_CATALOG);
    const total = shown.length;
    const ruleOnly = (src: string) => src === 'rule.alert' || SOURCE_CATALOG.find((s) => s.key === src)?.rulesOnly === true;
    const s = this.settings as NotifySettings;
    let body: TemplateResult;
    if (!this.phone) {
      body = html`<div class="mxw"><table class="mx"><colgroup><col style="width:25%"><col style="width:8%"><col style="width:15%"><col style="width:18%"><col></colgroup>
        <thead><tr><th>מקור</th><th class="c">פעיל</th><th>חומרה</th><th>מי מקבל</th><th>ערוצים</th></tr></thead>
        <tbody>${groups.map((g: MatrixGroup) => html`<tr class="cat"><td colspan="5">${nIcon(g.icon)}${g.label}</td></tr>${g.rows.map(({ info, policy: p }) => html`<tr class=${p.enabled ? '' : 'off'} data-pol-row=${p.source}>
          <td class="keep"><span class="nm"><span class="ring">${nIcon(info.icon)}</span><b>${info.label}</b></span></td>
          <td class="c keep">${this.polToggle(p)}</td>
          <td>${ruleOnly(p.source) ? html`<span class="tag">לפי החוק</span>` : this.sevSeg(p.source, p.severity)}</td>
          <td>${this.whoSel(p)}</td><td>${this.chans(p)}</td></tr>`)}`)}</tbody></table></div>`;
    } else {
      body = html`<div class="scards">${groups.flatMap((g) => g.rows).map(({ info, policy: p }) => html`<section class="glass scard ${p.enabled ? '' : 'off'}" data-pol-row=${p.source}>
        <div class="top"><span class="nm"><span class="ring">${nIcon(info.icon)}</span></span><b>${info.label}</b>${this.polToggle(p)}</div>
        <div class="ln"><small>חומרה</small>${ruleOnly(p.source) ? html`<span class="tag">לפי החוק</span>` : this.sevSeg(p.source, p.severity)}</div>
        <div class="ln"><small>מי מקבל</small>${this.whoSel(p)}</div>
        <div class="ln"><small>ערוצים</small>${this.chans(p)}</div></section>`)}</div>`;
    }
    return html`<section class="glass sec" data-set-section="sources" id="sec-sources"><header><h2>${nIcon('list')}${SECTIONS[0].label}</h2><div class="sp"><span class="tag soon">${nIcon('phone')}Companion – בקרוב</span><span class="tag soon">${nIcon('chat')}WhatsApp – בקרוב</span><span class="tag" data-pol-count>${enabledCount(this.policies)} מתוך ${total} פעילים</span></div></header>
      <div class="frow"><div class="l"><b>כשל בתזמון או באוטומציה מגיע אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="כשל בתזמון או באוטומציה">${FAILURES_AUDIENCES.map((a: FailuresAudience) => html`<button type="button" aria-pressed=${String(s.failures_audience === a)} data-failures-audience=${a} @click=${() => this.patchSettings({ failures_audience: a })}>${a === 'admins' ? 'מנהלים' : 'כל מי שרואה'}</button>`)}</div></div></div>
      ${body}</section>`;
  }

  private renderQuiet() {
    const s = this.settings as NotifySettings;
    const q = s.quiet;
    const dis = !q.enabled;
    return html`<section class="glass sec" data-set-section="quiet" id="sec-quiet"><header><h2>${nIcon('moon')}${SECTIONS[1].label}</h2><div class="sp">${this.tog(q.enabled, 'quiet-on', 'שעות שקט', () => this.patchSettings({ quiet: { ...q, enabled: !q.enabled } }))}</div></header>
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>שעות</b></div><div class="r"><input class="inp sm ltr" type="time" data-quiet-from aria-label="מהשעה" style="inline-size:112px" .value=${q.from} ?disabled=${dis} @change=${(e: Event) => this.setTime('from', (e.target as HTMLInputElement).value)} /><span>עד</span><input class="inp sm ltr" type="time" data-quiet-to aria-label="עד השעה" style="inline-size:112px" .value=${q.to} ?disabled=${dis} @change=${(e: Event) => this.setTime('to', (e.target as HTMLInputElement).value)} /></div></div>
      ${this.invalid === 'quiet_invalid' ? html`<div class="errline" data-set-error>${NOTIFY_ERROR_LABEL.quiet_invalid}</div>` : nothing}
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>ימים</b></div><div class="r"><div class="days" role="group" aria-label="ימים">${WEEKDAYS.map((d: Weekday) => html`<button type="button" aria-pressed=${String(q.days.includes(d))} data-quiet-day=${d} ?disabled=${dis} @click=${() => this.patchSettings({ quiet: { ...q, days: toggleDay(q.days, d) } })}>${WEEKDAY_LETTER[d]}</button>`)}</div></div></div>
      <div class="frow ${dis ? 'dis' : ''}" style="align-items:flex-start"><div class="l"><b>מה עובר בשעות שקט</b></div></div>
      <table class="qmx ${dis ? 'dis' : ''}"><thead><tr><th>חומרה</th><th>${CHANNEL_LABEL.webpush}</th><th>${CHANNEL_LABEL.email}</th><th>Companion</th></tr></thead><tbody>${SEVERITIES.slice().reverse().map((sv) => html`<tr><td><span class="sv" style=${`--sev:var(--nt-sev-${sv})`}><i></i>${SEVERITY_LABEL[sv]}</span></td>
        ${(['webpush', 'email'] as const).map((c) => html`<td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[sv][c])} aria-label=${`${SEVERITY_LABEL[sv]} · ${CHANNEL_LABEL[c]}`} data-pass=${`${sv}:${c}`} ?disabled=${dis} @click=${() => this.patchSettings({ pass_through: togglePass(s.pass_through, sv, c) })}>${nIcon('check')}</button></td>`)}
        <td><button type="button" class="chk" role="checkbox" aria-checked=${String(s.pass_through[sv].ha_mobile)} aria-label="Companion – בקרוב" disabled>${nIcon('check')}</button></td></tr>`)}</tbody></table></section>`;
  }
  private setTime(which: 'from' | 'to', value: string) {
    if (!this.settings || !Number.isFinite(hhmmToMin(value))) return;
    this.patchSettings({ quiet: { ...this.settings.quiet, [which]: value } });
  }

  private renderEsc() {
    const s = this.settings as NotifySettings;
    const e = s.escalation;
    const dis = !e.enabled;
    const users = e.to !== 'managers';
    const set = (patch: Partial<EscalationSettings>) => this.patchSettings({ escalation: { ...e, ...patch } });
    const lines = escalationLines(e, 14 * 60 + 2, this.nameOf);
    return html`<section class="glass sec" data-set-section="esc" id="sec-esc"><header><h2>${nIcon('escal')}${SECTIONS[2].label}</h2><div class="sp">${this.tog(e.enabled, 'esc-on', 'הסלמה', () => set({ enabled: !e.enabled }))}</div></header>
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>אחרי</b><small>קריטי בלי אישור</small></div><div class="r"><span class="stp"><button type="button" data-esc-step="-1" aria-label="פחות" @click=${() => this.patchSettings({ escalation: stepAfterMin(e, -1) })}>${nIcon('minus')}</button><span class="vv" data-esc-min><span class="n">${e.after_min}</span><small>דק׳</small></span><button type="button" data-esc-step="1" aria-label="יותר" @click=${() => this.patchSettings({ escalation: stepAfterMin(e, 1) })}>${nIcon('plus')}</button></span></div></div>
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>שלבים</b></div><div class="r"><div class="seg sm" role="group" aria-label="שלבים">${[1, 2, 3].map((v) => html`<button type="button" aria-pressed=${String(e.steps === v)} data-esc-steps=${v} @click=${() => set({ steps: v })}>${v}</button>`)}</div></div></div>
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>אל</b></div><div class="r"><div class="seg sm" role="group" aria-label="אל"><button type="button" aria-pressed=${String(!users)} data-esc-to="managers" @click=${() => set({ to: 'managers' })}>מנהלי התראות</button><button type="button" aria-pressed=${String(users)} data-esc-to="users" @click=${() => this.openPicker('esc')}>משתמשים נבחרים</button></div>${users ? html`<span class="tag" data-esc-names>${this.nameOf(e.to)}</span>` : nothing}</div></div>
      <div class="frow ${dis ? 'dis' : ''}"><div class="l"><b>נעצרת באישור</b></div><div class="r"><span class="tag ok">${nIcon('lock')}תמיד</span></div></div>
      ${this.invalid === 'escalation_invalid' ? html`<div class="errline" data-set-error>${NOTIFY_ERROR_LABEL.escalation_invalid}</div>` : nothing}
      <div class="escprev ${dis ? 'dis' : ''}" data-esc-preview><div class="tl">${lines.map((l) => html`<div class="ev ${l.kind}"><span class="t">${l.clock}</span><span class="d"><i></i></span><span class="b"><b>${l.title}</b><small>${l.sub}</small></span></div>`)}</div></div></section>`;
  }

  private lockPhone(level: LockscreenLevel, sel: boolean) {
    const cards = lockPreview(level, this.tz);
    return html`<div class=${classMap({ lphone: true, sel })} data-lock-phone=${level} data-lock-selected=${String(sel)}><span class="notch"></span><span class="llabel">${nIcon('lock')}${LOCKSCREEN_LABEL[level]}</span>
      <div class="ltime n">14:10</div><div class="ldate">יום רביעי, 1 באוקטובר</div>
      <div class="lcards">${(level === 'generic' ? cards.slice(0, 1) : cards).map((c) => html`<div class="pushcard" data-push-card><div class="ph"><span class="app">S</span>Arx<span class="ago">${c.ago}</span></div><b>${c.title}</b><p>${c.body}</p>
        <div class="acts">${c.actions.map((a) => html`<span class=${a.id === 'open_door' ? 'door' : ''}>${nIcon(a.id === 'open' ? 'open' : a.id === 'ack' ? 'checkAll' : a.id === 'snooze' ? 'snooze' : 'doorOpen')}${a.label}</span>`)}</div></div>`)}</div></div>`;
  }
  private renderLock() {
    const s = this.settings as NotifySettings;
    return html`<section class="glass sec" data-set-section="lock" id="sec-lock"><header><h2>${nIcon('lock')}${SECTIONS[3].label}</h2></header>
      <div class="frow"><div class="l"><b>רמת פירוט</b></div><div class="r"><div class="seg" role="group" aria-label="רמת פירוט">${LOCKSCREEN_LEVELS.map((l) => html`<button type="button" aria-pressed=${String(s.lockscreen === l)} data-lock-level=${l} @click=${() => this.patchSettings({ lockscreen: l })}>${LOCKSCREEN_LABEL[l]}</button>`)}</div></div></div>
      <div class="lockrow" data-lock-preview>${(['generic', 'type_place', 'full'] as LockscreenLevel[]).map((l) => this.lockPhone(l, s.lockscreen === l))}</div>
      <div class="frow dis"><div class="l"><b>תמונה מהמצלמה בהתראה</b><small>התמונה נפתחת רק בתוך Arx</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(false, 'image-in-push', 'תמונה בהתראה', () => undefined, true)}</div></div>
      <div class="frow dis"><div class="l"><b>צליל קריטי שעוקף "נא לא להפריע"</b><small>בטיחות בלבד · טלפוני Companion</small></div><div class="r"><span class="tag soon">בקרוב</span>${this.tog(s.companion.critical_sound_safety, 'critical-sound', 'צליל קריטי', () => undefined, true)}</div></div></section>`;
  }

  private renderKeep() {
    const s = this.settings as NotifySettings;
    return html`<section class="glass sec" data-set-section="keep" id="sec-keep"><header><h2>${nIcon('calendar')}${SECTIONS[4].label}</h2></header>
      <div class="frow"><div class="l"><b>התראות</b></div><div class="r"><div class="seg sm" role="group" aria-label="שמירת התראות">${RETENTION_CHOICES.map((v: RetentionDays) => html`<button type="button" aria-pressed=${String(s.retention_days === v)} data-keep=${v} @click=${() => this.patchSettings({ retention_days: v })}>${v}</button>`)}</div><span>ימים</span></div></div>
      <div class="frow"><div class="l"><b>יומן מסירה</b></div><div class="r"><span class="tag"><span class="n">${s.deliveries_retention_days}</span> ימים</span></div></div></section>`;
  }

  private renderMail() {
    const s = this.settings as NotifySettings;
    const m = this.mail;
    const e = s.email;
    const set = (patch: Partial<MailDraft>) => (this.mail = { ...this.mail, ...patch });
    const head = this.mailResult
      ? this.mailResult.ok ? html`<span class="tag ok" data-mail-result="ok">${nIcon('check')}${mailResultText(this.mailResult)}</span>` : html`<span class="tag bad" data-mail-result="bad">${nIcon('warning')}${mailResultText(this.mailResult)}</span>`
      : e.last_test ? html`<span class="tag ${e.last_test.ok ? 'ok' : 'bad'}" data-mail-last>${nIcon(e.last_test.ok ? 'check' : 'warning')}${e.last_test.ok ? `נבדק ${clockText(e.last_test.at, this.tz)} · תקין` : `הבדיקה נכשלה · ${e.last_test.detail}`}</span>`
      : html`<span class="tag" data-mail-last>${e.configured ? 'לא נבדק' : 'לא מוגדר'}</span>`;
    return html`<section class="glass sec" data-set-section="mail" id="sec-mail"><header><h2>${nIcon('mail')}${SECTIONS[5].label}</h2><div class="sp">${head}</div></header>
      <div class="fgrid">
        <label>שרת<input class="inp ltr" data-mail-host .value=${m.host} @input=${(ev: Event) => set({ host: (ev.target as HTMLInputElement).value })} /></label>
        <label>פורט<input class="inp ltr" inputmode="numeric" data-mail-port .value=${m.port} @input=${(ev: Event) => set({ port: (ev.target as HTMLInputElement).value })} /></label>
        <label>אבטחה<select class="inp" data-mail-security @change=${(ev: Event) => set({ security: (ev.target as HTMLSelectElement).value as EmailSecurity })}>${(['starttls', 'tls', 'none'] as EmailSecurity[]).map((v) => html`<option value=${v} .selected=${m.security === v}>${v === 'none' ? 'ללא' : v === 'tls' ? 'TLS' : 'STARTTLS'}</option>`)}</select></label>
        <label>משתמש<input class="inp ltr" data-mail-user .value=${m.user} @input=${(ev: Event) => set({ user: (ev.target as HTMLInputElement).value })} /></label>
        <label>סיסמה<span style="display:flex;gap:8px"><input class="inp ltr" type="password" autocomplete="new-password" data-mail-password style="flex:1" .value=${m.pwEdit ? m.password : '••••••••••'} ?readonly=${!m.pwEdit} @input=${(ev: Event) => set({ password: (ev.target as HTMLInputElement).value })} />${e.password_set && !m.pwEdit ? html`<button type="button" class="btn quiet sm" data-mail-pw-change @click=${() => set({ pwEdit: true, password: '' })}>החלפה</button>` : nothing}</span></label>
        <label>מאת<input class="inp ltr" data-mail-from .value=${m.from} @input=${(ev: Event) => set({ from: (ev.target as HTMLInputElement).value })} /></label>
        <label class="w2">נמענים<input class="inp ltr" data-mail-recipients .value=${m.recipients} @input=${(ev: Event) => set({ recipients: (ev.target as HTMLInputElement).value })} /></label>
        <label class="w2">כתובת Arx לקישור<input class="inp ltr" data-mail-linkbase placeholder="https://" .value=${m.linkBase} @input=${(ev: Event) => set({ linkBase: (ev.target as HTMLInputElement).value })} /></label>
      </div>
      ${this.mailError ? html`<div class="errline" data-mail-error role="alert">${this.mailError}</div>` : nothing}
      <div class="frow" style="border-block-start:0;justify-content:flex-end;gap:8px"><button type="button" class="btn quiet" data-mail-test ?disabled=${this.mailBusy !== null || !e.configured} @click=${() => void this.testMail()}>${nIcon(this.mailBusy === 'test' ? 'refresh' : 'send')}${this.mailBusy === 'test' ? 'שולח…' : 'שליחת בדיקה'}</button><button type="button" class="btn primary" data-mail-save ?disabled=${this.mailBusy !== null} @click=${() => void this.saveMail()}>שמירה</button></div></section>`;
  }

  private renderChannels() {
    const s = this.settings as NotifySettings;
    const push = channelStatus('webpush', s, this.devices);
    const mail = channelStatus('email', s, this.devices);
    const pill = (state: string, text: string) => html`<span class="tag ${state === 'on' || state === 'always' ? 'ok' : state === 'soon' ? 'soon' : ''}">${state === 'on' || state === 'always' ? 'פעיל' : text}</span>`;
    return html`<section class="glass sec" data-set-section="chan" id="sec-chan"><header><h2>${nIcon('phone')}${SECTIONS[6].label}</h2></header>
      <div class="frow"><div class="l"><b>מרכז ההתראות במחשב</b></div><div class="r"><div class="seg sm" role="group" aria-label="מרכז ההתראות במחשב">${CENTER_LAYOUTS.map((l: CenterLayout) => html`<button type="button" aria-pressed=${String(s.center_layout === l)} data-layout=${l} @click=${() => this.patchSettings({ center_layout: l })}>${CENTER_LAYOUT_LABEL[l]}</button>`)}</div></div></div>
      <div class="chgrid">
        <div class="chc" data-channel="inbox"><span class="ring">${nIcon('inbox')}</span><b>מרכז ההתראות</b><small>פעיל תמיד · לכל המשתמשים</small>${pill('always', '')}</div>
        <div class="chc" data-channel="webpush"><span class="ring">${nIcon('phone')}</span><b>דחיפה (Arx)</b><small>${push.state === 'on' ? `${this.devices} מכשירים רשומים אצלך` : push.text}</small>${pill(push.state, push.text)}</div>
        <div class="chc" data-channel="email"><span class="ring">${nIcon('mail')}</span><b>דוא"ל</b><small>${mail.state === 'on' ? 'תקלות מערכת וגיבויים' : 'לא מוגדר'}</small>${pill(mail.state, mail.text)}</div>
        <div class="chc" data-channel="app"><span class="ring">${nIcon('phone')}</span><b>אפליקציה לנייד</b><small>לפי המכשירים שנרשמו באפליקציה · שעות השקט כמו דחיפה</small>${pill('on', '')}</div>
        <div class="chc soon" data-channel="ha_mobile"><span class="ring">${nIcon('phone')}</span><b>Companion</b><small>טלפונים לפי משתמש</small><span class="tag soon">בקרוב</span></div>
        <div class="chc soon" data-channel="whatsapp"><span class="ring">${nIcon('chat')}</span><b>WhatsApp</b><small></small><span class="tag soon">בקרוב</span></div>
      </div>
      <div class="devbox"><arx-notifications-settings devices-only embedded></arx-notifications-settings></div></section>`;
  }

  private renderLog() {
    const cards = failurePanel(this.stats);
    const list = logRows(this.log, this.onlyFailed);
    const fails = failedCount(this.log);
    return html`<section class="glass sec" data-set-section="log" id="sec-log"><header><h2>${nIcon('inbox')}${SECTIONS[7].label}</h2><div class="sp"><span class="tag" data-log-window>${s14()}</span><div class="seg sm" role="group" aria-label="סינון היומן"><button type="button" aria-pressed=${String(!this.onlyFailed)} data-log-filter="all" @click=${() => (this.onlyFailed = false)}>הכל</button><button type="button" aria-pressed=${String(this.onlyFailed)} data-log-filter="failed" @click=${() => (this.onlyFailed = true)}>רק כשלים${fails ? html`<small class="n">${fails}</small>` : nothing}</button></div></div></header>
      <div class="fails" data-fail-panel>${cards.map((c) => html`<div class="fstat ${c.tone}" data-fail-card=${c.channel}><span class="ch">${c.label} · 24 שעות</span><b class="n">${c.failed > 0 ? c.failed : c.sent}</b><small>${c.failed > 0 ? 'נכשלו' : 'נשלחו'}${c.skipped ? ` · ${c.skipped} לא נשלחו` : ''}</small></div>`)}</div>
      <div class="lgw"><table class="lg"><thead><tr><th>שעה</th><th>התראה</th><th>משתמש</th><th>ערוץ</th><th>מצב</th><th>סיבה</th></tr></thead><tbody>${list.length ? list.map((d) => html`<tr data-log-row=${d.id} data-log-status=${d.status}><td class="n" style="direction:rtl">${relativeTime(d.at, this.now, this.tz)}</td><td>${this.titles[d.notification_id] ?? '—'}</td><td>${d.user_display}</td><td>${nIcon(d.channel === 'email' ? 'mail' : 'phone')}${CHANNEL_LABEL[d.channel]}</td><td class=${STATUS_TONE[d.status]}>${nIcon(STATUS_ICON[d.status])}${DELIVERY_STATUS_LABEL[d.status]}</td><td>${deliveryReasonText(d.reason) || '—'}</td></tr>`) : html`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--dv-text-3)">אין רשומות</td></tr>`}</tbody></table></div></section>`;
  }

  private renderPicker() {
    const p = this.picker;
    if (!p) return nothing;
    const users = this.users;
    return html`<sw-dialog open heading="משתמשים נבחרים" data-user-picker @close=${() => (this.picker = null)}>
      ${users && users.length
        ? html`<div class="pick" role="group">${users.map((u) => html`<button type="button" role="checkbox" aria-checked=${String(p.selected.includes(u.id))} data-pick=${u.id} @click=${() => (this.picker = { ...p, selected: p.selected.includes(u.id) ? p.selected.filter((x) => x !== u.id) : [...p.selected, u.id] })}><span class="chk" aria-hidden="true" data-on=${String(p.selected.includes(u.id))} style=${p.selected.includes(u.id) ? 'background:var(--dv-accent);border-color:transparent' : ''}>${nIcon('check')}</span>${u.name}</button>`)}</div>`
        : html`<div class="errline">רשימת המשתמשים לא זמינה</div>`}
      <button slot="footer" type="button" class="btn quiet" @click=${() => (this.picker = null)}>ביטול</button>
      <button slot="footer" type="button" class="btn primary" data-pick-save ?disabled=${!p.selected.length} @click=${() => this.savePicker()}>שמירה</button>
    </sw-dialog>`;
  }

  private renderBody() {
    if (this.phase === 'loading') return html`<div class="skbox" data-set-state="loading" aria-busy="true"><span class="skl"></span><span class="skl"></span><span class="skl"></span></div>`;
    if (this.phase === 'error') return html`<div class="errbar" role="alert" data-set-state="error">${nIcon('warning')}<span>${this.error || 'לא ניתן לטעון את ההגדרות'}</span><button type="button" class="btn sm" data-set-retry @click=${() => void this.load()}>${nIcon('refresh')}נסה שוב</button></div>`;
    if (this.phase === 'user') return html`<div class="secs" data-set-state="user"><section class="glass sec"><arx-notifications-settings devices-only embedded></arx-notifications-settings></section></div>`;
    const sections: Record<SecId, () => TemplateResult> = { sources: () => this.renderSources(), quiet: () => this.renderQuiet(), esc: () => this.renderEsc(), lock: () => this.renderLock(), keep: () => this.renderKeep(), mail: () => this.renderMail(), chan: () => this.renderChannels(), log: () => this.renderLog() };
    return html`<div class="set" data-set-state="ready"><nav class="glass setnav" aria-label="מדורים">${SECTIONS.map((x) => html`<button type="button" aria-current=${String(this.sec === x.id)} data-set-nav=${x.id} @click=${() => this.setSec(x.id)}>${nIcon(x.icon)}${x.label}</button>`)}</nav>
      <div class="secs">${this.phone ? sections[this.sec]() : SECTIONS.map((x) => sections[x.id]())}</div></div>`;
  }

  render() {
    return html`<div class="page" data-notify-settings data-phase=${this.phase}>
      <header class="dh flat"><div class="dh-row"><h1>התראות</h1><span class="crumb">${nIcon('settings')}מערכת</span></div></header>
      ${this.renderBody()}
    </div>
    ${this.renderPicker()}
    ${this.toast ? html`<div class="toast" role="status" data-set-toast>${nIcon(this.toast.bad ? 'warning' : 'check')}${this.toast.text}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-notifications': SystemNotifications;
  }
}
