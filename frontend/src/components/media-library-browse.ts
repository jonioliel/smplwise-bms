import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { BROWSE_TYPES, BROWSE_TYPE_LABEL, SEARCH_DEBOUNCE_MS, SEARCH_MAX, errorCode, players, type BrowseType, type LibraryItem } from '../api/media-players';
import { bidi } from '../i18n/bidi';
import { tint } from './media-remote-keys';
import { remoteStyles } from './media-remote-css';
import { playerBase, playerStyles } from './media-player-css';
import { gl, ic } from './media-player-icons';

/** What the panel does with a tapped item: the ordinary `play_item` command (play now, after the current one, or at the end). */
export interface PlayItemEvent {
  item: LibraryItem;
  enqueue: 'play' | 'next' | 'add';
}

const LONG_PRESS_MS = 550;

/**
 * CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17.8): the "ספרייה" tab of the player panel - the whole library by type (שירים · אלבומים ·
 * אמנים · פלייליסטים · תחנות), "עוד" paging and, when the device offers it (`caps.search`), a search field (400 ms debounce). A tap plays now; a long press
 * plays next; the trailing "+" adds to the end of the queue (both only where the music layer queues). The component never sends anything itself: it fires
 * `play-item` and the panel runs the command (pending state, confirmation, errors) - one request per deliberate gesture.
 *
 *   <media-library-browse .deviceKey=${key} .canSearch=${d.caps.search} .canPlay=${d.can.control} .enqueueOk=${true} .pending=${set} @play-item=${...}>
 */
@customElement('media-library-browse')
export class MediaLibraryBrowse extends LitElement {
  @property({ attribute: false }) deviceKey = '';
  @property({ type: Boolean }) canSearch = false;
  @property({ type: Boolean }) canPlay = false;
  @property({ type: Boolean }) enqueueOk = false;
  /** The panel's pending ids (`item:<ref>`). */
  @property({ attribute: false }) pending: ReadonlySet<string> = new Set();
  /** The now-playing title (its tile is marked). */
  @property({ attribute: false }) current: string | null = null;

  @state() private type: BrowseType = 'track';
  @state() private q = '';
  @state() private items: LibraryItem[] | null = null;
  @state() private more = false;
  @state() private failed = false;
  @state() private loadingMore = false;

  private token = 0;
  private debounce = 0;
  private longTimer = 0;
  private longFired = false;

  static styles = [
    // the colour tokens (--mr-*) are inherited from the panel, which carries the scheme
    remoteStyles,
    playerBase,
    playerStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .srch {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-inline: 12px 6px;
        min-block-size: 42px;
        border-radius: 14px;
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
      }
      .srch:focus-within {
        border-color: var(--mr-accent);
      }
      .srch .ic {
        font-size: 17px;
        color: var(--mr-text-3);
        flex: none;
      }
      .srch input {
        all: unset;
        flex: 1;
        min-inline-size: 0;
        font: inherit;
        font-size: 14px;
        color: var(--mr-text);
      }
      .srch input::placeholder {
        color: var(--mr-text-3);
      }
      .srch .x {
        all: unset;
        cursor: pointer;
        display: grid;
        place-items: center;
        inline-size: 30px;
        block-size: 30px;
        border-radius: 9px;
        color: var(--mr-text-2);
      }
      .srch .x:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      .chips {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
        padding-block: 2px;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chip {
        all: unset;
        cursor: pointer;
        flex: none;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--mr-text-2);
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
      }
      .chip[aria-pressed='true'] {
        color: var(--mr-accent-text);
        background: var(--mr-accent-soft);
        border-color: var(--mr-accent);
      }
      .chip:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .tile {
        position: relative;
        display: flex;
        min-inline-size: 0;
      }
      .tile .libi {
        flex: 1;
        padding-inline-end: 40px;
      }
      .tile .add {
        all: unset;
        cursor: pointer;
        position: absolute;
        inset-inline-end: 4px;
        inset-block: 0;
        margin-block: auto;
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 10px;
        color: var(--mr-text-2);
      }
      .tile .add:hover {
        background: var(--mr-surface-3);
        color: var(--mr-text);
      }
      .tile .add:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      .tile .add .ic {
        font-size: 17px;
      }
      .tile .add[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .moreb {
        all: unset;
        cursor: pointer;
        align-self: center;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding-inline: 14px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--mr-text-2);
      }
      .moreb:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      @media (max-width: 480px) {
        .libg {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.debounce);
    window.clearTimeout(this.longTimer);
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('deviceKey') && this.deviceKey) void this.load(false);
  }

  private async load(append: boolean): Promise<void> {
    const token = ++this.token;
    const offset = append && this.items ? this.items.length : 0;
    if (append) this.loadingMore = true;
    else {
      this.items = null;
      this.failed = false;
    }
    try {
      const page = await players().browse(this.deviceKey, this.type, this.canSearch ? this.q : '', offset);
      if (token !== this.token) return;
      this.items = append && this.items ? [...this.items, ...page.items] : page.items;
      this.more = page.more;
    } catch (err) {
      if (token !== this.token) return;
      if (errorCode(err) === 'rate_limited' && this.items) return; // a 429 backs off quietly
      this.failed = true;
      if (!append) this.items = [];
    } finally {
      if (token === this.token) this.loadingMore = false;
    }
  }

  private pick(t: BrowseType) {
    if (t === this.type) return;
    this.type = t;
    void this.load(false);
  }

  private onInput(e: Event) {
    this.q = (e.target as HTMLInputElement).value.slice(0, SEARCH_MAX);
    window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => void this.load(false), SEARCH_DEBOUNCE_MS);
  }

  private clearQ() {
    this.q = '';
    window.clearTimeout(this.debounce);
    void this.load(false);
  }

  private fire(item: LibraryItem, enqueue: PlayItemEvent['enqueue']) {
    this.dispatchEvent(new CustomEvent<PlayItemEvent>('play-item', { detail: { item, enqueue }, bubbles: true, composed: true }));
  }

  private onDown(item: LibraryItem) {
    this.longFired = false;
    if (!this.enqueueOk) return;
    window.clearTimeout(this.longTimer);
    this.longTimer = window.setTimeout(() => {
      this.longFired = true;
      this.fire(item, 'next');
    }, LONG_PRESS_MS);
  }

  private onUp = () => window.clearTimeout(this.longTimer);

  private onTap(item: LibraryItem) {
    window.clearTimeout(this.longTimer);
    if (this.longFired) {
      this.longFired = false;
      return;
    }
    this.fire(item, 'play');
  }

  protected render(): TemplateResult {
    return html`
      ${this.canSearch
        ? html`<label class="srch" data-lb-search>${ic('search')}<input type="search" .value=${this.q} maxlength=${SEARCH_MAX} placeholder="חיפוש בספרייה" aria-label="חיפוש בספרייה" enterkeyhint="search"
              @input=${this.onInput} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { window.clearTimeout(this.debounce); void this.load(false); } }} />
            ${this.q ? html`<button type="button" class="x" aria-label="נקה חיפוש" data-lb-clear @click=${this.clearQ}>${ic('close')}</button>` : nothing}</label>`
        : nothing}
      <div class="chips" role="group" aria-label="סוג" data-lb-types>${BROWSE_TYPES.map((t) => html`<button type="button" class="chip" aria-pressed=${String(this.type === t)} data-lb-type=${t} @click=${() => this.pick(t)}>${BROWSE_TYPE_LABEL[t]}</button>`)}</div>
      ${this.body()}`;
  }

  private body(): TemplateResult {
    if (this.items === null) return html`<div class="libg" aria-busy="true" data-lb="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`;
    if (this.failed && !this.items.length) return html`<div class="libempty" data-lb="error">לא זמין</div>`;
    if (!this.items.length) return html`<div class="libempty" data-lb="empty">${this.q ? 'לא נמצאו פריטים' : 'אין פריטים'}</div>`;
    return html`<div class="libg" role="list" data-lb=${this.type}>${repeat(this.items, (i) => i.item_ref, (i) => this.tile(i))}</div>
      ${this.more ? html`<button type="button" class="moreb" data-lb-more ?disabled=${this.loadingMore} @click=${() => void this.load(true)}>${ic('chevronDown')}עוד</button>` : nothing}`;
  }

  private tile(i: LibraryItem): TemplateResult {
    const t = tint(i.hue);
    const pend = this.pending.has(`item:${i.item_ref}`);
    return html`<div class="tile" role="listitem">
      <button type="button" class=${classMap({ libi: true, pend })} data-lb-item=${i.item_ref} aria-current=${String(this.current !== null && i.name === this.current)} ?disabled=${!this.canPlay || pend}
        title=${this.enqueueOk ? 'נגן עכשיו · לחיצה ארוכה: אחרי הנוכחי' : 'נגן עכשיו'} @pointerdown=${() => this.onDown(i)} @pointerup=${this.onUp} @pointerleave=${this.onUp} @pointercancel=${this.onUp} @click=${() => this.onTap(i)}>
        <span class="gi" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}">${gl(i.kind === 'radio' ? 'radio' : i.glyph, 'ic')}</span>
        <span class="t"><b>${bidi(i.name)}</b>${i.artist ? html`<small>${bidi(i.artist)}</small>` : nothing}</span></button>
      ${this.enqueueOk && i.kind !== 'radio'
        ? html`<button type="button" class="add" title="הוסף לתור" aria-label="הוסף לתור" data-lb-add=${i.item_ref} ?disabled=${!this.canPlay || pend} @click=${() => this.fire(i, 'add')}>${ic('addQueue')}</button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-library-browse': MediaLibraryBrowse;
  }
}
