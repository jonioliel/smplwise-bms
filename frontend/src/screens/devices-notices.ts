import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { archiveNotice, audienceOptions, listBoards, listNotices, markRead, type Board, type Notice, type NoticesList } from '../api/notices';
import { nt } from '../i18n/notices';
import { SEV_KEY, SEV_LOOK, STATE_KEY, audienceText, draftOf, kpiCounts, listRows, matches, newDraft, windowText, type Draft, type Kpi, type Seg } from '../notices/model';
import '../notices/compose-dialog';
import type { NoticeSavedDetail } from '../notices/compose-dialog';
import '../notices/places-tree';
import '../notices/reads-sheet';
import '../notices/delete-dialog';
import { canDeleteRow, type DeleteTarget } from '../notices/delete-model';
import { PLACE_ALL, buildPlaces, placesCss, placesSelect, type AreaOpt } from '../notices/places-tree';
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
  static styles = [noticesCss, placesCss];

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
  @state() private areas: AreaOpt[] = [];
  @state() private place = PLACE_ALL; // NOTICEPAGE-295: the places tree's choice
  @state() private readsFor: Notice | null = null; // NOTICEPAGE-295: the "מי קרא" sheet
  @state() private draft: Draft | null = null;
  @state() private deleting: DeleteTarget | null = null; // NOTICEDEL-295: the notice whose deletion is being confirmed
  @state() private reading: Notice | null = null;
  @state() private toast = '';
  private toastTimer = 0;

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
      this.areas = o.areas ?? [];
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
      return html`<sw-page heading=${nt('title')}><sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${nt('off')} hint=${nt('offHint')}
        actionLabel=${nt('toSettings')} @action=${() => (location.hash = NOTICES_SETTINGS_HREF)}></sw-state-panel></sw-page>`;
    }
    if (this.forbidden) return html`<sw-page heading=${nt('title')}><sw-state-panel state="forbidden" heading=${nt('forbidden')}></sw-state-panel></sw-page>`;
    if (this.error) {
      return html`<sw-page heading=${nt('title')}><sw-state-panel state="error" heading=${nt('loadError')} hint=${this.error} actionLabel=${nt('retry')} @action=${() => this.load()}></sw-state-panel></sw-page>`;
    }
    if (!this.data) return html`<sw-page heading=${nt('title')}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const all = this.data.notices;
    const counts = kpiCounts(all);
    const showTree = this.data.defaults.show_places_tree !== false; // NOTICEDEL-295: the installation's setting (default on)
    const tree = showTree && this.manager && this.floors.length ? buildPlaces(all.filter((n) => matches(n, 'all', 'all', '', true)), this.floors, this.areas) : [];
    const place = tree.some((p) => p.id === this.place) ? this.place : PLACE_ALL;
    const rows = listRows(all, { kpi: this.kpi, seg: this.seg, q: this.q, manager: this.manager, place, floors: this.floors, areas: this.areas });
    const sub = this.manager ? nt('subtitleMgr', { n: counts.all, s: counts.scheduled, d: counts.drafts }) : nt('subtitle', { n: counts.all });
    return html`
      <sw-page heading="" data-notices-page>
        <div class="top"><div><h1>${nt('title')}</h1><p class="sub">${sub}</p></div><span class="sp"></span>
          <div class="meta">${this.manager ? html`<sw-button variant="primary" icon="plus" data-compose @click=${() => this.compose()}>${nt('newNotice')}</sw-button>` : nothing}</div></div>
        ${!all.length
          ? html`<sw-state-panel icon="inbox" state="empty" heading=${nt('emptyTitle')} hint=${this.manager ? nt('emptyManager') : nt('emptyReader')}
              actionLabel=${this.manager ? nt('firstNotice') : ''} @action=${() => this.compose()}></sw-state-panel>`
          : html`
            ${this.kpis(counts)}
            <div class=${tree.length ? 'with-tree' : ''}>
            ${tree.length ? html`<notice-places .nodes=${tree} .value=${place} @place-change=${(e: CustomEvent<string>) => (this.place = e.detail)}></notice-places>` : nothing}
            <div class="panel flush main">
              ${tree.length ? placesSelect(tree, place, (id) => (this.place = id)) : nothing}
              <div class="toolbar">
                ${this.manager ? html`<div class="seg" role="group" aria-label=${nt('colBoards')}>${(['all', 'mine', 'tv'] as Seg[]).map((s) => html`<button aria-pressed=${String(this.seg === s)} @click=${() => (this.seg = s)}>${nt(s === 'all' ? 'segAll' : s === 'mine' ? 'segMine' : 'segTv')}</button>`)}</div>` : nothing}
                <span class="sp"></span>
                <label class="search"><sw-icon name="search" size="14"></sw-icon><input type="search" placeholder=${nt('search')} aria-label=${nt('search')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)}></label>
              </div>
              <div class="scrollx">${this.table(rows)}</div>
              <div class="cards">${rows.length ? rows.map((n) => this.card(n)) : html`<div class="card" data-no-rows><span class="mut">${nt('noRows')}</span> <button type="button" class="pick" data-clear-filters @click=${() => this.clearFilters()}>${nt('clearFilters')}</button></div>`}</div>
            </div></div>`}
      </sw-page>
      ${this.composeDialog()} ${this.readDialog()}
      <notice-delete .notice=${this.deleting} @notice-delete-close=${() => (this.deleting = null)} @notice-deleted=${() => this.deleted()}></notice-delete>
      <notice-reads .notice=${this.readsFor} @reads-close=${() => (this.readsFor = null)}></notice-reads>
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
 ${rows.length ? nothing : html`<tr data-no-rows><td colspan=${this.manager ? 7 : 3}><span class="mut">${nt('noRows')}</span> <button type="button" class="pick" data-clear-filters @click=${() => this.clearFilters()}>${nt('clearFilters')}</button></td></tr>`}
      ${rows.map((n) => html`<tr class="go" tabindex="0" data-notice=${n.id} data-look=${this.look(n)} @click=${() => this.open(n)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.open(n)}>
        <td>${this.badge(n)}</td>
        <td><span class="t1">${n.title}${n.read === false && n.state === 'active' && !this.manager ? html`<span class="new" aria-label="new"></span>` : nothing}</span><span class="t2">${n.body.split('\n')[0]}</span></td>
        ${this.manager ? html`<td><span class="chips">${audienceText(n.audience, floors).map((a) => html`<span class="chip">${a}</span>`)}</span></td>
          <td>${this.boardNames(n).length ? html`<span class="chips">${this.boardNames(n).map((b) => html`<span class="chip">${b}</span>`)}</span>` : html`<span class="mut">-</span>`}</td>` : nothing}
        <td class="num mut">${windowText(n)}</td>
        ${this.manager ? html`<td class="num mut">${this.readsButton(n)}</td><td class="act" @click=${(e: Event) => e.stopPropagation()}>${this.actions(n)}</td>` : nothing}
      </tr>`)}
      </tbody></table>`;
  }

  private card(n: Notice) {
    return html`<div class="card" data-look=${this.look(n)} @click=${() => this.open(n)}>
      <div class="row">${this.badge(n)}<span class="mut num">${windowText(n)}</span></div>
      <span class="t1">${n.title}</span><span class="t2">${n.body.split('\n')[0]}</span>
      ${this.manager ? html`<div class="row" @click=${(e: Event) => e.stopPropagation()}>${this.readsButton(n)}${this.actions(n)}</div>` : nothing}</div>`;
  }

  /** NOTICEPAGE-295: the read count is the button that opens "מי קרא" (a draft has no readers). */
  private readsButton(n: Notice) {
    if (n.state === 'draft') return '-';
    return html`<button type="button" class="pick" data-reads=${n.id} aria-label=${nt('readsOf', { title: n.title })} @click=${(e: Event) => { e.stopPropagation(); this.readsFor = n; }}>${n.reads ?? 0}</button>`;
  }

  private actions(n: Notice) {
    const del = this.manager && canDeleteRow(n, this.data?.can.delete ?? false)
      ? html`<sw-button size="sm" variant="ghost" data-delete @click=${() => this.askDelete(n.id)}>${nt('delete')}</sw-button>` : nothing;
    if (n.state === 'archived') return del;
    return html`${n.state !== 'expired' ? html`<sw-button size="sm" variant=${n.state === 'draft' ? 'primary' : 'secondary'} @click=${() => this.open(n)}>${nt(n.state === 'draft' ? 'continueEdit' : 'edit')}</sw-button>` : nothing}
      ${n.state !== 'draft' ? html`<sw-button size="sm" data-archive @click=${() => this.archive(n)}>${nt('archive')}</sw-button>` : nothing}${del}`;
  }

  /** NOTICEDEL-295: opens the confirmation (and closes the compose dialog when the request came from it). */
  private askDelete(id: string): void {
    const n = this.data?.notices.find((x) => x.id === id);
    if (!n) return;
    this.draft = null;
    this.deleting = { id: n.id, title: n.title, state: n.state, severity: n.severity };
  }

  /** Back to the unfiltered list (the KPI tile, the segment, the search and the place). */
  private clearFilters(): void {
    this.kpi = 'all';
    this.seg = 'all';
    this.q = '';
    this.place = PLACE_ALL;
  }

  private async deleted(): Promise<void> {
    this.deleting = null;
    this.draft = null;
    this.say(nt('delDone'));
    await this.load();
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
  }

  private async saved(e: CustomEvent<NoticeSavedDetail>): Promise<void> {
    this.draft = null;
    this.say(e.detail.message);
    await this.load();
  }

  private composeDialog() {
    return html`<notice-compose .draft=${this.draft} .canDelete=${this.data?.can.delete ?? false} .canPush=${this.data?.can.push ?? false} .pushDefault=${this.data?.defaults.push_default ?? 'by_severity'} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${() => (this.draft = null)} @notice-delete=${(e: CustomEvent<{ id: string }>) => this.askDelete(e.detail.id)} @notice-saved=${(e: CustomEvent<NoticeSavedDetail>) => this.saved(e)}></notice-compose>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-notices': DevicesNotices;
  }
}
