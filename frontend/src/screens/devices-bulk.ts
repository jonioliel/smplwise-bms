import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import type { DeviceCounts } from '../api/devices';
import { ALARM_HE } from '../api/devices';
import {
  BULK_KINDS,
  BULK_KIND_LABEL,
  BULK_SCOPE_LABEL,
  OUTCOME_LABEL,
  bulkHeadline,
  followBulk,
  previewBulk,
  runBulk,
  type BulkKind,
  type BulkPreview,
  type BulkRecord,
  type BulkScope,
} from '../api/device-bulk';
import { bidi, ltrNum } from '../i18n/bidi';

/** What a screen asks the dialog to do: the scope, its id and display name, and the kind. */
export interface BulkRequest {
  scope: BulkScope;
  id: string;
  name: string;
  kind: BulkKind;
}

/** How many entities a kind would reach according to the tree's counts (a hint for the menu only - the server's
 * preview is what the dialog states and what is sent). */
export function activeFor(kind: BulkKind, c: DeviceCounts): number {
  if (kind === 'lights_off') return c.lights_on;
  if (kind === 'covers_close') return c.covers_open;
  if (kind === 'climate_off') return c.climate_active;
  if (kind === 'screens_off') return c.media_on;
  return c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.media_on;
}

const KIND_ICON: Record<BulkKind, IconName> = { lights_off: 'light', covers_close: 'layers', climate_off: 'activity', screens_off: 'play', all_off: 'bolt' };

function requestEvent(req: BulkRequest): CustomEvent<BulkRequest> {
  return new CustomEvent<BulkRequest>('bulk-request', { detail: req, bubbles: true, composed: true });
}

/**
 * The quick actions of one scope (CR-007 slice 3, the approved mockup's board 1): a trigger that opens either a menu
 * (a floor: the five actions) or a popover (an area row / tile: the area's state chips, the four quick actions,
 * "כבה הכל באזור" and "פתח אזור ›"). The trigger is a "⋯" button, a text button (`triggerLabel`, e.g. "כבה קומה ▾"), or
 * the caller's own element in the `trigger` slot (a whole tree / card row). Without `actions` (a viewer who does not
 * hold devices.control_bulk there) the popover shows the chips and the link only. Picking an action never sends
 * anything: it raises `bulk-request`, and the screen opens the confirmation dialog (devices-bulk-dialog), the only
 * place that sends.
 */
@customElement('devices-bulk-menu')
export class DevicesBulkMenu extends LitElement {
  @property() scope: BulkScope = 'area';
  @property() targetId = '';
  @property() targetName = '';
  @property({ attribute: false }) counts: DeviceCounts | null = null;
  /** "menu": the five actions; "popover": state chips first, then the actions. */
  @property() variant: 'menu' | 'popover' = 'menu';
  @property() label = 'פעולות';
  /** Which edge of the trigger the panel lines up with: `end` (it opens toward the inline start - a tile's corner, the
   * page header) or `start` (it opens toward the inline end - a floor heading near the start edge). */
  @property({ reflect: true }) align: 'start' | 'end' = 'end';
  /** A text trigger instead of the "⋯" icon (the floor card's "כבה קומה ▾"). */
  @property() triggerLabel = '';
  /** Offer the bulk actions (false: chips and the "open" link only). */
  @property({ type: Boolean }) actions = true;
  /** "פתח אזור ›": the area screen's link, shown at the foot of the popover. */
  @property() openHref = '';
  /** The host fills its row (a slotted row trigger). */
  @property({ type: Boolean, reflect: true }) block = false;
  @state() private open = false;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }
    :host([block]) {
      display: flex;
    }
    :host([block]) slot[name='trigger'] {
      display: contents;
    }
    :host([block]) ::slotted([slot='trigger']) {
      flex: 1;
      min-inline-size: 0;
    }
    .panel {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-end: 0;
      z-index: var(--sw-z-topbar);
      min-inline-size: 220px;
      max-inline-size: min(300px, calc(100vw - 32px));
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    :host([align='start']) .panel {
      inset-inline-end: auto;
      inset-inline-start: 0;
    }
    .title {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding: 4px 8px 2px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      padding: 4px 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      margin-block-end: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .chip.warm {
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    button.item {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    button.item:hover:not(:disabled),
    button.item:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
    button.item:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    button.item.all {
      border-block-start: 1px solid var(--sw-border);
      border-start-start-radius: 0;
      border-start-end-radius: 0;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-danger);
      margin-block-start: 2px;
    }
    button.item.all:disabled {
      color: var(--sw-text-3);
    }
    .n {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .foot {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding: 6px 8px 2px;
    }
    a.open {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    a.open:hover,
    a.open:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
  `;

  private onDoc = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.open = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.open = false;
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDoc, true);
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onDoc, true);
    window.removeEventListener('keydown', this.onKey);
  }

  private pick(kind: BulkKind) {
    this.open = false;
    this.dispatchEvent(requestEvent({ scope: this.scope, id: this.targetId, name: this.targetName, kind }));
  }

  private toggle(e: Event) {
    e.preventDefault();
    e.stopPropagation(); // a trigger inside a tile must never follow the tile's own link
    this.open = !this.open;
  }

  render() {
    const fallback = this.triggerLabel
      ? html`<sw-button size="sm" data-bulk-trigger=${this.scope} aria-haspopup="menu" aria-expanded=${String(this.open)}>${this.triggerLabel} ▾</sw-button>`
      : html`<sw-button size="sm" variant="ghost" icon="more" iconOnly label=${`${this.label}: ${this.targetName}`} data-bulk-trigger=${this.scope} aria-haspopup="menu" aria-expanded=${String(this.open)}></sw-button>`;
    return html`<slot name="trigger" @click=${this.toggle}>${fallback}</slot>${this.open ? this.renderPanel() : nothing}`;
  }

  private renderPanel() {
    const c = this.counts;
    return html`<div class="panel" role="menu" data-bulk-panel=${this.variant} aria-label=${`${BULK_SCOPE_LABEL[this.scope]} ${this.targetName}`} @click=${(e: Event) => e.stopPropagation()}>
      <div class="title">${BULK_SCOPE_LABEL[this.scope]} · ${bidi(this.targetName)}</div>
      ${this.variant === 'popover' && c ? this.renderChips(c) : nothing}
      ${this.actions
        ? html`${BULK_KINDS.map((k) => {
              const n = c ? activeFor(k, c) : null;
              const label = k === 'all_off' ? `${BULK_KIND_LABEL[k]}${this.scope === 'area' ? ' באזור' : this.scope === 'floor' ? ' בקומה' : ''} · אישור` : BULK_KIND_LABEL[k];
              return html`<button class=${classMap({ item: true, all: k === 'all_off' })} role="menuitem" data-bulk-kind=${k} ?disabled=${n === 0} @click=${() => this.pick(k)}>
                <sw-icon .name=${KIND_ICON[k]} size=${14}></sw-icon>${label}${n !== null ? html`<span class="n">${n === 0 ? 'אין פעילים' : `${ltrNum(n)} פעילים`}</span>` : nothing}
              </button>`;
            })}
            <div class="foot">כל פעולה נפתחת בחלון אישור. מנעולים ואזעקה אינם נכללים.</div>`
        : nothing}
      ${this.openHref ? html`<a class="open" href=${this.openHref} data-open-area role="menuitem" @click=${() => (this.open = false)}>פתח אזור<span aria-hidden="true">›</span></a>` : nothing}
    </div>`;
  }

  private renderChips(c: DeviceCounts) {
    const chip = (icon: IconName, text: string, warm: boolean, key: string) => html`<span class=${classMap({ chip: true, warm })} data-chip=${key}><sw-icon .name=${icon} size=${12}></sw-icon>${text}</span>`;
    return html`<div class="chips">
      ${c.lights ? chip('light', `תאורה ${c.lights_on}/${c.lights}`, c.lights_on > 0, 'lights') : nothing}
      ${c.switches ? chip('bolt', `מתגים ${c.switches_on}/${c.switches}`, c.switches_on > 0, 'switches') : nothing}
      ${c.covers ? chip('layers', `תריסים פתוחים ${c.covers_open}/${c.covers}`, c.covers_open > 0, 'covers') : nothing}
      ${c.climate ? chip('activity', `מיזוג ${c.climate_active}/${c.climate}`, c.climate_active > 0, 'climate') : nothing}
      ${c.media ? chip('play', `מסכים ${c.media_on}/${c.media}`, c.media_on > 0, 'media') : nothing}
      ${c.locks ? chip('lock', `נעולים ${c.locks_locked}/${c.locks}`, false, 'locks') : nothing}
      ${c.alarm ? chip('shield', `אזעקה: ${ALARM_HE[c.alarm] ?? c.alarm}`, false, 'alarm') : nothing}
      ${!c.entities ? html`<span class="chip">אין התקנים</span>` : nothing}
    </div>`;
  }
}

type Phase = 'closed' | 'loading' | 'confirm' | 'nothing' | 'sending' | 'running' | 'result' | 'error';

/**
 * The confirmation dialog of every bulk action, and the only place that sends one. It states exactly what the server
 * will send (the server's own preview: scope, kind, entity count by domain, what is skipped and why, and that locks and
 * the alarm are never included); focus starts on Cancel; only its confirm button calls runBulk (`confirmed: true`,
 * with the preview's digest, so a set that changed in between is refused rather than sent). Then progress ("n of m
 * confirmed") and an honest result: "בוצע" only when every entity confirmed, otherwise "בוצע חלקית: k לא אושרו" with the
 * list, "תוצאה לא ידועה" named per entity - never "everything is off". Raises `bulk-done` when the record is done.
 */
@customElement('devices-bulk-dialog')
export class DevicesBulkDialog extends LitElement {
  @state() private phase: Phase = 'closed';
  @state() private req: BulkRequest | null = null;
  @state() private preview: BulkPreview | null = null;
  @state() private record: BulkRecord | null = null;
  @state() private error = '';
  private follow: { stopped: boolean } | null = null;

  static styles = css`
    .what {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .big {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .domains {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
    }
    .domains span {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .never {
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    details {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    details ul,
    .list {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      max-block-size: 160px;
      overflow: auto;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 6px;
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: 4px;
    }
    .bar {
      block-size: 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      overflow: hidden;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
    }
    .headline {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .headline.ok {
      color: var(--sw-success);
    }
    .headline.partial,
    .headline.none {
      color: var(--sw-warning);
    }
    .outcome {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-start: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `;

  /** Open the dialog for one request: loads the server's preview, then waits for Cancel or the confirm button. */
  async show(req: BulkRequest) {
    if (this.phase === 'sending' || this.phase === 'running') return; // one at a time from this screen
    this.req = req;
    this.preview = null;
    this.record = null;
    this.error = '';
    this.phase = 'loading';
    try {
      const p = await previewBulk(req.scope, req.id, req.kind);
      if (this.req !== req) return;
      this.preview = p;
      this.phase = p.count ? 'confirm' : 'nothing';
    } catch (err) {
      if (this.req !== req) return;
      this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאה לפעולות מרוכזות בהיקף הזה.' : describeError(err);
      this.phase = 'error';
    }
  }

  get running(): boolean {
    return this.phase === 'sending' || this.phase === 'running';
  }

  private close = () => {
    if (this.phase === 'sending') return; // the request is on its way: the dialog stays until the server answered
    this.phase = 'closed';
  };

  private async confirm() {
    const req = this.req;
    const p = this.preview;
    if (!req || !p || this.phase !== 'confirm') return;
    this.phase = 'sending';
    try {
      const first = await runBulk(req.scope, req.id, req.kind, p.digest);
      this.phase = 'running';
      this.follow = { stopped: false };
      const done = await followBulk(first, (r) => (this.record = r), this.follow);
      this.record = done;
      this.phase = 'result';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: done, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'target_changed'
        ? 'רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.'
        : describeError(err);
      this.phase = 'error';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: null, bubbles: true, composed: true }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.follow) this.follow.stopped = true;
  }

  /** Focus starts on Cancel whenever the dialog shows a new step (sw-dialog itself focuses only when it opens, and
   * the preview arrives after that): a stray Enter can never confirm a bulk action. */
  protected updated(changed: Map<string, unknown>) {
    if (!changed.has('phase') || this.phase === 'closed' || this.phase === 'sending' || this.phase === 'running') return;
    requestAnimationFrame(() => {
      const btn = this.renderRoot.querySelector<HTMLElement>('sw-button[data-bulk-cancel]');
      const inner = btn?.shadowRoot?.querySelector<HTMLElement>('button');
      (inner ?? btn)?.focus({ preventScroll: true });
    });
  }

  render() {
    const req = this.req;
    if (this.phase === 'closed' || !req) return html`<sw-dialog data-bulk-dialog="closed"></sw-dialog>`;
    const heading = `${BULK_KIND_LABEL[req.kind]} · ${BULK_SCOPE_LABEL[req.scope]}${req.scope === 'building' ? '' : ` ${req.name}`}`;
    return html`<sw-dialog open data-bulk-dialog=${this.phase} heading=${heading} subheading="פעולה מרוכזת על כמה התקנים בבת אחת" @close=${this.close}>
      ${this.renderBody()}
    </sw-dialog>`;
  }

  private renderBody() {
    const cancel = (label = 'ביטול') => html`<sw-button data-bulk-cancel autofocus @click=${this.close}>${label}</sw-button>`;
    if (this.phase === 'loading') return html`<div class="muted">בודק מה יישלח…</div><div class="actions">${cancel()}</div>`;
    if (this.phase === 'error') return html`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${cancel('סגור')}</div>`;
    const p = this.preview;
    if (this.phase === 'nothing' && p) {
      return html`<div class="what" data-bulk-nothing>
          <div class="big">אין מה לשלוח</div>
          <div>לפי הדיווח האחרון של Home Assistant אין ב${BULK_SCOPE_LABEL[p.scope]} ${p.scope === 'building' ? '' : bidi(p.name)} התקן פעיל מהסוג הזה.</div>
          ${this.renderSkipped(p)}
          <div class="never">${p.note}</div>
        </div>
        <div class="actions">${cancel('סגור')}</div>`;
    }
    if (this.phase === 'confirm' && p) return this.renderConfirm(p);
    const r = this.record;
    if (this.phase === 'sending' || !r) return html`<div class="muted" data-bulk-progress>שולח…</div>`;
    return this.renderProgress(r);
  }

  private renderSkipped(p: BulkPreview) {
    return html`${p.skipped.already ? html`<div class="muted" data-bulk-skipped="already">${ltrNum(p.skipped.already)} כבר במצב המבוקש לפי Home Assistant - לא יישלח אליהם.</div>` : nothing}
      ${p.skipped.unavailable ? html`<div class="muted" data-bulk-skipped="unavailable">${ltrNum(p.skipped.unavailable)} לא זמינים ב־Home Assistant - לא יישלח אליהם.</div>` : nothing}
      ${p.excluded.length
        ? html`<details data-bulk-excluded><summary>${ltrNum(p.excluded.length)} לא נכללים בכוונה (דלתות ושערים)</summary><ul>${p.excluded.map((x) => html`<li>${bidi(x.name)} - ${x.reason_label}</li>`)}</ul></details>`
        : nothing}`;
  }

  private renderConfirm(p: BulkPreview) {
    const never = Object.entries(p.never_included);
    return html`<div class="what" data-bulk-what>
        <div class="big" data-bulk-count=${p.count}>יישלח ${p.kind_label} ל־${ltrNum(p.count)} התקנים${p.scope === 'building' ? ' במבנה כולו' : ` ב${BULK_SCOPE_LABEL[p.scope]} ${bidi(p.name)}`}${p.floor_name ? ` (${bidi(p.floor_name)})` : ''}:</div>
        <div class="domains" data-bulk-domains>${Object.entries(p.by_domain).map(([d, n]) => html`<span data-domain=${d}>${p.domain_labels[d] ?? d}: ${ltrNum(n)}</span>`)}</div>
        <details><summary>רשימת ההתקנים</summary><ul>${p.targets.map((t) => html`<li>${bidi(t.name)}${t.area_name && p.scope !== 'area' ? html` <span class="muted">· ${bidi(t.area_name)}</span>` : nothing}</li>`)}</ul></details>
        ${this.renderSkipped(p)}
        <div class="never" data-bulk-never>
          ${p.note}${never.length ? html`<br />נמצאים כאן ואינם נכללים: ${never.map(([d, n]) => `${p.domain_labels[d] ?? d} (${n})`).join(', ')}.` : nothing}
        </div>
        <div class="muted">התקן ייחשב כבוי / סגור רק כש־Home Assistant ידווח על כך.</div>
      </div>
      <div class="actions">
        <sw-button data-bulk-cancel autofocus @click=${this.close}>ביטול</sw-button>
        <sw-button data-bulk-confirm variant="danger" @click=${() => void this.confirm()}>${BULK_KIND_LABEL[p.kind]} (${ltrNum(p.count)})</sw-button>
      </div>`;
  }

  private renderProgress(r: BulkRecord) {
    const h = bulkHeadline(r);
    const c = r.counts;
    const pct = c.total ? Math.round((c.confirmed / c.total) * 100) : 0;
    const notOk = r.items.filter((i) => i.outcome !== 'confirmed');
    return html`<div class="what" data-bulk-progress data-confirmed=${c.confirmed} data-total=${c.total} data-done=${String(r.done)}>
        <div class=${classMap({ headline: true, [h.tone]: true })} data-bulk-result=${r.done ? h.tone : 'running'}>
          ${r.done ? html`<sw-icon .name=${h.tone === 'ok' ? 'check' : 'warning'} size=${16}></sw-icon>` : nothing}${h.text}
        </div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${c.total} aria-valuenow=${c.confirmed} aria-label="אושרו"><div style=${`inline-size:${pct}%`}></div></div>
        <div class="muted">${ltrNum(c.confirmed)} מתוך ${ltrNum(c.total)} אושרו${r.done ? '' : ` · ${ltrNum(c.accepted + c.queued)} ממתינים`}${c.unknown ? ` · ${ltrNum(c.unknown)} תוצאה לא ידועה` : ''}</div>
        ${r.done && notOk.length
          ? html`<div data-bulk-not-confirmed>
              <div class="muted">${notOk.length === 1 ? 'התקן שלא אושר:' : 'התקנים שלא אושרו:'}</div>
              <ul class="list">${notOk.map((i) => html`<li data-entity=${i.entity_id} data-outcome=${i.outcome}>${bidi(i.name)}<span class="outcome">${OUTCOME_LABEL[i.outcome]}${i.outcome === 'refused' && !i.sent ? ' (לא נשלח)' : ''}</span></li>`)}</ul>
            </div>`
          : nothing}
        ${r.done ? html`<div class="muted">${r.note}</div>` : html`<div class="muted">אפשר לסגור את החלון; הפעולה ממשיכה בשרת.</div>`}
      </div>
      <div class="actions"><sw-button data-bulk-cancel autofocus @click=${this.close}>סגור</sw-button></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-bulk-menu': DevicesBulkMenu;
    'devices-bulk-dialog': DevicesBulkDialog;
  }
}
