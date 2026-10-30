import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import {
  boardPhotoNightUrl, boardPhotoUrl, boardSlides, createSlide, deleteBoardPhoto, deleteBoardPhotoNight, deleteSlide, deleteSlideImage, patchSlide, putBoardPhoto, putBoardPhotoNight, putSlideImage, slideImageUrl,
  type Board, type Slide, type SlidesDoc,
} from '../api/notices';
import { nt } from '../i18n/notices';
import type { Display } from '../notice-tv/tv-logic';
import { noticesCss } from './styles';

/**
 * NOTICESLIDES-295: the promo / info slides of a board (a grid with עריכה and "שקופית חדשה", the count and the seconds) and, for the
 * "תמונה" template, the building photo upload. The `promo` switch is part of the board's display draft: it is sent up as `display-change`
 * (the page applies it to its draft and the live preview). Slides and the photo are stored on the server the moment they are saved
 * (they are not part of the draft), so after each change this emits `slides-changed` and the page refreshes the preview.
 * One slide may be shown on several boards (the dialog's board chips); a board holds at most `limit` slides.
 */
interface SlideDraft {
  id: string;
  title: string;
  text: string;
  seconds: string;
  boards: string[];
  hasImage: boolean;
  removeImage: boolean;
  file: File | null;
}

@customElement('notice-display-slides')
export class NoticeDisplaySlides extends LitElement {
  static styles = [
    noticesCss,
    css`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
      .slides { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; padding-inline-start: 22px; }
      .slide { display: grid; gap: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-surface); font-size: var(--sw-fs-sm); padding: 0; font: inherit; color: inherit; text-align: start; }
      .slide .im { aspect-ratio: 16 / 9; display: grid; place-items: center; color: var(--sw-text-3); background: var(--sw-surface-3); overflow: hidden; }
      .slide .im img { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
      .slide .im.add { border: 2px dashed var(--sw-border-strong); }
      .slide .cap { padding: 4px 8px 8px; display: flex; justify-content: space-between; gap: 6px; align-items: center; min-inline-size: 0; }
      .slide .cap b { color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      button.slide.add { cursor: pointer; }
      button.slide.add:disabled { opacity: 0.5; cursor: default; }
      .photo { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .photo .th { inline-size: 120px; aspect-ratio: 16 / 9; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-3); overflow: hidden; display: grid; place-items: center; color: var(--sw-text-3); }
      .photo .th img { inline-size: 100%; block-size: 100%; object-fit: cover; }
      input[type='file'] { display: none; }
      .file { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
      .file .nm { color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 28ch; }
    `,
  ];

  @property({ attribute: false }) display!: Display;
  @property({ attribute: false }) boardId = '';
  /** LOBBY-STYLES-2300: the board's effective design is a luxury style (it shows the building photo, day and night) */
  @property({ type: Boolean }) lux = false;
  @property({ attribute: false }) boards: Board[] = [];

  @state() private doc: SlidesDoc | null = null;
  @state() private dlg: SlideDraft | null = null;
  @state() private err = '';
  @state() private busy = false;
  @state() private confirming = false;
  private loadedFor = '';

  protected updated(): void {
    if (this.boardId && this.boardId !== this.loadedFor) {
      this.loadedFor = this.boardId;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      this.doc = await boardSlides(this.boardId);
    } catch (e) {
      this.err = describeError(e);
    }
  }

  private changed(): void {
    this.dispatchEvent(new CustomEvent('slides-changed', { bubbles: true, composed: true }));
  }

  private openNew(): void {
    this.err = '';
    this.confirming = false;
    this.dlg = { id: '', title: '', text: '', seconds: '', boards: [this.boardId], hasImage: false, removeImage: false, file: null };
  }

  private openEdit(s: Slide): void {
    this.err = '';
    this.confirming = false;
    this.dlg = { id: s.id, title: s.title, text: s.text, seconds: s.seconds ? String(s.seconds) : '', boards: [...s.boards], hasImage: s.has_image, removeImage: false, file: null };
  }

  private set(p: Partial<SlideDraft>): void {
    if (this.dlg) this.dlg = { ...this.dlg, ...p };
  }

  private async save(): Promise<void> {
    const d = this.dlg;
    if (!d) return;
    if (!d.title.trim()) return;
    const secs = d.seconds.trim() === '' ? null : Number(d.seconds);
    this.busy = true;
    this.err = '';
    try {
      const body = { title: d.title.trim(), text: d.text.trim(), seconds: secs, board_ids: d.boards };
      let id = d.id;
      if (id) await patchSlide(id, body);
      else id = (await createSlide(body)).id;
      if (d.file) await putSlideImage(id, d.file);
      else if (d.removeImage && d.hasImage) await deleteSlideImage(id);
      this.dlg = null;
      await this.load();
      this.changed();
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeSlide(): Promise<void> {
    const d = this.dlg;
    if (!d?.id) return;
    if (!this.confirming) {
      this.confirming = true;
      return;
    }
    this.busy = true;
    try {
      await deleteSlide(d.id);
      this.dlg = null;
      await this.load();
      this.changed();
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
      this.confirming = false;
    }
  }

  private async photo(file: File | null, night = false): Promise<void> {
    this.busy = true;
    this.err = '';
    try {
      const doc = night
        ? (file ? await putBoardPhotoNight(this.boardId, file) : await deleteBoardPhotoNight(this.boardId))
        : (file ? await putBoardPhoto(this.boardId, file) : await deleteBoardPhoto(this.boardId));
      this.doc = { ...(this.doc ?? doc), photo: doc.photo, photo_night: doc.photo_night };
      this.changed();
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private pickBoard(id: string): void {
    const d = this.dlg;
    if (!d) return;
    this.set({ boards: d.boards.includes(id) ? d.boards.filter((b) => b !== id) : [...d.boards, id] });
  }

  private dialog() {
    const d = this.dlg;
    if (!d) return html`<sw-dialog></sw-dialog>`;
    const min = this.doc?.seconds.min ?? 6;
    const max = this.doc?.seconds.max ?? 120;
    const picture = d.file ? d.file.name : d.hasImage && !d.removeImage ? nt('slidePicture') : nt('slideNoPicture');
    return html`<sw-dialog open data-slide-dialog heading=${d.id ? nt('slideEditTitle') : nt('slideNew')} @close=${() => (this.dlg = null)}>
      <div class="form">
        <div class="fld"><label for="sl-title">${nt('slideTitle')}</label><input id="sl-title" class="inp" maxlength="80" .value=${d.title} @input=${(e: Event) => this.set({ title: (e.target as HTMLInputElement).value })}></div>
        <div class="fld"><label for="sl-text">${nt('slideText')}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${d.text} @input=${(e: Event) => this.set({ text: (e.target as HTMLTextAreaElement).value })}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${nt('slideSeconds')}</label><input id="sl-sec" class="inp short num" type="number" min=${min} max=${max} .value=${d.seconds} @input=${(e: Event) => this.set({ seconds: (e.target as HTMLInputElement).value })}></div>
          <div class="fld"><span class="lbl">${nt('slidePicture')}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${() => (this.renderRoot.querySelector('[data-slide-file]') as HTMLInputElement).click()}>${nt('slidePick')}</sw-button>
              <span class="nm">${picture}</span>
              ${d.file || (d.hasImage && !d.removeImage) ? html`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${() => this.set({ file: null, removeImage: true })}>${nt('slideRemovePicture')}</sw-button>` : nothing}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${(e: Event) => this.set({ file: (e.target as HTMLInputElement).files?.[0] ?? null, removeImage: false })}></div></div>
        </div>
        ${this.boards.length > 1 ? html`<div class="fld"><span class="lbl">${nt('slideBoards')}</span>
          <div class="chips" data-slide-boards>${this.boards.map((b) => html`<button class="pick" aria-pressed=${String(d.boards.includes(b.id))} data-slide-board=${b.id} @click=${() => this.pickBoard(b.id)}>${b.name}</button>`)}</div></div>` : nothing}
      </div>
      ${this.err ? html`<p class="err" role="alert" data-slide-error>${this.err}</p>` : nothing}
      ${d.id ? html`<sw-button slot="footer" variant=${this.confirming ? 'danger' : 'ghost'} ?disabled=${this.busy} data-slide-delete @click=${() => this.removeSlide()}>${this.confirming ? nt('slideDeleteConfirm') : nt('slideDelete')}</sw-button>` : html`<sw-button slot="footer" variant="ghost" @click=${() => (this.dlg = null)}>${nt('cancel')}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy || !d.title.trim()} data-slide-save @click=${() => this.save()}>${nt('save')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (!this.display) return html``;
    const slides = this.doc?.slides ?? [];
    const limit = this.doc?.limit ?? 10;
    const rotate = this.display.rotate_s || 12;
    const total = slides.reduce((n, s) => n + (s.seconds || rotate), 0);
    const photo = this.doc?.photo;
    const photoNight = this.doc?.photo_night;
    return html`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${(e: Event) => this.emitPromo((e.target as HTMLInputElement).checked)}>${nt('slidesBlock')}</label>
          <span class="st num" data-slides-count>${nt('slidesCount', { n: slides.length, s: total })}</span></div>
        <div class="slides" data-slide-grid>${slides.map((s) => html`<div class="slide" data-slide=${s.id}><div class="im">${s.has_image ? html`<img alt="" src=${slideImageUrl(s)}>` : html`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${s.title}</b><sw-button size="sm" data-slide-edit @click=${() => this.openEdit(s)}>${nt('edit')}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${slides.length >= limit} title=${nt('slideLimit', { n: limit })} @click=${() => this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${nt('slideNew')}</b></div></button></div>
      </div>
      ${this.display.template === 2 || this.lux ? html`<div class="blk" data-photo-block><span class="ck"><b>${nt('photoBlock')}</b></span>
        <div class="photo"><div class="th">${photo?.has ? html`<img alt="" data-photo-img src=${boardPhotoUrl(this.boardId, photo.stamp)}>` : html`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${() => (this.renderRoot.querySelector('[data-photo-file]') as HTMLInputElement).click()}>${photo?.has ? nt('photoReplace') : nt('photoUpload')}</sw-button>
          ${photo?.has ? html`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${() => this.photo(null)}>${nt('photoRemove')}</sw-button>` : nothing}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            const f = el.files?.[0];
            el.value = '';
            if (f) void this.photo(f);
          }}></div>
        ${!this.dlg && this.err ? html`<p class="err" role="alert" data-photo-error>${this.err}</p>` : nothing}</div>` : nothing}
      ${this.lux ? html`<div class="blk" data-photo-night-block><span class="ck"><b>${nt('photoNightBlock')}</b></span><span class="hint">${nt('photoNightHint')}</span>
        <div class="photo"><div class="th">${photoNight?.has ? html`<img alt="" data-photo-night-img src=${boardPhotoNightUrl(this.boardId, photoNight.stamp)}>` : html`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${() => (this.renderRoot.querySelector('[data-photo-night-file]') as HTMLInputElement).click()}>${photoNight?.has ? nt('photoReplace') : nt('photoUpload')}</sw-button>
          ${photoNight?.has ? html`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${() => this.photo(null, true)}>${nt('photoRemove')}</sw-button>` : nothing}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            const f = el.files?.[0];
            el.value = '';
            if (f) void this.photo(f, true);
          }}></div></div>` : nothing}
      ${this.dialog()}`;
  }

  private emitPromo(on: boolean): void {
    this.dispatchEvent(new CustomEvent('display-change', { detail: { blocks: { ...this.display.blocks, promo: on } }, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-display-slides': NoticeDisplaySlides;
  }
}
