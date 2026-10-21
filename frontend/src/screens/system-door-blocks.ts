import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-state-panel';
import '../components/sw-chip';
import { describeError } from '../api/client';
import { fmtWhen } from '../api/access';
import { getDoorBlocks, setEntityBlock, type DoorBlockEntity, type DoorBlockItem, type DoorBlocks } from '../api/door-blocks';
import {
  cleanNote, entityBadge, entityMeta, filterEntities, filterLabel, itemBadge, itemDevicesLine, NOTE_MAX, noteProblem, noteProblemText, page, PAGE, releasedLine, STATUS_FILTERS, summaryLine,
  usedByLine, type StatusFilter,
} from '../access-control/door-blocks-logic';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bt } from '../i18n/door-blocks';

interface Pending {
  entity: DoorBlockEntity;
  /** true = release (a note is required), false = block again (a note is optional). */
  release: boolean;
}

/**
 * WXUNBLK (owner 2026-10-13): Settings › חיבורים › "חסימות פתיחת דלתות". The system administrator sees what the door path blocks - the
 * virtual (template) devices, and the saved items it refuses to run or enable because of them or because they open a door - and
 * releases ONE device by hand (a switch, then a short confirmation that asks WHY) or blocks it again. Every change is audited by the
 * server with who, when and why; a release applies to that device only, so an item that opens an intercom door stays refused and says
 * so. Search, a status filter and "show more" keep a long list usable. Names are shown; entity ids are only the keys of the switch.
 * `GET /doors/blocks`, `PUT /doors/blocks/entities/{entity_id}` (routers/doors.py), `system.configure`.
 */
@customElement('sw-door-blocks')
export class SwDoorBlocks extends LitElement {
  @state() private data: DoorBlocks | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private q = '';
  @state() private status: StatusFilter = 'all';
  @state() private shown = PAGE;
  @state() private pending: Pending | null = null;
  @state() private note = '';
  @state() private problem = '';
  @state() private saved = false;
  private gen = 0;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
        /* every button of the card is a 44 px target (the shared settings rows are not, in every skin) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      h3 {
        margin: var(--sw-s-4) 0 var(--sw-s-1);
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text-2);
      }
      .sum {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .tools {
        display: flex;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
        align-items: center;
        margin-block: var(--sw-s-2);
      }
      .tools input {
        flex: 1 1 220px;
        min-inline-size: 0;
        box-sizing: border-box;
        font: inherit;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text);
        background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-sm);
        padding: var(--sw-s-1) var(--sw-s-2);
        min-block-size: 44px;
      }
      .tools input:focus-visible {
        outline: 2px solid var(--sw-focus);
        outline-offset: 1px;
      }
      .chips {
        display: flex;
        gap: var(--sw-s-1);
        flex-wrap: wrap;
      }
      .item,
      .ent {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sw-s-3);
        flex-wrap: wrap;
        padding: var(--sw-s-2) 0;
        border-block-end: 1px solid var(--sw-border);
      }
      .item:last-of-type,
      .ent:last-of-type {
        border-block-end: 0;
      }
      .who {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1 1 260px;
        min-inline-size: 0;
      }
      /* a device's switch and badge stay on the row of its name on a phone (the card is ~366 px wide there) */
      .ent .who {
        flex-basis: 180px;
      }
      .name {
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text);
        overflow-wrap: anywhere;
      }
      .sub {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .warn {
        color: var(--sw-warning-text, var(--sw-text-2));
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .note {
        color: var(--sw-text-2);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .ctl {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
      }
      /* the switch is 42 x 24; its host is the 44 px target (a press on the host flips it too) */
      sw-toggle.t {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
      }
      .err {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
      }
      textarea {
        min-block-size: 88px;
        resize: vertical;
        line-height: 1.5;
      }
      .q {
        margin: 0 0 var(--sw-s-2);
        overflow-wrap: anywhere;
      }
      .more {
        margin-block-start: var(--sw-s-2);
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    this.busy = true;
    try {
      const data = await getDoorBlocks();
      if (gen !== this.gen) return;
      this.data = data;
      this.error = '';
    } catch (err) {
      if (gen !== this.gen) return;
      this.error = describeError(err);
    } finally {
      if (gen === this.gen) this.busy = false;
    }
  }

  private ask(entity: DoorBlockEntity, release: boolean): void {
    this.pending = { entity, release };
    this.note = '';
    this.problem = '';
    this.saved = false;
    this.requestUpdate(); // the switch snaps back to the server's state until the answer is in (`live`)
  }

  private cancel(): void {
    this.pending = null;
    this.problem = '';
    this.requestUpdate();
  }

  private async confirm(): Promise<void> {
    const p = this.pending;
    if (!p || this.busy) return;
    if (p.release) {
      const bad = noteProblem(this.note);
      if (bad) {
        this.problem = noteProblemText(bad);
        return;
      }
    }
    this.busy = true;
    this.problem = '';
    try {
      const reply = await setEntityBlock(p.entity.entity_id, p.release, cleanNote(this.note) || undefined);
      // the row shows what the server now holds even if the re-read below fails; the re-read brings the items and the counts
      if (this.data) this.data = { ...this.data, entities: this.data.entities.map((e) => (e.entity_id === reply.entity_id ? { ...e, state: reply.state, override: reply.override } : e)) };
      this.pending = null;
      this.note = '';
      this.saved = true;
      this.busy = false;
      await this.load();
    } catch (err) {
      this.problem = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private entityRow(e: DoorBlockEntity) {
    const badge = entityBadge(e);
    const used = usedByLine(e);
    const when = releasedLine(e, fmtWhen);
    return html`<div class="ent" data-door-block=${e.entity_id} data-door-block-state=${e.state}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${entityMeta(e)}</span>
        ${used ? html`<span class="sub" data-door-block-used>${used}</span>` : nothing}
        ${e.override ? html`<span class="sub" data-door-block-when>${when}</span><span class="note" data-door-block-why>${e.override.note}</span>` : nothing}
      </div>
      <div class="ctl">
        <sw-badge kind=${badge.kind} label=${badge.text}></sw-badge>
        ${e.state === 'door' || !e.overridable
          ? nothing
          : html`<sw-toggle class="t" label=${bt('toggle', { name: e.name })} labelHidden data-door-block-toggle .checked=${live(e.state === 'unblocked')} ?disabled=${this.busy}
              @change=${(ev: CustomEvent<{ checked: boolean }>) => this.ask(e, ev.detail.checked)}></sw-toggle>`}
      </div>
    </div>`;
  }

  private itemRow(i: DoorBlockItem) {
    const badge = itemBadge(i);
    const devices = itemDevicesLine(i);
    return html`<div class="item" data-door-block-item=${i.key} data-blocked=${String(i.blocked)} data-opens-door=${String(i.opens_door)}>
      <div class="who">
        <span class="name">${i.name}</span>
        <span class="sub">${i.kind_text}</span>
        ${i.opens_door ? html`<span class="warn" data-door-block-door>${i.guard}${i.why ? ` · ${i.why}` : ''}</span>` : nothing}
        ${devices ? html`<span class="sub" data-door-block-devices>${devices}</span>` : nothing}
        ${i.opens_door && devices ? html`<span class="sub">${bt('itemStays')}</span>` : nothing}
        ${!i.opens_door && !devices && i.reasons.length ? html`<span class="sub">${i.reasons.join(' · ')}</span>` : nothing}
      </div>
      <sw-badge kind=${badge.kind} label=${badge.text}></sw-badge>
    </div>`;
  }

  private dialog() {
    const p = this.pending;
    if (!p) return nothing;
    return html`<sw-dialog open heading=${p.release ? bt('releaseTitle') : bt('reblockTitle')} data-door-block-dialog @close=${() => this.cancel()}>
      <p class="q"><strong>${p.entity.name}</strong> · ${entityMeta(p.entity)}</p>
      <p class="q">${p.release ? bt('releaseText') : bt('reblockText')}</p>
      <sw-field label=${p.release ? bt('noteLabel') : bt('noteOptional')} hint=${p.release ? bt('noteHint', { max: NOTE_MAX }) : ''}>
        <textarea data-door-block-note-input rows="3" maxlength="600" aria-label=${p.release ? bt('noteLabel') : bt('noteOptional')} .value=${this.note}
          @input=${(e: Event) => { this.note = (e.target as HTMLTextAreaElement).value; this.problem = ''; }}></textarea>
      </sw-field>
      ${this.problem ? html`<div class="err" role="alert" data-door-block-problem>${this.problem}</div>` : nothing}
      <sw-button slot="footer" variant="ghost" data-door-block-cancel @click=${() => this.cancel()}>${bt('cancel')}</sw-button>
      <sw-button slot="footer" variant=${p.release ? 'primary' : 'danger'} data-door-block-ok ?disabled=${this.busy} @click=${() => void this.confirm()}>${p.release ? bt('release') : bt('reblock')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (this.error && !this.data) {
      return html`<sw-state-panel state="error" hint=${this.error} actionLabel=${bt('retry')} data-door-blocks-state="error" @action=${() => void this.load()}></sw-state-panel>`;
    }
    if (!this.data) return html`<sw-state-panel state="loading" data-door-blocks-state="loading"></sw-state-panel>`;
    const d = this.data;
    const matches = filterEntities(d.entities, this.q, this.status);
    const rows = page(matches, this.shown);
    return html`<sw-card heading=${bt('title')} subheading=${bt('sub')} data-door-blocks-card data-door-blocks-state="ready" style="margin-block-start: var(--sw-s-3)">
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      ${this.saved ? html`<div class="sub" role="status" data-door-blocks-saved>${bt('saved')}</div>` : nothing}
      <div class="sum" data-door-blocks-summary>${summaryLine(d)}${d.items.length ? ` · ${bt('summaryItems', { blocked: d.counts.items_blocked })}` : ''}</div>
      ${!d.wiskey_present && !d.entities.length
        ? html`<sw-state-panel icon="door" state="empty" heading=${bt('none')} data-door-blocks-none></sw-state-panel>`
        : html`<h3>${bt('entities')}</h3>
          <div class="tools">
            <input type="search" data-door-blocks-search placeholder=${bt('search')} aria-label=${bt('search')} .value=${this.q}
              @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; this.shown = PAGE; }} />
            <div class="chips" role="group" aria-label=${bt('entities')}>
              ${STATUS_FILTERS.map((f) => html`<sw-chip data-door-blocks-filter=${f} ?selected=${this.status === f} @click=${() => { this.status = f; this.shown = PAGE; }}>${filterLabel(f)}</sw-chip>`)}
            </div>
            <sw-button size="sm" variant="ghost" icon="refresh" data-door-blocks-refresh ?disabled=${this.busy} @click=${() => void this.load()}>${bt('refresh')}</sw-button>
          </div>
          ${rows.rows.length
            ? rows.rows.map((e) => this.entityRow(e))
            : html`<sw-state-panel icon="door" state="empty" heading=${d.entities.length ? bt('noMatch') : bt('noEntities')}></sw-state-panel>`}
          ${rows.left ? html`<sw-button class="more" size="sm" variant="ghost" data-door-blocks-more @click=${() => { this.shown += PAGE; }}>${bt('more', { n: rows.left })}</sw-button>` : nothing}
          ${d.truncated ? html`<div class="sub">${bt('truncated')}</div>` : nothing}
          <h3>${bt('items')}</h3>
          ${d.items.length ? d.items.map((i) => this.itemRow(i)) : html`<sw-state-panel icon="door" state="empty" heading=${bt('noItems')}></sw-state-panel>`}`}
    </sw-card>${this.dialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-door-blocks': SwDoorBlocks;
  }
}
