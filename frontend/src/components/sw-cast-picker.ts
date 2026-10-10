import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import './sw-badge';
import './sw-sheet';
import './sw-cast-stop';
import { ApiError, describeError } from '../api/client';
import { castStart, castSwitch, castTargets, newRequestId, type CastProfile, type CastSession, type CastTarget, type CastTargets } from '../api/cast';
import { CAST_CONFIDENCE_LABEL } from '../screens/media-cast-label';
import { CastWatch, castStore } from './cast-store';
import { canPick, groupTargets, needsConfirm, notReadyText, pickerPresentation, pushRecent, readRecent, refusedText, sessionOfTarget, targetLine } from '../screens/cast-logic';
import { can } from '../api/session';
import { t } from '../i18n/he';

/** Operator words for the screen's confidence: never the technology name (the settings screens keep those). */
const CONFIDENCE_OPERATOR: Record<string, string> = { confirmed: CAST_CONFIDENCE_LABEL.confirmed, likely: CAST_CONFIDENCE_LABEL.likely, unknown: CAST_CONFIDENCE_LABEL.unknown, manual: 'נקבע ידנית' };

/**
 * CR-028: "לאיזה מסך?" - the picker of the live camera screen (owner decisions 2026-10-05: Q2 a panel docked to the button on a wide screen, a
 * bottom sheet or the docked list on the phone by the owner's `ui.dd_phone` setting - default list; Q4 blocked screens per the installation setting,
 * default grey with the reason; Q5 a link to "המסכים שלי"). Rows are grouped "לאחרונה" then by floor; a row starts the cast at once with the screen's
 * own duration, a small "קבוע" button starts a permanent one on a screen the administrator marked for it. A screen playing music asks first.
 * A screen that already carries MY cast of another camera is switched (one new command), never stopped and started again.
 * Events: `close`, `cast-started` {session}, `cast-error` {message}. The element draws nothing while closed.
 */
@customElement('sw-cast-picker')
export class SwCastPicker extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() cameraId = '';
  @property() cameraName = '';
  /** The element the panel hangs on (the cast button); the panel opens above it, or below when there is no room. */
  @property({ attribute: false }) anchor: HTMLElement | null = null;
  /** The profile the live screen shows; `main` only matters when the screen allows it. */
  @property() profile: CastProfile = 'sub';
  @property({ type: Boolean }) phone = false;
  @property() ddPhone = '';
  /** Remote (/arx) mode: only start / extend / switch / stop; the note says the playback is on the home network. */
  @property({ type: Boolean }) remote = false;
  @state() private data: CastTargets | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private busyKey = '';
  @state() private confirm: { target: CastTarget; permanent: boolean } | null = null;
  @state() private quality: CastProfile = 'sub';
  private watch = new CastWatch(this);
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.close();
  };
  private onDoc = (e: Event) => {
    if (!this.open || this.mode() === 'sheet') return;
    const path = e.composedPath();
    if (path.includes(this) || (this.anchor && path.includes(this.anchor))) return;
    this.close();
  };

  static styles = css`
    :host {
      display: contents;
    }
    .panel {
      box-sizing: border-box;
      background: var(--sw-surface);
      color: var(--sw-text);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .panel.pop {
      position: fixed;
      z-index: var(--sw-z-drawer);
      inline-size: min(380px, calc(100vw - 24px));
      max-block-size: min(70vh, 560px);
    }
    .panel.list {
      inline-size: 100%;
      margin-block-start: 10px;
      max-block-size: 60vh;
    }
    .panel.sheet {
      border: 0;
      box-shadow: none;
      background: transparent;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px 6px;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .x {
      all: unset;
      box-sizing: border-box;
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .x:hover {
      background: var(--sw-surface-3);
    }
    .x:focus-visible,
    .row:focus-visible,
    .seg button:focus-visible,
    .perm:focus-visible,
    .link:focus-visible,
    .yes:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .opts {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 14px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .seg {
      display: inline-flex;
      padding: 2px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      padding: 3px 12px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent, var(--sw-text));
      box-shadow: var(--sw-shadow-1);
    }
    .seg button[disabled] {
      opacity: 0.5;
      cursor: default;
    }
    .body {
      overflow: auto;
      padding: 0 8px 6px;
    }
    .grp {
      margin: 8px 6px 2px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .row-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 8px;
      border-radius: var(--sw-r-md);
      cursor: pointer;
      min-block-size: 44px;
    }
    .row:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-3);
    }
    .row[aria-disabled='true'] {
      cursor: default;
      opacity: 0.6;
    }
    .ic {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .row.casting .ic {
      background: color-mix(in srgb, var(--sw-live) 18%, var(--sw-surface));
      color: var(--sw-live);
    }
    .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ln.warn {
      color: var(--sw-stale);
    }
    .perm {
      all: unset;
      box-sizing: border-box;
      flex: none;
      padding: 4px 10px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .perm:hover {
      background: var(--sw-surface-3);
    }
    .err,
    .state {
      margin: 4px 14px 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .err {
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      color: var(--sw-danger);
    }
    .state {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .ask {
      margin: 6px 8px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-surface));
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ask .btns {
      display: flex;
      gap: 8px;
    }
    .yes,
    .no {
      all: unset;
      box-sizing: border-box;
      padding: 6px 14px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
    }
    .yes {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
    }
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 14px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .link {
      all: unset;
      cursor: pointer;
      color: var(--sw-accent);
      font-size: var(--sw-fs-xs);
    }
    .note {
      padding: 0 14px 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('pointerdown', this.onDoc, true);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('pointerdown', this.onDoc, true);
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.error = '';
      this.confirm = null;
      this.quality = this.profile === 'main' ? 'main' : 'sub';
      void this.load();
    }
  }

  protected updated(changed: Map<string, unknown>) {
    if (this.open && this.mode() === 'pop' && (changed.has('open') || changed.has('data'))) this.place();
  }

  /** `pop` (a wide screen's docked panel), `list` (the phone's docked list), `sheet` (the phone's bottom sheet). */
  private mode(): 'pop' | 'list' | 'sheet' {
    const m = pickerPresentation({ phone: this.phone, ddPhone: this.ddPhone });
    return m === 'panel' ? 'pop' : m;
  }

  private async load() {
    this.loading = true;
    try {
      this.data = await castTargets(this.cameraId || undefined);
    } catch (err) {
      this.data = null;
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private place() {
    const panel = this.renderRoot.querySelector<HTMLElement>('.panel.pop');
    const a = this.anchor;
    if (!panel || !a) return;
    const r = a.getBoundingClientRect();
    const h = panel.offsetHeight;
    const w = panel.offsetWidth;
    const above = r.top - 8 - h >= 8;
    const top = above ? r.top - 8 - h : Math.min(window.innerHeight - h - 8, r.bottom + 8);
    // the panel's inline-end edge sits on the button's (RTL: the right edge); clamped into the viewport
    const rtl = getComputedStyle(this).direction === 'rtl';
    let left = rtl ? r.right - w : r.left;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${left}px`;
  }

  private close() {
    this.confirm = null;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private mineOn(key: string): CastSession | null {
    const s = sessionOfTarget(castStore.sessions, key);
    return s && s.mine ? s : null;
  }

  private async pick(tg: CastTarget, permanent = false, confirmed = false) {
    if (!canPick(tg) || this.busyKey || !this.cameraId) return;
    if (needsConfirm(tg) && !confirmed) {
      this.confirm = { target: tg, permanent };
      return;
    }
    this.confirm = null;
    this.busyKey = tg.key;
    this.error = '';
    const profile: CastProfile = this.quality === 'main' && tg.main_allowed ? 'main' : 'sub';
    try {
      const mine = this.mineOn(tg.key);
      const r = mine && mine.can.switch && !permanent && mine.camera_id !== this.cameraId
        ? await castSwitch(mine.session_id, { camera_id: this.cameraId, profile })
        : await castStart({ target_key: tg.key, camera_id: this.cameraId, profile, duration: permanent ? 'permanent' : 'default', client_request_id: newRequestId(), confirmed: confirmed || undefined });
      castStore.put(r.session);
      if (r.status === 'refused') {
        this.error = refusedText(r.error);
        this.dispatchEvent(new CustomEvent('cast-error', { detail: { message: this.error }, bubbles: true, composed: true }));
        return;
      }
      pushRecent(tg.key);
      this.dispatchEvent(new CustomEvent('cast-started', { detail: { session: r.session }, bubbles: true, composed: true }));
      this.close();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'cast_busy' && !confirmed) {
        this.confirm = { target: tg, permanent };
      } else {
        this.error = describeError(err);
        this.dispatchEvent(new CustomEvent('cast-error', { detail: { message: this.error }, bubbles: true, composed: true }));
        void this.load();
      }
    } finally {
      this.busyKey = '';
    }
  }

  private row(tg: CastTarget): TemplateResult {
    const mine = this.mineOn(tg.key);
    const here = !!mine && mine.camera_id === this.cameraId;
    const grey = !canPick(tg) || here;
    const sess = sessionOfTarget(castStore.sessions, tg.key);
    const line = here ? `${t('cast.stateCasting')}: ${this.cameraName || mine?.camera_name || ''}` : targetLine(tg, sess);
    const area = [tg.area_name].filter(Boolean).join(' · ');
    const conf = tg.confidence && !tg.blocked ? CONFIDENCE_OPERATOR[tg.confidence] : '';
    return html`<div class="row-wrap" data-cast-target=${tg.key}>
      <button type="button" class=${`row ${tg.state === 'casting' ? 'casting' : ''}`} aria-disabled=${grey ? 'true' : 'false'} data-cast-state=${tg.state} data-cast-blocked=${tg.blocked ?? ''}
        @click=${() => (grey ? undefined : void this.pick(tg))}>
        <span class="ic"><sw-icon name=${tg.blocked ? 'lock' : 'media'} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${tg.name}</span><span class=${`ln ${tg.state === 'playing_music' ? 'warn' : ''}`}>${area ? `${area} · ` : ''}${this.busyKey === tg.key ? t('cast.starting') : line}</span></span>
        ${conf ? html`<sw-badge kind=${tg.confidence === 'confirmed' ? 'live' : 'neutral'} label=${conf}></sw-badge>` : nothing}
      </button>
      ${tg.permanent_allowed && !grey ? html`<button type="button" class="perm" data-cast-permanent title=${t('cast.durationPermanent')} aria-label=${`${t('cast.durationPermanent')}: ${tg.name}`} @click=${() => void this.pick(tg, true)}>${t('cast.pillPermanent')}</button>` : nothing}
      ${here && mine ? html`<sw-cast-stop .session=${mine} variant="ghost"></sw-cast-stop>` : nothing}
    </div>`;
  }

  private body(): TemplateResult {
    const d = this.data;
    const admin = can('system.configure');
    if (this.loading && !d) return html`<div class="state" role="status" data-cast-loading>${t('cast.loading')}</div>`;
    if (!d) return this.error ? html`<div class="err" role="alert" data-cast-error>${this.error}</div>` : html`${nothing}`;
    if (!d.ready) return html`<div class="state" role="status" data-cast-notready>${notReadyText(d.reason, admin)}</div>`;
    const groups = groupTargets(d.targets, readRecent());
    const mainOk = d.main_possible;
    return html`
      <div class="opts" data-cast-quality>
        <span>${t('camera.quality')}</span>
        <div class="seg" role="group" aria-label=${t('camera.quality')}>
          <button type="button" aria-pressed=${this.quality === 'sub'} data-cast-q="sub" @click=${() => (this.quality = 'sub')}>${t('cast.profileSub')}</button>
          <button type="button" aria-pressed=${this.quality === 'main'} data-cast-q="main" ?disabled=${!mainOk} title=${mainOk ? '' : t('cast.profileMainNo')} @click=${() => (this.quality = 'main')}>${t('cast.profileMain')}</button>
        </div>
      </div>
      ${this.error ? html`<div class="err" role="alert" data-cast-error>${this.error}</div>` : nothing}
      ${this.confirm
        ? html`<div class="ask" role="alertdialog" aria-label=${t('cast.confirmBusy')} data-cast-confirm>
            <span>${this.confirm.target.name}: ${t('cast.confirmBusy')}</span>
            <div class="btns"><button type="button" class="yes" data-cast-confirm-yes @click=${() => void this.pick(this.confirm!.target, this.confirm!.permanent, true)}>${t('cast.confirmBusyYes')}</button>
              <button type="button" class="no" data-cast-confirm-no @click=${() => (this.confirm = null)}>${t('actions.cancel')}</button></div>
          </div>`
        : nothing}
      <div class="body" data-cast-list>
        ${groups.length
          ? groups.map((g) => html`<div class="grp" data-cast-group=${g.id}>${g.title}</div>${g.targets.map((x) => this.row(x))}`)
          : html`<div class="state" data-cast-empty>${t('cast.empty')}</div>`}
      </div>
      ${this.remote ? html`<div class="note" data-cast-remote-note>${t('cast.remoteNote')}</div>` : nothing}`;
  }

  private head(withClose: boolean): TemplateResult {
    return html`<header><div><h3>${t('cast.pickerTitle')}</h3>${this.cameraName ? html`<div class="sub">${t('cast.pickerFor')} ${this.cameraName}</div>` : nothing}</div>
      ${withClose ? html`<button type="button" class="x" aria-label=${t('cast.close')} data-cast-close @click=${() => this.close()}><sw-icon name="close" size=${16}></sw-icon></button>` : nothing}</header>`;
  }

  private foot(): TemplateResult {
    const d = this.data;
    return html`<footer><span>${d && d.ready ? `${d.active}/${d.max_sessions}` : ''}</span>
      <a class="link" data-cast-mine href="#/multimedia/cast" @click=${(e: Event) => { e.preventDefault(); this.close(); location.hash = '#/multimedia/cast'; }}>${t('cast.mineLink')}</a></footer>`;
  }

  render() {
    if (!this.open) return nothing;
    const mode = this.mode();
    void this.watch;
    if (mode === 'sheet') {
      return html`<sw-sheet open kind="sheet" @close=${() => this.close()}>
        <div class="panel sheet" data-cast-picker="sheet" role="region" aria-label=${t('cast.sheetRegion')}>${this.head(false)}${this.body()}${this.foot()}</div></sw-sheet>`;
    }
    return html`<div class=${`panel ${mode}`} data-cast-picker=${mode} role="dialog" aria-label=${t('cast.sheetRegion')}>${this.head(true)}${this.body()}${this.foot()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-cast-picker': SwCastPicker;
  }
}
