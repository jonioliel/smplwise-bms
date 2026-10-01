import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/media-remote';
import '../components/media-player-card';
import '../components/media-group-dialog';
import type { MediaGroupDialog } from '../components/media-group-dialog';
import { describeError } from '../api/client';
import { getBulk, followBulk, bulkHeadline, OUTCOME_LABEL, type BulkRecord } from '../api/device-bulk';
import { canAnywhere, isApi } from '../api/session';
import { commandId } from '../api/request-id';
import { bulkCandidates, isOn, media, type BulkPreview, type MediaDevice } from '../api/media-screens';
import { PLAYER_KINDS, isPlaying, players, type PlayerDevice } from '../api/media-players';
import { bidi } from '../i18n/bidi';

/**
 * The area screen's media card (CR-015 §7.5, owner decision 12a): ONE compact `<media-screen-card>` per PHYSICAL screen of the
 * area (the S2 card: the small now-showing image, name and state, power, volume, mute and "שלט"), every "שלט" opening the same
 * `<media-remote>` as the screens page, and "כבה הכל" for the area's screens (decision 7a: a question + a count, the details
 * folded, only screens confirmed on, an honest per-screen outcome). Used by the built-in media card and by library (custom)
 * media cards of devices-area.ts; the card is drawn by the screen, this element fills it.
 *
 * CR-016: the area's approved speakers, players and receivers sit next to the TVs, one `<media-player-card>` (S2's card, used by tag)
 * per physical device; its `open-player` (or `open-remote`) opens the same drawer, drawn by the player panel. "כבה הכל" stays
 * screens-only: a speaker is never switched off by it (nothing in the contract adds players to the screens' bulk). The area's playing
 * players get their own "עצור מוזיקה" (a holder of media.bulk, only while something plays here): the server's `players_pause` preview, the
 * confirmation and the honest per-room result of `<media-group-dialog>`.
 *
 *   <media-area-card .areaId=${id} .areaName=${name} .entityIds=${customEntityIds|null} @media-area-state=${...}></media-area-card>
 *
 * Dedupe is the server's: several endpoints of one TV are ONE device, so one card. A custom card stores entity ids; when a
 * device carries `entity_ids` (the optional mapping a later contract adds) the card shows the devices that own any of them,
 * otherwise the screens of the area. Event `media-area-state` { screens, on, canOff } after every load tells the host whether the
 * card has screens at all (the host then drops the classic rows that these screens replace). Nothing renders without
 * `media.read` or when the feature is off.
 */
type Phase = 'closed' | 'loading' | 'ask' | 'sending' | 'done' | 'error';

const REASON: Record<string, string> = { already_off: 'כבוי כבר', not_confirmed: 'מצב לא מאושר', unavailable: 'לא זמין', not_allowed: 'אין הרשאה' };

@customElement('media-area-card')
export class MediaAreaCard extends LitElement {
  @property() areaId = '';
  @property() areaName = '';
  /** A custom card's stored entity ids (see above). */
  @property({ attribute: false }) entityIds: string[] | null = null;
  /** The host draws "כבה הכל" itself (the area screen puts it in the section header, like the other sections); it calls `ask()`. */
  @property({ type: Boolean }) external = false;
  @state() private devices: MediaDevice[] | null = null;
  /** CR-016: the area's approved speakers, players and receivers (null = not read yet). */
  @state() private speakers: PlayerDevice[] | null = null;
  /** The caller holds media.bulk somewhere (the server decides for this area again): "עצור מוזיקה" is offered. */
  @state() private canBulk = false;
  @query('media-group-dialog') private pauseDialog?: MediaGroupDialog;
  @state() private remoteKey = '';
  @state() private remoteKind = '';
  @state() private remoteOpen = false;
  @state() private phase: Phase = 'closed';
  @state() private preview: BulkPreview | null = null;
  @state() private record: BulkRecord | null = null;
  @state() private outcomes: { name: string; text: string }[] = [];
  @state() private error = '';
  private timer = 0;
  private token = 0;
  private stop = { stopped: false };

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar {
      display: flex;
      justify-content: flex-end;
      margin-block-end: 2px;
    }
    .sub {
      margin-block-start: 4px;
      padding-inline: 4px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--sw-text-2);
    }
    .off-all {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 14px;
      border-radius: 999px;
      border: 1px solid var(--dv-border, var(--sw-border-strong));
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--dv-danger, var(--sw-danger));
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .bar {
      gap: 8px;
      flex-wrap: wrap;
    }
    .off-all.quiet {
      color: var(--dv-text, var(--sw-text));
    }
    .off-all.quiet:hover {
      background: var(--dv-surface-3, var(--sw-surface-2, var(--sw-surface)));
    }
    .off-all:hover {
      background: var(--dv-danger-soft, var(--sw-danger-soft));
    }
    .off-all:focus-visible {
      outline: 2px solid var(--dv-focus, var(--sw-focus));
      outline-offset: 2px;
    }
    .q {
      margin: 0;
      font-size: 14px;
    }
    details {
      font-size: 13px;
      color: var(--sw-text-2);
    }
    summary {
      cursor: pointer;
      inline-size: max-content;
      min-block-size: 28px;
      display: inline-flex;
      align-items: center;
    }
    details ul {
      margin: 6px 0 0;
      padding-inline-start: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .res b {
      display: block;
      margin-block-end: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: 13px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && this.phase === 'closed') void this.load();
    }, 8000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    this.stop.stopped = true;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('areaId') && changed.get('areaId') !== undefined) void this.load();
  }

  /** The caller may see media at all: signed in with media.read somewhere, or the demo (no backend: the mock answers). */
  private allowed(): boolean {
    return !isApi() || canAnywhere('media.read');
  }

  private async load() {
    if (!this.areaId || !this.allowed()) return this.setDevices([], []);
    const token = ++this.token;
    try {
      const st = await media().status();
      if (!st.enabled) return token === this.token ? this.setDevices([], []) : undefined;
      const { devices } = await media().list({ area: this.areaId });
      // the players of the area (CR-016): a failure here never takes the screens away
      const area = this.areaId;
      const speakers = await players().list({ area }).then((r) => r.devices.filter((d) => d.area_id === area && ['speaker', 'player', 'receiver'].includes(d.kind) && PLAYER_KINDS.includes(d.kind))).catch(() => [] as PlayerDevice[]);
      const canBulk = speakers.length > 0 && (await players().status().then((s) => s.can.bulk).catch(() => false));
      if (token !== this.token) return;
      this.canBulk = canBulk;
      const screens = devices.filter((d) => d.kind === 'screen');
      const ids = this.entityIds;
      const mapped = ids?.length ? screens.filter((d) => ((d as MediaDevice & { entity_ids?: string[] }).entity_ids ?? []).some((e) => ids.includes(e))) : [];
      this.setDevices(ids?.length && mapped.length ? mapped : screens, speakers);
    } catch {
      if (token === this.token && !this.devices) this.setDevices([], []);
    }
  }

  private setDevices(list: MediaDevice[], speakers: PlayerDevice[]) {
    this.devices = list;
    this.speakers = speakers;
    this.dispatchEvent(new CustomEvent('media-area-state', {
      detail: { screens: list.length, players: speakers.length, playing: speakers.filter(isPlaying).length, on: list.filter((d) => isOn(d.live)).length, canOff: bulkCandidates(list).length > 0 },
      bubbles: true, composed: true,
    }));
  }

  private openRemote = (key: string, kind = '') => {
    this.remoteKey = key;
    this.remoteKind = kind || this.kindOf(key);
    this.remoteOpen = true;
  };

  /** A speaker, player or receiver of this card opens the player panel; every other key is a screen. */
  private kindOf(key: string): string {
    return this.speakers?.find((x) => x.key === key)?.kind ?? 'screen';
  }

  private onOpenRemote = (e: Event) => {
    const d = e as CustomEvent<{ key?: string }>;
    const key = d.detail?.key ?? ((e.target as HTMLElement & { device?: MediaDevice | PlayerDevice }).device?.key ?? '');
    if (key) this.openRemote(key);
  };

  // ------------------------------------------------------------------------------------------------ "כבה הכל"

  /** "כבה הכל": the preview, then the confirmation (the only way a bulk off starts). */
  async ask() {
    this.phase = 'loading';
    this.error = '';
    try {
      this.preview = await media().bulkPreview('area', this.areaId);
      this.phase = 'ask';
      void this.updateComplete.then(() => requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('[data-mac-cancel]')?.focus()));
    } catch (err) {
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private async run() {
    const p = this.preview;
    if (!p) return;
    this.phase = 'sending';
    this.stop = { stopped: false };
    try {
      const r = await media().bulkRun('area', this.areaId, commandId(), new Date(Date.now() + 15_000).toISOString());
      if (isApi()) {
        const rec = await followBulk(await getBulk(r.bulk_id), (x) => (this.record = x), this.stop);
        this.record = rec;
        this.outcomes = rec.items.map((i) => ({ name: i.name, text: OUTCOME_LABEL[i.outcome] }));
      } else {
        await this.load();
        const now = new Map((this.devices ?? []).map((d) => [d.key, d]));
        this.outcomes = p.devices.map((x) => ({ name: x.name, text: x.will === 'off' ? (now.get(x.key) && !isOn(now.get(x.key)!.live) ? 'אושר' : 'לא אושר') : `דולג · ${REASON[x.reason ?? ''] ?? ''}` }));
      }
      this.phase = 'done';
      void this.load();
    } catch (err) {
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private close = () => {
    if (this.phase === 'sending') return;
    this.phase = 'closed';
    this.preview = null;
    this.record = null;
    this.outcomes = [];
    this.error = '';
  };

  private dialog() {
    if (this.phase === 'closed' || this.phase === 'loading') return nothing;
    const p = this.preview;
    const n = p?.counts.send ?? 0;
    const where = this.areaName ? `ב${bidi(this.areaName)}` : 'באזור';
    if (this.phase === 'error') {
      return html`<sw-dialog open heading="הפעולה לא בוצעה" data-mac-dialog="error" @close=${this.close}><div class="err" role="alert">${this.error}</div>
        <sw-button slot="footer" @click=${this.close}>סגור</sw-button></sw-dialog>`;
    }
    if (this.phase === 'done' || this.phase === 'sending') {
      const head = this.record ? bulkHeadline(this.record).text : this.phase === 'sending' ? 'שולח…' : this.outcomes.every((o) => o.text === 'אושר' || o.text.startsWith('דולג')) ? 'בוצע' : 'בוצע חלקית';
      return html`<sw-dialog open ?locked=${this.phase === 'sending'} heading=${n === 1 ? `כיבוי מסך ${where}` : `כיבוי מסכים ${where}`} data-mac-dialog=${this.phase} @close=${this.close}>
        <div class="res"><b data-mac-headline>${head}</b><ul>${this.outcomes.map((o) => html`<li>${bidi(o.name)} · ${o.text}</li>`)}</ul></div>
        <sw-button slot="footer" variant="primary" ?disabled=${this.phase === 'sending'} @click=${this.close}>סגור</sw-button></sw-dialog>`;
    }
    if (!p || n === 0) {
      return html`<sw-dialog open heading=${`אין מסך דולק ${where}`} data-mac-dialog="none" @close=${this.close}>
        <details><summary>פרטים</summary><ul>${(p?.devices ?? []).map((x) => html`<li>${bidi(x.name)} · ${REASON[x.reason ?? ''] ?? ''}</li>`)}</ul></details>
        <sw-button slot="footer" @click=${this.close}>סגור</sw-button></sw-dialog>`;
    }
    return html`<sw-dialog open heading=${n === 1 ? `לכבות מסך אחד ${where}?` : `לכבות ${n} מסכים ${where}?`} data-mac-dialog="ask" @close=${this.close}>
      <details data-mac-details><summary>פרטים</summary><ul>${p.devices.map((x) => html`<li>${bidi(x.name)} · ${x.will === 'off' ? 'יכובה' : `לא יכובה · ${REASON[x.reason ?? ''] ?? ''}`}</li>`)}</ul></details>
      <sw-button slot="footer" data-mac-cancel @click=${this.close}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" icon="power" data-mac-confirm @click=${() => void this.run()}>כבה</sw-button></sw-dialog>`;
  }

  render() {
    const list = this.devices ?? [];
    const spk = this.speakers ?? [];
    if (!list.length && !spk.length) return nothing;
    const canOff = bulkCandidates(list).length > 0;
    const canPause = this.canBulk && spk.some(isPlaying);
    const pause = canPause
      ? html`<button type="button" class="off-all quiet" data-media-pause-all @click=${() => void this.pauseDialog?.pause({ scope: 'area', id: this.areaId, name: this.areaName || 'האזור' })}><sw-icon name="pause" size=${14}></sw-icon>עצור מוזיקה</button>`
      : nothing;
    const offAll = canOff && !this.external
      ? html`<button type="button" class="off-all" data-media-off-all ?disabled=${this.phase === 'loading'} @click=${() => void this.ask()}><sw-icon name="power" size=${14}></sw-icon>כבה הכל</button>`
      : nothing;
    return html`${pause !== nothing || offAll !== nothing ? html`<div class="bar" data-media-area-bar>${pause}${offAll}</div>` : nothing}
      <div class="list" data-media-area-list @open-remote=${this.onOpenRemote} @open-player=${this.onOpenRemote}>${repeat(list, (d) => d.key, (d) => html`<media-screen-card .device=${d} .compact=${true} size="s" data-media-tile=${d.key}></media-screen-card>`)}
        ${spk.length ? html`${list.length ? html`<div class="sub" data-media-area-sub="players">רמקולים ומגברים</div>` : nothing}${repeat(spk, (d) => d.key, (d) => html`<media-player-card .device=${d} .compact=${true} size="s" data-player-tile=${d.key}></media-player-card>`)}` : nothing}</div>
      ${this.dialog()}
      <media-group-dialog @group-done=${() => void this.load()}></media-group-dialog>
      <media-remote .deviceKey=${this.remoteKey} .kind=${this.remoteKind} .open=${this.remoteOpen} @close=${() => (this.remoteOpen = false)} @media-changed=${() => void this.load()} @media-remote-open=${() => (this.remoteOpen = true)}></media-remote>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-area-card': MediaAreaCard;
  }
}
