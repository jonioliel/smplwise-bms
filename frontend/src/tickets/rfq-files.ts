import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { bubbleChrome } from '../styles/bubble-chrome';
import { automationsStyles } from '../styles/automations-glass';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import type { RfqAttachmentLimits, RfqFileKind } from '../api/tickets-rfq';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { ACCEPT, DEFAULT_LIMITS, formatBytes, precheck } from './rfq-files-model';
import { ticketsLang } from './text';

/** One row of the list: a file picked in the form (`pending`, a local preview) or one the server stores (`href` = its address). */
export interface FileRow {
  key: string;
  name: string;
  kind: RfqFileKind;
  bytes: number;
  caption: string;
  visible: boolean;
  thumb: string;
  href: string;
  removed?: boolean;
  pending?: boolean;
}

const REFUSAL: Record<string, RfqTextKey> = { type: 'fErrType', size: 'fErrSize', count: 'fErrCount', total: 'fErrTotal' };

/**
 * RFQATT `<tickets-rfq-files .rows .limits ?editable ?busy>`: the files and pictures of a request for quotation, in the new-request
 * sheet and on the vendors board. Drag and drop or the picker (several at once), the phone's camera, one optional caption per file,
 * "visible to vendors" (default on) vs internal-only, remove; a picture shows its thumbnail. The picker's checks (allowed kinds, sizes,
 * count, total) say at once what will not go; the server checks again by content. Events (the parent talks to the server):
 * `files-picked {files: File[]}`, `file-caption {key, caption}`, `file-visible {key, visible}`, `file-remove {key}`.
 */
@customElement('tickets-rfq-files')
export class TicketsRfqFiles extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) rows: FileRow[] = [];
  @property({ attribute: false }) limits: RfqAttachmentLimits = DEFAULT_LIMITS;
  @property({ type: Boolean }) editable = false;
  @property({ type: Boolean }) busy = false;
  @state() private notes: string[] = [];
  @state() private over = false;

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles, css`
    :host {
      display: block;
    }
    .drop {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border: 1.5px dashed var(--sw-line, rgba(127, 127, 127, 0.4));
      border-radius: 14px;
    }
    .drop.over {
      border-color: var(--sw-accent, #2f6fed);
      background: color-mix(in srgb, var(--sw-accent, #2f6fed) 8%, transparent);
    }
    .drop small {
      flex-basis: 100%;
      color: var(--sw-muted, inherit);
    }
    ul {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    li {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--sw-line, rgba(127, 127, 127, 0.25));
    }
    li.removed {
      opacity: 0.6;
    }
    .th {
      inline-size: 56px;
      block-size: 56px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .th img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .meta {
      display: grid;
      gap: 4px;
      min-inline-size: 0;
    }
    .meta b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta small {
      color: var(--sw-muted, inherit);
    }
    .meta .inp {
      min-block-size: 36px;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    @media (max-width: 560px) {
      li {
        grid-template-columns: 48px minmax(0, 1fr);
      }
      .th {
        inline-size: 48px;
        block-size: 48px;
      }
      .acts {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }
  `];

  private emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private pick(list: FileList | null | undefined): void {
    const files = Array.from(list ?? []);
    if (!files.length || !this.editable || this.busy) return;
    const res = precheck(files, this.rows.map((r) => ({ bytes: r.kind === 'image' ? 0 : r.bytes, removed: r.removed })), this.limits);
    this.notes = res.refused.map((x) => rt(REFUSAL[x.reason], { name: x.name, n: this.limits.files }));
    if (res.accepted.length) this.emit('files-picked', { files: res.accepted });
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    this.over = false;
    this.pick(e.dataTransfer?.files);
  }

  private icon(kind: RfqFileKind): TemplateResult {
    return kind === 'image' ? tIcon('image') : rIcon(kind === 'xlsx' ? 'sheet' : 'file');
  }

  private row(r: FileRow): TemplateResult {
    const lang = ticketsLang() === 'en' ? 'en' : 'he';
    const can = this.editable && !r.removed;
    return html`<li class=${r.removed ? 'removed' : ''} data-rfq-file=${r.key} data-kind=${r.kind}>
      <span class="th">${r.thumb ? html`<img src=${r.thumb} alt="" loading="lazy" decoding="async" />` : this.icon(r.kind)}</span>
      <span class="meta">
        <b title=${r.name}>${bidi(r.name)}</b>
        <small>${formatBytes(r.bytes, lang)}${r.removed ? html` · ${rt('fRemoved')}` : nothing}${!r.visible && !r.removed ? html` · ${rt('fInternal')}` : nothing}</small>
        ${can ? html`<label><span class="vh">${rt('fCaption')}</span><input class="inp" maxlength=${this.limits.caption} placeholder=${rt('fCaption')} .value=${r.caption}
            ?disabled=${this.busy} data-rfq-file-caption @change=${(e: Event) => this.emit('file-caption', { key: r.key, caption: (e.target as HTMLInputElement).value.trim() })} /></label>`
          : r.caption ? html`<small data-rfq-file-caption-ro>${bidi(r.caption)}</small>` : nothing}
      </span>
      <span class="acts">
        ${can ? html`<label class="chk" data-rfq-file-visible><input type="checkbox" .checked=${r.visible} ?disabled=${this.busy}
            @change=${(e: Event) => this.emit('file-visible', { key: r.key, visible: (e.target as HTMLInputElement).checked })} />${rt('fVisible')}</label>` : nothing}
        ${r.href ? html`<a class="btn sm quiet" href=${r.href} target="_blank" rel="noopener noreferrer" ?download=${r.kind !== 'image'} data-rfq-file-open>
            ${r.kind === 'image' ? tIcon('eye') : rIcon('download')}<span>${r.kind === 'image' ? rt('fOpen') : rt('fDownload')}</span></a>` : nothing}
        ${can ? html`<button type="button" class="ibtn" ?disabled=${this.busy} aria-label=${rt('fRemove', { name: r.name })} data-rfq-file-remove
            @click=${() => this.emit('file-remove', { key: r.key })}>${tIcon('trash')}</button>` : nothing}
      </span>
    </li>`;
  }

  render() {
    const lang = ticketsLang() === 'en' ? 'en' : 'he';
    const l = this.limits;
    return html`
      ${this.editable ? html`<div class=${`drop${this.over ? ' over' : ''}`} data-rfq-drop
          @dragover=${(e: DragEvent) => { e.preventDefault(); this.over = true; }} @dragleave=${() => (this.over = false)} @drop=${(e: DragEvent) => this.onDrop(e)}>
        <span>${rt('fDrop')}</span>
        <label class="btn sm quiet">${rIcon('clip')}${rt('fPick')}<input class="vh" type="file" multiple accept=${ACCEPT} ?disabled=${this.busy} data-rfq-file-input
          @change=${(e: Event) => { const i = e.target as HTMLInputElement; this.pick(i.files); i.value = ''; }} /></label>
        <label class="btn sm quiet">${tIcon('camera')}${rt('fCamera')}<input class="vh" type="file" accept="image/*" capture="environment" ?disabled=${this.busy} data-rfq-camera-input
          @change=${(e: Event) => { const i = e.target as HTMLInputElement; this.pick(i.files); i.value = ''; }} /></label>
        <small>${rt('fTypes', { n: l.files, img: formatBytes(l.image_bytes, lang), doc: formatBytes(l.document_bytes, lang), total: formatBytes(l.total_bytes, lang) })}</small>
      </div>` : nothing}
      ${this.notes.length ? html`<div class="err" role="alert" data-rfq-file-refused>${this.notes.map((n) => html`<div>${bidi(n)}</div>`)}</div>` : nothing}
      ${this.rows.length ? html`<ul aria-label=${rt('secFiles')}>${repeat(this.rows, (r) => r.key, (r) => this.row(r))}</ul>`
        : this.editable ? nothing : html`<div class="note" data-rfq-files-none>${rt('fNone')}</div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-files': TicketsRfqFiles;
  }
}
