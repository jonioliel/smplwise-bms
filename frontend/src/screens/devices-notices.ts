import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import {
  archiveNotice, audienceOptions, audiencePreview, createNotice, deleteNotice, listBoards, listNotices, markRead, patchNotice, publishNotice,
  type Board, type Notice, type NoticesList, type Severity,
} from '../api/notices';
import { nt } from '../i18n/notices';
import { SEV_KEY, SEV_LOOK, STATE_KEY, audienceOf, audienceText, draftOf, inputOf, kpiCounts, matches, newDraft, validate, windowText, type Draft, type Kpi, type Seg } from '../notices/model';
import { noticesCss } from '../notices/styles';
import { NOTICES_SETTINGS_HREF } from '../shell/nav';

/**
 * CR-NOTICE106 section 9: ראשי › לוח הודעות (#/devices/notices). Readers see the active notices of their audience (a read sheet marks
 * one read); notice managers see every state with the KPI filters (פעילות / מתוזמנות / דחופות / פגו / טיוטות) and open the compose
 * dialog (title, text, severity, window, audience, TV boards, pinned, the TV dwell). The server decides everything (module 404,
 * permissions 403, audience scope 403 `audience_out_of_scope`); the screen only offers what the answers allow.
 */
@customElement('devices-notices')
export class DevicesNotices extends LitElement {
  static styles = [noticesCss];

  @state() private data: NoticesList | null = null;
  @state() private manager = false;
  @state() private error = '';
  @state() private off = false;
  @state() private forbidden = false;
  @state() private kpi: Kpi = 'all';
  @state() private seg: Seg = 'all';
  @state() private q = '';
  @state() private boards: Board[] = [];
  @state() private floors: { id: string; name: string; building: string }[] = [];
  @state() private groups: { id: string; name: string }[] = [];
  @state() private roles: { id: string; name: string }[] = [];
  @state() private draft: Draft | null = null;
  @state() private draftErr = '';
  @state() private audCount: number | null = null;
  @state() private audScope = true;
  @state() private busy = false;
  @state() private reading: Notice | null = null;
  @state() private toast = '';
  private toastTimer = 0;
  private audTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      let d: NoticesList;
      try {
        d = await listNotices('all');
        this.manager = true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          d = await listNotices('mine');
          this.manager = false;
        } else throw e;
      }
      this.data = d;
      this.off = false;
      this.forbidden = false;
      if (this.manager && !this.boards.length) void this.loadOptions();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.off = true;
      else if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private async loadOptions(): Promise<void> {
    try {
      const [b, o] = await Promise.all([listBoards(), audienceOptions()]);
      this.boards = b.boards;
      this.floors = o.floors;
      this.groups = o.groups;
      this.roles = o.roles;
    } catch {
      /* the compose dialog then offers "everyone" and no boards */
    }
  }

  private say(msg: string): void {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 2600);
  }

  // ---------------------------------------------------------------- render

  render() {
    if (this.off) {
      return html`<sw-page heading=${nt('title')}><sw-state-panel data-notices-state="off" state="empty" icon="offline" heading=${nt('off')} hint=${nt('offHint')}
        actionLabel=${nt('toSettings')} @action=${() => (location.hash = NOTICES_SETTINGS_HREF)}></sw-state-panel></sw-page>`;
    }
    if (this.forbidden) return html`<sw-page heading=${nt('title')}><sw-state-panel state="forbidden" heading=${nt('forbidden')}></sw-state-panel></sw-page>`;
    if (this.error) {
      return html`<sw-page heading=${nt('title')}><sw-state-panel state="error" heading=${nt('loadError')} hint=${this.error} actionLabel=${nt('retry')} @action=${() => this.load()}></sw-state-panel></sw-page>`;
    }
    if (!this.data) return html`<sw-page heading=${nt('title')}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const all = this.data.notices;
    const counts = kpiCounts(all);
    const rows = all.filter((n) => matches(n, this.kpi, this.seg, this.q, this.manager));
    const sub = this.manager ? nt('subtitleMgr', { n: counts.all, s: counts.scheduled, d: counts.drafts }) : nt('subtitle', { n: counts.all });
    return html`
      <sw-page heading="" data-notices-page>
        <div class="top"><div><h1>${nt('title')}</h1><p class="sub">${sub}</p></div><span class="sp"></span>
          <div class="meta">${this.manager ? html`<sw-button variant="primary" icon="plus" data-compose @click=${() => this.compose()}>${nt('newNotice')}</sw-button>` : nothing}</div></div>
        ${!all.length
          ? html`<sw-state-panel state="empty" icon="inbox" heading=${nt('emptyTitle')} hint=${this.manager ? nt('emptyManager') : nt('emptyReader')}
              actionLabel=${this.manager ? nt('firstNotice') : ''} @action=${() => this.compose()}></sw-state-panel>`
          : html`
            ${this.kpis(counts)}
            <div class="panel flush">
              <div class="toolbar">
                ${this.manager ? html`<div class="seg" role="group" aria-label=${nt('colBoards')}>${(['all', 'mine', 'tv'] as Seg[]).map((s) => html`<button aria-pressed=${String(this.seg === s)} @click=${() => (this.seg = s)}>${nt(s === 'all' ? 'segAll' : s === 'mine' ? 'segMine' : 'segTv')}</button>`)}</div>` : nothing}
                <span class="sp"></span>
                <label class="search"><sw-icon name="search" size="14"></sw-icon><input type="search" placeholder=${nt('search')} aria-label=${nt('search')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)}></label>
              </div>
              <div class="scrollx">${this.table(rows)}</div>
              <div class="cards">${rows.map((n) => this.card(n))}</div>
            </div>`}
      </sw-page>
      ${this.composeDialog()} ${this.readDialog()}
      ${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : nothing}`;
  }

  private kpis(c: Record<Kpi, number>) {
    const tiles: { k: Kpi; look: string; label: string }[] = this.manager
      ? [{ k: 'all', look: 'acc', label: nt('kpiActive') }, { k: 'urgent', look: 'alarm', label: nt('kpiUrgent') }, { k: 'scheduled', look: 'acc', label: nt('kpiScheduled') },
        { k: 'expired', look: 'off', label: nt('kpiExpired') }, { k: 'drafts', look: 'unk', label: nt('kpiDrafts') }]
      : [{ k: 'all', look: 'acc', label: nt('kpiActive') }, { k: 'urgent', look: 'alarm', label: nt('kpiUrgent') }, { k: 'unread', look: 'acc', label: nt('kpiUnread') }];
    return html`<div class="kpis" role="group" data-kpis>${tiles.map((t) => html`<button class="kpi" data-k=${t.k} data-look=${t.look} aria-pressed=${String(this.kpi === t.k)}
      @click=${() => (this.kpi = this.kpi === t.k && t.k !== 'all' ? 'all' : t.k)}><span class="dot" aria-hidden="true"></span><div><b class="num">${c[t.k]}</b><span class="l">${t.label}</span></div></button>`)}</div>`;
  }

  private boardNames(n: Notice): string[] {
    return n.boards.map((id) => this.boards.find((b) => b.id === id)?.name ?? '').filter(Boolean);
  }

  private look(n: Notice): string {
    if (n.state === 'draft') return 'unk';
    if (n.state === 'expired' || n.state === 'archived') return 'off';
    return SEV_LOOK[n.severity];
  }

  private badge(n: Notice) {
    const label = n.state === 'active' ? (n.severity === 'info' ? nt('stActive') : nt(SEV_KEY[n.severity])) : nt(STATE_KEY[n.state]);
    return html`<span class="badge" data-look=${this.look(n)}>${n.severity === 'critical' && n.state === 'active' ? html`<sw-icon name="warning" size="12"></sw-icon>` : nothing}${label}</span>`;
  }

  private table(rows: Notice[]) {
    const floors = Object.fromEntries(this.floors.map((f) => [f.id, f.name]));
    return html`<table class="t"><thead><tr><th>${nt('colState')}</th><th>${nt('colNotice')}</th>${this.manager ? html`<th>${nt('colAudience')}</th><th>${nt('colBoards')}</th>` : nothing}
      <th>${nt('colWindow')}</th>${this.manager ? html`<th>${nt('colReads')}</th><th></th>` : nothing}</tr></thead><tbody>
      ${rows.map((n) => html`<tr class="go" tabindex="0" data-notice=${n.id} data-look=${this.look(n)} @click=${() => this.open(n)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.open(n)}>
        <td>${this.badge(n)}</td>
        <td><span class="t1">${n.title}${n.read === false && n.state === 'active' && !this.manager ? html`<span class="new" aria-label="new"></span>` : nothing}</span><span class="t2">${n.body.split('\n')[0]}</span></td>
        ${this.manager ? html`<td><span class="chips">${audienceText(n.audience, floors).map((a) => html`<span class="chip">${a}</span>`)}</span></td>
          <td>${this.boardNames(n).length ? html`<span class="chips">${this.boardNames(n).map((b) => html`<span class="chip">${b}</span>`)}</span>` : html`<span class="mut">-</span>`}</td>` : nothing}
        <td class="num mut">${windowText(n)}</td>
        ${this.manager ? html`<td class="num mut">${n.state === 'draft' ? '-' : n.reads ?? 0}</td><td class="act" @click=${(e: Event) => e.stopPropagation()}>${this.actions(n)}</td>` : nothing}
      </tr>`)}
      </tbody></table>`;
  }

  private card(n: Notice) {
    return html`<div class="card" data-look=${this.look(n)} @click=${() => this.open(n)}>
      <div class="row">${this.badge(n)}<span class="mut num">${windowText(n)}</span></div>
      <span class="t1">${n.title}</span><span class="t2">${n.body.split('\n')[0]}</span>
      ${this.manager ? html`<div class="row" @click=${(e: Event) => e.stopPropagation()}>${this.actions(n)}</div>` : nothing}</div>`;
  }

  private actions(n: Notice) {
    if (n.state === 'archived') return nothing;
    return html`${n.state !== 'expired' ? html`<sw-button size="sm" variant=${n.state === 'draft' ? 'primary' : 'secondary'} @click=${() => this.open(n)}>${nt(n.state === 'draft' ? 'continueEdit' : 'edit')}</sw-button>` : nothing}
      ${n.state !== 'draft' ? html`<sw-button size="sm" data-archive @click=${() => this.archive(n)}>${nt('archive')}</sw-button>` : nothing}`;
  }

  private open(n: Notice): void {
    if (this.manager) {
      this.compose(n);
      return;
    }
    this.reading = n;
    if (n.read === false) {
      void markRead(n.id).then(() => {
        if (this.data) this.data = { ...this.data, notices: this.data.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)) };
      }).catch(() => undefined);
    }
  }

  private async archive(n: Notice): Promise<void> {
    try {
      await archiveNotice(n.id);
      this.say(nt('archived'));
      await this.load();
    } catch (e) {
      this.say(describeError(e));
    }
  }

  // ---------------------------------------------------------------- the read sheet

  private readDialog() {
    const n = this.reading;
    return html`<sw-dialog ?open=${!!n} heading=${n?.title ?? ''} subheading=${n ? windowText(n) : ''} @close=${() => (this.reading = null)}>
      ${n ? html`<p>${n.body.split('\n').map((l) => html`${l}<br>`)}</p>` : nothing}
      <sw-button slot="footer" variant="primary" @click=${() => (this.reading = null)}>${nt('close')}</sw-button></sw-dialog>`;
  }

  // ---------------------------------------------------------------- the compose dialog

  private compose(n?: Notice): void {
    const defaults = this.data?.defaults ?? { default_days: 7, default_severity: 'info' as const };
    this.draft = n ? draftOf(n) : newDraft(new Date(), defaults.default_days, defaults.default_severity);
    this.draftErr = '';
    this.audCount = null;
    this.refreshAudience();
  }

  private set(p: Partial<Draft>): void {
    if (!this.draft) return;
    const next = { ...this.draft, ...p };
    if (p.severity === 'critical') {
      next.pinned = true;
      next.untilArchived = false;
    }
    this.draft = next;
    this.draftErr = '';
    if ('aud' in p || 'floors' in p || 'groups' in p || 'roles' in p) this.refreshAudience();
  }

  private refreshAudience(): void {
    clearTimeout(this.audTimer);
    const d = this.draft;
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
    const d = this.draft;
    if (!d) return;
    const bad = validate(d);
    if (bad) {
      this.draftErr = nt(bad);
      return;
    }
    this.busy = true;
    try {
      const body = inputOf(d);
      let id = d.id;
      if (!id) {
        id = (await createNotice({ ...body, publish })).notice.id;
      } else {
        await patchNotice(id, body);
        if (publish && d.status === 'draft') await publishNotice(id);
      }
      this.draft = null;
      this.say(publish ? nt('published') : d.status === 'published' ? nt('saved') : nt('savedDraft'));
      await this.load();
    } catch (e) {
      this.draftErr = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeDraft(): Promise<void> {
    const d = this.draft;
    if (!d?.id) {
      this.draft = null;
      return;
    }
    try {
      await deleteNotice(d.id);
      this.draft = null;
      this.say(nt('deleted'));
      await this.load();
    } catch (e) {
      this.draftErr = describeError(e);
    }
  }

  private composeDialog() {
    const d = this.draft;
    if (!d) return html`<sw-dialog></sw-dialog>`;
    const sevs: Severity[] = ['info', 'alert', 'critical'];
    const auds: Draft['aud'][] = ['all', 'place', 'group', 'tv'];
    return html`<sw-dialog open wide data-compose-dialog heading=${d.id ? nt('editTitle') : nt('composeTitle')} subheading=${nt('composeSub')} @close=${() => (this.draft = null)}>
      <div class="two">
        <div class="form">
          <div class="fld"><label for="nt-title">${nt('fTitle')}</label><input id="nt-title" class="inp" maxlength="120" .value=${d.title} @input=${(e: Event) => this.set({ title: (e.target as HTMLInputElement).value })}></div>
          <div class="fld"><label for="nt-body">${nt('fBody')}</label><textarea id="nt-body" class="inp" maxlength="2000" .value=${d.body} @input=${(e: Event) => this.set({ body: (e.target as HTMLTextAreaElement).value })}></textarea></div>
          <div class="r">
            <div class="fld"><span class="lbl">${nt('fSeverity')}</span><div class="seg" role="group" data-sev>${sevs.map((s) => html`<button aria-pressed=${String(d.severity === s)} @click=${() => this.set({ severity: s })}>${nt(SEV_KEY[s])}</button>`)}</div></div>
            <div class="fld"><span class="lbl">&nbsp;</span><label class="ck"><input type="checkbox" .checked=${d.pinned} @change=${(e: Event) => this.set({ pinned: (e.target as HTMLInputElement).checked })}>${nt('fPinned')}</label></div>
          </div>
          <div class="r">
            <div class="fld"><label for="nt-from">${nt('fFrom')}</label><input id="nt-from" class="inp num" type="datetime-local" .value=${d.from} @input=${(e: Event) => this.set({ from: (e.target as HTMLInputElement).value })}></div>
            <div class="fld"><label for="nt-to">${nt('fTo')}</label><input id="nt-to" class="inp num" type="datetime-local" ?disabled=${d.untilArchived} .value=${d.to} @input=${(e: Event) => this.set({ to: (e.target as HTMLInputElement).value })}>
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
            ${this.boards.length ? html`<div class="chips" data-boards>${this.boards.map((b) => html`<button class="pick" ?disabled=${!b.enabled} aria-pressed=${String(d.boards.includes(b.id))}
              @click=${() => this.set({ boards: this.toggle(d.boards, b.id) })}><sw-icon name="wall" size="12"></sw-icon>${b.enabled ? b.name : nt('boardOff', { name: b.name })}</button>`)}</div>`
              : html`<span class="hint">${nt('noBoards')}</span>`}
          </div>
          <p class="hint">${nt('pushLater')}</p>
        </div>
      </div>
      ${this.draftErr ? html`<p class="err" role="alert" data-compose-error>${this.draftErr}</p>` : nothing}
      ${d.status === 'new' || d.status === 'draft' ? html`<sw-button slot="footer" variant="ghost" @click=${() => this.removeDraft()}>${nt(d.id ? 'deleteDraft' : 'cancel')}</sw-button>` : nothing}
      ${d.status === 'new' || d.status === 'draft' ? html`<sw-button slot="footer" ?disabled=${this.busy} data-save-draft @click=${() => this.save(false)}>${nt('saveDraft')}</sw-button>` : nothing}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy} data-publish @click=${() => this.save(d.status === 'new' || d.status === 'draft')}>${d.status === 'published' ? nt('save') : nt('publish')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-notices': DevicesNotices;
  }
}
