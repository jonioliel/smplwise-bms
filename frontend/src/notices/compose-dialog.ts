import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { archiveNotice, audiencePreview, createNotice, deleteNotice, patchNotice, publishNotice, type Board, type Severity } from '../api/notices';
import { nt } from '../i18n/notices';
import { SEV_KEY, audienceOf, inputOf, pushState, validate, type Draft } from './model';
import { noticesCss } from './styles';
import { dateInputLang } from '../api/day-format';

/** What a finished compose reports to its screen (`notice-saved`): the short confirmation to show; the screen reloads its list. */
export interface NoticeSavedDetail {
  message: string;
}

/**
 * CR-NOTICE106 / NOTICEADD-295: the compose dialog of a notice (title, text, severity, window, audience, TV boards, pinned, the TV
 * dwell), shared by ראשי › לוח הודעות and a board's "הודעות" tab in הגדרות › לוח הודעות. The screen opens it by setting `.draft`
 * (null = closed) and handles `notice-close` / `notice-saved`. A draft is deleted, a published notice is archived; both ask once inside the
 * dialog first. NOTICEDEL-295: with `canDelete` a published notice also offers "מחיקה" (event `notice-delete`, the screen's own confirmation).
 */
@customElement('notice-compose')
export class NoticeCompose extends LitElement {
  static styles = [noticesCss];

  @property({ attribute: false }) draft: Draft | null = null;
  @property({ attribute: false }) boards: Board[] = [];
  @property({ attribute: false }) floors: { id: string; name: string; building: string }[] = [];
  @property({ attribute: false }) groups: { id: string; name: string }[] = [];
  @property({ attribute: false }) roles: { id: string; name: string }[] = [];
  /** NOTICEPUSH-295: the writer holds notices.push (the checkbox can be changed) and the installation's "התראה בפרסום" default. */
  @property({ attribute: false }) canPush = false;
  /** NOTICEDEL-295: the writer holds notices.delete - a published notice then offers "מחיקה" (the screen asks once more in its own dialog). */
  @property({ attribute: false }) canDelete = false;
  @property({ attribute: false }) pushDefault: 'by_severity' | 'always' | 'never' = 'by_severity';
  @state() private d: Draft | null = null;
  @state() private err = '';
  @state() private audCount: number | null = null;
  @state() private audScope = true;
  @state() private busy = false;
  @state() private confirming = false;
  private audTimer = 0;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('draft')) {
      this.d = this.draft ? { ...this.draft } : null;
      this.err = '';
      this.confirming = false;
      this.audCount = null;
      this.audScope = true;
      if (this.d) this.refreshAudience();
    }
  }

  private close(): void {
    clearTimeout(this.audTimer);
    this.dispatchEvent(new CustomEvent('notice-close', { bubbles: true, composed: true }));
  }

  private done(message: string): void {
    this.dispatchEvent(new CustomEvent<NoticeSavedDetail>('notice-saved', { detail: { message }, bubbles: true, composed: true }));
  }

  private set(p: Partial<Draft>): void {
    if (!this.d) return;
    const next = { ...this.d, ...p };
    if (p.severity === 'critical') {
      next.pinned = true;
      next.untilArchived = false;
    }
    this.d = next;
    this.err = '';
    this.confirming = false;
    if ('aud' in p || 'floors' in p || 'groups' in p || 'roles' in p) this.refreshAudience();
  }

  private refreshAudience(): void {
    clearTimeout(this.audTimer);
    const d = this.d;
    if (!d) return;
    this.audTimer = window.setTimeout(async () => {
      try {
        const r = await audiencePreview(audienceOf(d));
        this.audCount = r.users;
        this.audScope = r.in_scope;
      } catch {
        this.audCount = null;
      }
    }, 250);
  }

  private toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  private async save(publish: boolean): Promise<void> {
    const d = this.d;
    if (!d) return;
    const bad = validate(d);
    if (bad) {
      this.err = nt(bad);
      return;
    }
    this.busy = true;
    try {
      const body = inputOf(d);
      // NOTICEPUSH-295: only a writer with notices.push sends the tick; a published notice never pushes again, so nothing is sent for it.
      // Publishing sends the value the checkbox shows (the default included); saving a draft remembers only what the author touched.
      const editable = d.status === 'new' || d.status === 'draft';
      const tick = !this.canPush || !editable ? undefined : publish ? pushState(d, this.pushDefault, true).checked : d.push ?? undefined;
      let sent = 0;
      if (!d.id) sent = (await createNotice({ ...body, publish, ...(tick === undefined ? {} : { push: tick }) })).push?.recipients ?? 0;
      else {
        await patchNotice(d.id, { ...body, ...(editable && this.canPush && d.push !== null ? { push: d.push } : {}) });
        if (publish && d.status === 'draft') sent = (await publishNotice(d.id, tick)).push?.recipients ?? 0;
      }
      this.done(publish ? (sent ? nt('pushDone', { n: sent }) : nt('published')) : d.status === 'published' ? nt('saved') : nt('savedDraft'));
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  /** The second click of "מחיקת הטיוטה" / "ארכוב": a draft is deleted, a published notice goes to the archive. */
  private async removeNotice(): Promise<void> {
    const d = this.d;
    if (!d?.id) {
      this.close();
      return;
    }
    if (!this.confirming) {
      this.confirming = true;
      return;
    }
    this.busy = true;
    try {
      if (d.status === 'draft') {
        await deleteNotice(d.id);
        this.done(nt('deleted'));
      } else {
        await archiveNotice(d.id);
        this.done(nt('archived'));
      }
    } catch (e) {
      this.err = describeError(e);
    } finally {
      this.busy = false;
      this.confirming = false;
    }
  }

  /** "שליחת התראה לנמענים בפרסום": once, in the channels each recipient chose. Not offered for a notice that is already published. */
  private pushRow(d: Draft) {
    if (d.status === 'published' || d.status === 'archived') return nothing;
    const p = pushState(d, this.pushDefault, this.canPush);
    return html`<div class="fld" data-push-row><span class="lbl">${nt('pushTick')}</span>
      <label class="ck"><input type="checkbox" data-push .checked=${p.checked} ?disabled=${p.disabled}
        @change=${(e: Event) => this.set({ push: (e.target as HTMLInputElement).checked })}>${nt('pushTick')}</label>
      <span class="hint">${d.aud === 'tv' ? nt('pushTv') : !this.canPush ? nt('pushNoPerm') : nt('pushHint')}</span></div>`;
  }

  render() {
    const d = this.d;
    if (!d) return html`<sw-dialog></sw-dialog>`;
    const sevs: Severity[] = ['info', 'alert', 'critical'];
    const auds: Draft['aud'][] = ['all', 'place', 'group', 'tv'];
    const editable = d.status === 'new' || d.status === 'draft';
    const removeKey = d.status === 'draft' ? 'deleteDraft' : 'archive';
    return html`<sw-dialog open wide data-compose-dialog heading=${d.id ? nt('editTitle') : nt('composeTitle')} subheading=${nt('composeSub')} @close=${() => this.close()}>
      <div class="two">
        <div class="form">
          <div class="fld"><label for="nt-title">${nt('fTitle')}</label><input id="nt-title" class="inp" maxlength="120" .value=${d.title} @input=${(e: Event) => this.set({ title: (e.target as HTMLInputElement).value })}></div>
          <div class="fld"><label for="nt-body">${nt('fBody')}</label><textarea id="nt-body" class="inp" maxlength="2000" .value=${d.body} @input=${(e: Event) => this.set({ body: (e.target as HTMLTextAreaElement).value })}></textarea></div>
          <div class="r">
            <div class="fld"><span class="lbl">${nt('fSeverity')}</span><div class="seg" role="group" data-sev>${sevs.map((s) => html`<button aria-pressed=${String(d.severity === s)} @click=${() => this.set({ severity: s })}>${nt(SEV_KEY[s])}</button>`)}</div></div>
            <div class="fld"><span class="lbl">&nbsp;</span><label class="ck"><input type="checkbox" .checked=${d.pinned} @change=${(e: Event) => this.set({ pinned: (e.target as HTMLInputElement).checked })}>${nt('fPinned')}</label></div>
          </div>
          <div class="r">
            <div class="fld"><label for="nt-from">${nt('fFrom')}</label><input id="nt-from" class="inp num" type="datetime-local" lang=${dateInputLang()} .value=${d.from} @input=${(e: Event) => this.set({ from: (e.target as HTMLInputElement).value })}></div>
            <div class="fld"><label for="nt-to">${nt('fTo')}</label><input id="nt-to" class="inp num" type="datetime-local" lang=${dateInputLang()} ?disabled=${d.untilArchived} .value=${d.to} @input=${(e: Event) => this.set({ to: (e.target as HTMLInputElement).value })}>
              ${d.severity === 'critical' ? html`<span class="hint">${nt('criticalNeedsEnd')}</span>`
                : html`<label class="ck"><input type="checkbox" .checked=${d.untilArchived} @change=${(e: Event) => this.set({ untilArchived: (e.target as HTMLInputElement).checked })}>${nt('fUntilArchived')}</label>`}</div>
          </div>
          <div class="r">
            <div class="fld"><label for="nt-dwell">${nt('fDwell')}</label><input id="nt-dwell" class="inp short num" type="number" min="3" max="600" .value=${d.dwell} @input=${(e: Event) => this.set({ dwell: (e.target as HTMLInputElement).value })}><span class="hint">${nt('fDwellHint')}</span></div>
            <div class="fld"><label for="nt-when">${nt('fWhen')}</label><input id="nt-when" class="inp" maxlength="60" .value=${d.when} placeholder=${nt('fWhenHint')} @input=${(e: Event) => this.set({ when: (e.target as HTMLInputElement).value })}></div>
          </div>
        </div>
        <div class="form">
          <div class="fld"><span class="lbl">${nt('fAudience')}</span>
            <div class="seg" role="group" data-aud>${auds.map((a) => html`<button aria-pressed=${String(d.aud === a)} data-a=${a} @click=${() => this.set({ aud: a })}>${nt(a === 'all' ? 'audAll' : a === 'place' ? 'audPlace' : a === 'group' ? 'audGroup' : 'audTv')}</button>`)}</div>
            ${d.aud === 'place' ? html`<div class="chips">${this.floors.map((f) => html`<button class="pick" aria-pressed=${String(d.floors.includes(f.id))} @click=${() => this.set({ floors: this.toggle(d.floors, f.id) })}>${f.building} · ${f.name}</button>`)}</div>` : nothing}
            ${d.aud === 'group' ? html`<div class="chips">${this.groups.map((g) => html`<button class="pick" aria-pressed=${String(d.groups.includes(g.id))} @click=${() => this.set({ groups: this.toggle(d.groups, g.id) })}>${g.name}</button>`)}
              ${this.roles.map((r) => html`<button class="pick" aria-pressed=${String(d.roles.includes(r.id))} @click=${() => this.set({ roles: this.toggle(d.roles, r.id) })}>${r.name}</button>`)}</div>` : nothing}
            ${d.aud !== 'tv' && this.audCount !== null ? html`<div class="sum"><sw-icon name="users" size="14"></sw-icon><b class="num">${this.audCount}</b>${nt('audUsers', { n: '' }).trim()}</div>` : nothing}
            ${!this.audScope ? html`<span class="err">${nt('audOutOfScope')}</span>` : nothing}
          </div>
          <div class="fld"><span class="lbl">${nt('fBoards')}</span>
            ${this.boards.length ? html`<div class="chips" data-boards>${this.boards.map((b) => html`<button class="pick" ?disabled=${!b.enabled} aria-pressed=${String(d.boards.includes(b.id))} data-board-pick=${b.id}
              @click=${() => this.set({ boards: this.toggle(d.boards, b.id) })}><sw-icon name="wall" size="12"></sw-icon>${b.enabled ? b.name : nt('boardOff', { name: b.name })}</button>`)}</div>`
              : html`<span class="hint">${nt('noBoards')}</span>`}
          </div>
          ${this.pushRow(d)}
        </div>
      </div>
      ${this.err ? html`<p class="err" role="alert" data-compose-error>${this.err}</p>` : nothing}
      ${d.status === 'new' ? html`<sw-button slot="footer" variant="ghost" @click=${() => this.close()}>${nt('cancel')}</sw-button>` : nothing}
      ${d.id && d.status !== 'archived' ? html`<sw-button slot="footer" variant=${this.confirming ? 'danger' : 'ghost'} ?disabled=${this.busy} data-remove-notice @click=${() => this.removeNotice()}>${this.confirming ? nt(d.status === 'draft' ? 'confirmDelete' : 'confirmArchive') : nt(removeKey)}</sw-button>` : nothing}
      ${d.id && d.status === 'published' && this.canDelete ? html`<sw-button slot="footer" variant="ghost" ?disabled=${this.busy} data-delete-notice @click=${() => this.dispatchEvent(new CustomEvent('notice-delete', { detail: { id: d.id }, bubbles: true, composed: true }))}>${nt('delete')}</sw-button>` : nothing}
      ${editable ? html`<sw-button slot="footer" ?disabled=${this.busy} data-save-draft @click=${() => this.save(false)}>${nt('saveDraft')}</sw-button>` : nothing}
      ${d.status !== 'archived' ? html`<sw-button slot="footer" variant="primary" ?disabled=${this.busy} data-publish @click=${() => this.save(editable)}>${d.status === 'published' ? nt('save') : nt('publish')}</sw-button>` : nothing}
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-compose': NoticeCompose;
  }
}
