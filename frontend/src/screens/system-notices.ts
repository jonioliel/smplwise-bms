import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import { qrSvg } from '../components/sw-second-factor';
import { ApiError, describeError } from '../api/client';
import {
  audienceOptions, boardControl, boardLink, createBoard, deleteBoard, getBoard, listBoards, listNotices, noticesSettings, patchBoard, patchNoticesSettings, putBoardItems,
  getBoardLink, rotateBoardToken, type Board, type NewsSource, type Notice, type SettingsResponse,
} from '../api/notices';
import type { Display } from '../notice-tv/tv-logic';
import { nt } from '../i18n/notices';
import { SEV_KEY, SEV_LOOK, agoText, boardDraft, draftOf, newDraft, placePresets, retentionOptions, seenState, slugOk, suggestSlug, windowText, type Draft } from '../notices/model';
import '../notices/compose-dialog';
import '../notices/display-saver';
import '../notices/display-info';
import '../notices/display-slides';
import '../notices/news-sources';
import { feedView, shortName } from '../notices/news-model';
import type { NoticeSavedDetail } from '../notices/compose-dialog';
import { noticesCss } from '../notices/styles';
import { NOTICES_HREF, NOTICES_SETTINGS_HREF, applyNoticesHidden } from '../shell/nav';
import '../notices/display-home';
import { dateInputLang } from '../api/day-format';

type BoardTab = 'general' | 'display' | 'notices';
type BoardDetail = Awaited<ReturnType<typeof getBoard>>;

/**
 * CR-NOTICE106 section 9: הגדרות › לוח הודעות (#/system/notices) and one board's page (#/system/notices/<board id>).
 * The module switch and the defaults need system.configure; the TV boards need notices.boards (each part shows by its own right; the
 * server re-checks every save). A board's link carries its token in the URL fragment and is shown ONCE (create / "קישור חדש"); the
 * display tab previews the real TV page in an iframe (`notice-tv.html?embed=1&preview=<id>`, the same renderer as the TV) and sends
 * the draft settings and the previous / pause / next commands to it by postMessage; "גם לטלוויזיות" sends the command to the real
 * TVs through the feed's control lease.
 */
@customElement('system-notices')
export class SystemNotices extends LitElement {
  static styles = [
    noticesCss,
    css`
      .tpls { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      .tpl { font: inherit; text-align: start; display: grid; gap: 6px; padding: 10px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); color: var(--sw-text); cursor: pointer; }
      .tpl[aria-pressed='true'] { border-color: var(--sw-accent); box-shadow: inset 0 0 0 1px var(--sw-accent); background: var(--sw-accent-soft); }
      .tpl b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .tpl span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
      .sch { aspect-ratio: 16 / 9; border-radius: var(--sw-r-sm); background: var(--sw-surface-3); display: grid; grid-template-rows: 1fr 5fr 1fr; gap: 3px; padding: 5px; }
      .sch i { display: block; border-radius: var(--sw-r-2xs); background: var(--sw-border-strong); }
      .sch .row { display: grid; gap: 3px; }
      .sch i.acc { background: var(--sw-accent); opacity: 0.6; }
      .sch.t1 .row { grid-template-columns: 6fr 4fr; }
      .sch.t2 { background: linear-gradient(180deg, var(--sw-accent-soft), var(--sw-surface-3)); }
      .sch.t2 .row { grid-template-columns: 4fr 5fr; }
      .sch.t3 { grid-template-rows: 1.4fr 3.6fr 1fr; }
      .prev { position: relative; inline-size: 100%; aspect-ratio: 16 / 9; border-radius: var(--sw-r-lg); overflow: hidden; border: 1px solid var(--sw-border); background: var(--sw-surface-3); }
      .prev.port { aspect-ratio: 9 / 16; max-inline-size: 320px; }
      .prev iframe { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; border: 0; }
      .disp { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .blocks { display: grid; gap: 10px; }
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .blk:last-child { border-block-end: 0; padding-block-end: 0; }
      .blk .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .feed { display: flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); }
      .feed .flg { inline-size: 36px; block-size: 22px; object-fit: contain; background: #fff; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm, 4px); padding: 1px 3px; box-sizing: border-box; }
      .feed .u { color: var(--sw-text-3); font-size: var(--sw-fs-xs); direction: ltr; unicode-bidi: isolate; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 260px; }
      .link { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border); }
      .link code { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; direction: ltr; text-align: left; font-size: var(--sw-fs-xs); color: var(--sw-text); }
      .qr { background: var(--sw-surface-solid); padding: 6px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); line-height: 0; }
      .alert { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
      .ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block-start: 8px; }
      .stack { display: grid; gap: 14px; }
      @media (max-width: 1023px) { .disp { grid-template-columns: minmax(0, 1fr); } }
    `,
  ];

  @property() boardId = '';
  @state() private s: SettingsResponse | null = null;
  @state() private boards: Board[] = [];
  @state() private error = '';
  @state() private forbidden = false;
  @state() private toast = '';
  @state() private creating: { name: string; slug: string; err: string } | null = null;
  @state() private link: { board: Board; token: string; rotated: boolean } | null = null;
  @state() private detail: BoardDetail | null = null;
  @state() private tab: BoardTab = 'general';
  @state() private draft: Display | null = null;
  @state() private dirty = false;
  @state() private nameDraft = '';
  @state() private notices: Notice[] = [];
  @state() private feedPick = '';
  @state() private feedUrl = '';
  @state() private confirmDelete = false;
  /** NOTICEPOLISH-295: the board whose link is about to be re-issued (copy link = issue a new one, the stored token is a hash). */
  @state() private confirmRotate: { board: Board; copy: boolean } | null = null;
  @state() private placeOther = false;
  @state() private sendToTvs = false;
  /** NOTICEADD-295: the compose dialog (null = closed) and what it offers (the audience options load once, for a notice manager). */
  @state() private compose: Draft | null = null;
  @state() private floors: { id: string; name: string; building: string }[] = [];
  @state() private groups: { id: string; name: string }[] = [];
  @state() private roles: { id: string; name: string }[] = [];
  private optionsLoaded = false;
  private toastTimer = 0;
  private loadedFor = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('boardId') && this.loadedFor !== this.boardId && this.s) void this.loadBoard();
  }

  /** A <select>'s value is applied after its options exist (a `.value` binding on the select runs before them and lands on the
   * first option): every select carries its value in `data-v`. */
  protected updated(): void {
    this.renderRoot.querySelectorAll<HTMLSelectElement>('select[data-v]').forEach((s) => {
      if (s.value !== s.dataset.v) s.value = s.dataset.v ?? '';
    });
  }

  private say(msg: string): void {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 2600);
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.s = await noticesSettings();
      this.forbidden = false;
      await this.loadBoards();
      await this.loadBoard();
      void this.loadOptions();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private async loadBoards(): Promise<void> {
    if (!this.s?.settings.enabled || !this.s.can.boards) {
      this.boards = [];
      return;
    }
    try {
      this.boards = (await listBoards()).boards;
    } catch {
      this.boards = [];
    }
  }

  private async loadBoard(): Promise<void> {
    this.loadedFor = this.boardId;
    this.detail = null;
    this.draft = null;
    this.dirty = false;
    if (!this.boardId || !this.s?.settings.enabled || !this.s.can.boards) return;
    try {
      this.detail = await getBoard(this.boardId);
      this.draft = structuredClone(this.detail.board.display ?? null) as Display | null;
      this.nameDraft = this.detail.board.name;
      try {
        this.notices = (await listNotices('all')).notices;
      } catch {
        this.notices = [];
      }
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async loadOptions(): Promise<void> {
    if (this.optionsLoaded || !this.s?.settings.enabled || !this.s.can.manage) return;
    this.optionsLoaded = true;
    try {
      const o = await audienceOptions();
      this.floors = o.floors;
      this.groups = o.groups;
      this.roles = o.roles;
    } catch {
      /* the compose dialog then offers "everyone" and the boards */
    }
  }

  // ---------------------------------------------------------------- writing a notice (NOTICEADD-295)

  private newNotice(boardId = ''): void {
    const st = this.s!.settings;
    this.compose = boardId ? boardDraft(new Date(), st.default_days, st.default_severity, boardId) : newDraft(new Date(), st.default_days, st.default_severity);
  }

  private editNotice(id: string): void {
    const n = this.notices.find((x) => x.id === id);
    if (n) this.compose = draftOf(n);
  }

  private async composed(e: CustomEvent<NoticeSavedDetail>): Promise<void> {
    this.compose = null;
    this.say(e.detail.message);
    try {
      this.notices = (await listNotices('all')).notices;
    } catch {
      /* the list stays as it was */
    }
    if (this.detail) {
      try {
        this.detail = await getBoard(this.detail.board.id);
      } catch (err) {
        this.say(describeError(err));
      }
    }
    void this.loadBoards();
  }

  private composeDialog() {
    return html`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push ?? false} .pushDefault=${this.s?.settings.push_default ?? 'by_severity'} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${() => (this.compose = null)} @notice-saved=${(e: CustomEvent<NoticeSavedDetail>) => this.composed(e)}></notice-compose>`;
  }

  // ---------------------------------------------------------------- module + defaults

  private async patchSettings(body: Parameters<typeof patchNoticesSettings>[0], msg = nt('saved')): Promise<void> {
    try {
      const r = await patchNoticesSettings(body);
      if (this.s) this.s = { ...this.s, settings: r.settings };
      if ('enabled' in body) {
        applyNoticesHidden(r.settings.enabled); // the navigation follows at once
        await this.loadBoards();
        void this.loadOptions();
      }
      this.say(msg);
    } catch (e) {
      this.say(describeError(e));
    }
  }

  render() {
    if (this.forbidden) return html`<sw-page heading=${nt('setTitle')}><sw-state-panel state="forbidden" heading=${nt('forbidden')} hint=${nt('setForbidden')}></sw-state-panel></sw-page>`;
    if (this.error && !this.s) return html`<sw-page heading=${nt('setTitle')}><sw-state-panel state="error" heading=${nt('saveError')} hint=${this.error} actionLabel=${nt('retry')} @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!this.s) return html`<sw-page heading=${nt('setTitle')}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    return html`<sw-page heading="" data-notices-settings>${this.boardId && this.detail ? this.boardPage() : this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : nothing}`;
  }

  private overview() {
    const s = this.s!;
    const st = s.settings;
    const can = s.can;
    return html`
      <div class="top"><div><h1>${nt('setTitle')}</h1><p class="sub">${nt('setSub')}</p></div><span class="sp"></span>
        ${st.enabled && can.manage ? html`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${() => (location.hash = NOTICES_HREF)}>${nt('allNotices')}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${() => this.newNotice()}>${nt('newNotice')}</sw-button></div>` : nothing}</div>
      ${!st.enabled ? html`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${nt('off')} hint=${nt('offBody')}
          actionLabel=${can.configure ? nt('turnOn') : ''} @action=${() => this.patchSettings({ enabled: true })}></sw-state-panel>` : nothing}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${nt('moduleCard')}</h2><span class="sp"></span>
          <sw-toggle .checked=${st.enabled} ?disabled=${!can.configure} label=${st.enabled ? nt('moduleOn') : nt('moduleOff')} data-module-switch
            @change=${(e: CustomEvent<{ checked: boolean }>) => this.patchSettings({ enabled: e.detail.checked })}></sw-toggle></div>
          <dl class="kv"><dt>${nt('kvWrite')}</dt><dd>${nt('kvWriteV')} <span class="mut ltr">(notices.manage)</span></dd><dt>${nt('kvPush')}</dt><dd>${nt('kvPushV')} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${nt('kvBoards')}</dt><dd>${nt('kvBoardsV')} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${can.configure ? this.defaultsCard() : nothing}
      </div>
      ${can.configure ? html`<notice-news-sources .sources=${st.news_sources} @ns-message=${(e: CustomEvent<string>) => this.say(e.detail)}
        @news-sources-change=${(e: CustomEvent<NewsSource[]>) => (this.s = { ...this.s!, settings: { ...this.s!.settings, news_sources: e.detail } })}></notice-news-sources>` : nothing}
      ${st.enabled && can.boards ? html`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${nt('boardsCard')}</h2><span class="chip num">${nt('boardsCount', { n: this.boards.length, m: st.boards_max })}</span><span class="sp"></span>
          ${can.configure ? html`<label class="ck"><input type="checkbox" .checked=${st.boards_remote} @change=${(e: Event) => this.patchSettings({ boards_remote: (e.target as HTMLInputElement).checked })}>${nt('dRemote')}</label>` : nothing}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length >= st.boards_max} @click=${() => this.openCreate()}>${nt('newBoard')}</sw-button></div>
        ${this.boards.length ? html`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map((b) => this.boardCard(b))}</div>`
          : html`<sw-state-panel icon="wall" state="empty" heading=${nt('noBoards')} hint=${nt('boardsEmpty')} actionLabel=${nt('firstBoard')} @action=${() => this.openCreate()}></sw-state-panel>`}
      </div>` : nothing}`;
  }

  private defaultsCard() {
    const s = this.s!;
    const st = s.settings;
    return html`<div class="panel" data-defaults-card><div class="hd"><h2>${nt('defaultsCard')}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${nt('dDays')}</label><div class="sum"><input id="ns-days" class="inp short num" type="number" min="1" max="90" .value=${String(st.default_days)}
          @change=${(e: Event) => this.patchSettings({ default_days: Number((e.target as HTMLInputElement).value) })}><span class="mut">${nt('dDaysUnit')}</span></div></div>
        <div class="fld"><label for="ns-sev">${nt('dSeverity')}</label><select id="ns-sev" class="inp" data-v=${st.default_severity} @change=${(e: Event) => this.patchSettings({ default_severity: (e.target as HTMLSelectElement).value as 'info' | 'alert' })}>
          <option value="info">${nt('sevInfo')}</option><option value="alert">${nt('sevAlert')}</option></select></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${nt('dReads')}</label><select id="ns-reads" class="inp" data-v=${st.reads_names ? 'names' : 'counts'} @change=${(e: Event) => this.patchSettings({ reads_names: (e.target as HTMLSelectElement).value === 'names' })}>
          <option value="names">${nt('dReadsNames')}</option><option value="counts">${nt('dReadsCounts')}</option></select></div>
        <div class="fld"><label for="ns-ret">${nt('dRetention')}</label><select id="ns-ret" class="inp" data-v=${String(st.retention_days)}
          @change=${(e: Event) => this.patchSettings({ retention_days: Number((e.target as HTMLSelectElement).value) })}>
          ${retentionOptions(st.retention_days).map((o) => html`<option value=${String(o.value)}>${o.label}</option>`)}</select></div>
        <notice-home-empty .value=${st.home_empty ?? 'hide'} @home-empty-change=${(e: CustomEvent<'hide' | 'line'>) => this.patchSettings({ home_empty: e.detail })}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${nt('dPush')}</label><select id="ns-push" class="inp" data-v=${st.push_default}
          @change=${(e: Event) => this.patchSettings({ push_default: (e.target as HTMLSelectElement).value as 'by_severity' | 'always' | 'never' })}>
          <option value="by_severity">${nt('dPushSev')}</option><option value="always">${nt('dPushAlways')}</option><option value="never">${nt('dPushNever')}</option></select>
          <span class="hint">${nt('dPushHint')}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${nt('dWeather')}</label><select id="ns-wx" class="inp" data-v=${st.weather_entity} @change=${(e: Event) => this.patchSettings({ weather_entity: (e.target as HTMLSelectElement).value })}>
          <option value="">${nt('dWeatherNone')}</option>${s.weather_entities.map((w) => html`<option value=${w.entity_id}>${w.name}</option>`)}</select></div>
        <div class="fld"><label for="ns-bn">${nt('dBuilding')}</label><input id="ns-bn" class="inp" maxlength="60" .value=${st.building_name} placeholder=${s.building_fallback}
          @change=${(e: Event) => this.patchSettings({ building_name: (e.target as HTMLInputElement).value })}><span class="hint">${nt('dBuildingHint', { name: s.building_fallback || '-' })}</span></div>
      </div>
      <div class="fld"><label for="ns-origin">${nt('dOrigin')}</label><input id="ns-origin" class="inp ltr" maxlength="220" .value=${st.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${(e: Event) => this.patchSettings({ boards_origin: (e.target as HTMLInputElement).value })}><span class="hint">${nt('dOriginHint')}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${nt('dConnTotal')}</label><input id="ns-ctot" class="inp short num" type="number" min="4" max="256" data-conn-total .value=${String(st.conn_total)}
          @change=${(e: Event) => this.patchSettings({ conn_total: Number((e.target as HTMLInputElement).value) })}></div>
        <div class="fld"><label for="ns-cadr">${nt('dConnPerAddr')}</label><input id="ns-cadr" class="inp short num" type="number" min="1" max="64" data-conn-per-address .value=${String(st.conn_per_address)}
          @change=${(e: Event) => this.patchSettings({ conn_per_address: Number((e.target as HTMLInputElement).value) })}></div>
      </div>
      <label class="ck" data-places-tree-setting><input type="checkbox" .checked=${st.show_places_tree !== false} @change=${(e: Event) => this.patchSettings({ show_places_tree: (e.target as HTMLInputElement).checked })}>${nt('dPlacesTree')}</label>
      <label class="ck"><input type="checkbox" .checked=${st.news_custom} @change=${(e: Event) => this.patchSettings({ news_custom: (e.target as HTMLInputElement).checked })}>${nt('dCustomFeeds')}</label>
      <div class="fld"><span class="lbl">${nt('companyLogo')}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${nt('logoWhere')}</a></div>
    </div></div>`;
  }

  // ---------------------------------------------------------------- boards list

  private seenBadge(b: Board) {
    const st = seenState(b, Date.now());
    const look = st === 'online' ? 'ok' : st === 'off' ? 'off' : 'unk';
    const label = st === 'online' ? nt('bOnline') : st === 'off' ? nt('bDisabled') : st === 'never' ? nt('bNever') : nt('bIdle');
    return html`<span class="badge" data-look=${look}>${label}</span>`;
  }

  private summary(b: Board): string {
    const d = b.display;
    if (!d) return '';
    const tpl = nt(d.template === 1 ? 'tpl1' : d.template === 2 ? 'tpl2' : 'tpl3');
    const theme = nt(d.theme === 'day' ? 'themeDay' : d.theme === 'night' ? 'themeNight' : 'orAuto');
    return `${tpl} · ${theme} · ${d.rotate_s} ${nt('seconds')}`;
  }

  private boardsTable() {
    return html`<table class="t"><thead><tr><th>${nt('bState')}</th><th>${nt('bName')}</th><th>${nt('bAddress')}</th><th>${nt('bItems')}</th><th>${nt('bSeen')}</th><th></th></tr></thead><tbody>
      ${this.boards.map((b) => html`<tr class="go" tabindex="0" data-board=${b.slug} @click=${() => this.goBoard(b)} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.goBoard(b)}>
        <td>${this.seenBadge(b)}</td><td><span class="t1">${b.name}</span><span class="t2">${this.summary(b)}</span></td>
        <td class="ltr mut">/b/${b.slug}</td><td class="num">${b.item_count ?? 0}</td><td class="num mut">${agoText(b.last_seen_at, Date.now())}</td>
        <td class="act">${this.rowActions(b)}</td></tr>`)}
      </tbody></table>`;
  }

  /** NOTICEPOLISH-295: a row's actions - "הפעלה" for a disabled board, "העתקת קישור" for a system administrator, "פתיחה". */
  private rowActions(b: Board) {
    const stop = (fn: () => void) => (e: Event) => { e.stopPropagation(); fn(); };
    return html`${!b.enabled ? html`<sw-button size="sm" data-activate @click=${stop(() => void this.activate(b))}>${nt('activate')}</sw-button>` : nothing}
      ${this.canCopyLink() ? html`<sw-button size="sm" data-copy-link @click=${stop(() => void this.copyLink(b))}>${nt('copyLink')}</sw-button>` : nothing}
      <sw-button size="sm" @click=${stop(() => this.goBoard(b))}>${nt('open')}</sw-button>`;
  }

  /** The TV link is stored only as a SHA-256, so it cannot be read back: "copy" issues a new link after a confirmation. Offered to a
   * system administrator (system.configure) who also holds the boards right; nobody else is shown it. */
  private canCopyLink(): boolean {
    const can = this.s?.can;
    return !!(can?.configure && can.boards);
  }

  /** NOTICEPERM-295: the TV link is permanent - the stored one is read back and copied (the same link every time); a board saved before
   * the stored token existed asks once before it issues one. */
  private async copyLink(b: Board): Promise<void> {
    if (!b.has_stored_link) {
      this.confirmRotate = { board: b, copy: true };
      return;
    }
    try {
      const r = await getBoardLink(b.id);
      this.link = { board: b, token: r.token, rotated: false };
      void navigator.clipboard?.writeText(this.linkUrl(b, r.token)).then(() => this.say(nt('copied')), () => undefined);
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private async activate(b: Board): Promise<void> {
    try {
      await patchBoard(b.id, { enabled: true });
      await this.loadBoards();
      if (this.detail?.board.id === b.id) this.detail = { ...this.detail, board: { ...this.detail.board, enabled: true } };
      this.say(nt('saved'));
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private boardCard(b: Board) {
    return html`<div class="card" @click=${() => this.goBoard(b)}><div class="row">${this.seenBadge(b)}<span class="ltr mut">/b/${b.slug}</span></div><span class="t1">${b.name}</span><span class="t2">${this.summary(b)}</span></div>`;
  }

  private goBoard(b: Board): void {
    location.hash = `${NOTICES_SETTINGS_HREF}/${encodeURIComponent(b.id)}`;
  }

  private openCreate(): void {
    this.creating = { name: '', slug: suggestSlug('board', this.boards.map((b) => b.slug)), err: '' };
  }

  private createDialog() {
    const c = this.creating;
    return html`<sw-dialog ?open=${!!c} heading=${nt('newBoard')} @close=${() => (this.creating = null)} data-create-board>
      ${c ? html`<div class="form">
        <div class="fld"><label for="nb-name">${nt('bName')}</label><input id="nb-name" class="inp" maxlength="60" .value=${c.name} @input=${(e: Event) => (this.creating = { ...c, name: (e.target as HTMLInputElement).value, err: '' })}></div>
        <div class="fld"><label for="nb-slug">${nt('bSlug')}</label><input id="nb-slug" class="inp ltr" maxlength="40" .value=${c.slug} @input=${(e: Event) => (this.creating = { ...c, slug: (e.target as HTMLInputElement).value.toLowerCase(), err: '' })}><span class="hint">${nt('bSlugHint')}</span></div>
        ${c.err ? html`<span class="err" role="alert">${c.err}</span>` : nothing}</div>` : nothing}
      <sw-button slot="footer" @click=${() => (this.creating = null)}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${() => this.create()}>${nt('newBoard')}</sw-button></sw-dialog>`;
  }

  private async create(): Promise<void> {
    const c = this.creating;
    if (!c) return;
    if (!c.name.trim()) {
      this.creating = { ...c, err: nt('bName') };
      return;
    }
    if (!slugOk(c.slug)) {
      this.creating = { ...c, err: nt('bSlugHint') };
      return;
    }
    try {
      const r = await createBoard({ name: c.name.trim(), slug: c.slug });
      this.creating = null;
      this.link = { board: r.board, token: r.token, rotated: false };
      await this.loadBoards();
    } catch (e) {
      this.creating = { ...c, err: describeError(e) };
    }
  }

  private linkUrl(b: Board, token: string): string {
    return boardLink(b.slug, token, this.s?.settings.boards_origin || undefined);
  }

  private linkDialog() {
    const l = this.link;
    const url = l ? this.linkUrl(l.board, l.token) : '';
    return html`<sw-dialog ?open=${!!l} heading=${l ? nt('linkTitle', { name: l.board.name }) : ''} subheading=${l?.rotated ? nt('linkSub') : nt('linkSubNew')} @close=${() => (this.link = null)} data-link-dialog>
      ${l ? html`<div class="form">
        <div class="link"><code data-board-link>${url}</code><sw-button size="sm" icon="copy" @click=${() => this.copy(url)}>${nt('copyLink')}</sw-button></div>
        <div class="sum"><div class="qr">${qrSvg(url, 148)}</div><p class="hint">${nt('linkHint')}</p></div>
        ${!this.s?.settings.boards_remote ? html`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${nt('linkLan')}</span></div>` : nothing}
      </div>` : nothing}
      <sw-button slot="footer" variant="primary" @click=${() => (this.link = null)}>${nt('done')}</sw-button></sw-dialog>`;
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.say(nt('copied'));
    } catch {
      this.say(text);
    }
  }

  // ---------------------------------------------------------------- one board's page

  private boardPage() {
    const d = this.detail!;
    const b = d.board;
    const tabs = [{ id: 'general', label: nt('tabGeneral') }, { id: 'display', label: nt('tabDisplay') }, { id: 'notices', label: `${nt('tabNotices')} (${d.notices.length})` }];
    return html`
      <div class="top"><div><h1>${b.name}</h1><p class="sub"><a href=${NOTICES_SETTINGS_HREF}>${nt('back')}</a> · <span class="ltr">/b/${b.slug}</span> · ${agoText(b.last_seen_at, Date.now())}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${() => window.open(this.previewSrc(false), '_blank', 'noopener')}>${nt('openTv')}</sw-button>
          ${this.canCopyLink() ? html`<sw-button icon="copy" data-copy-link @click=${() => void this.copyLink(b)}>${nt('copyLink')}</sw-button>` : nothing}
          <sw-button icon="refresh" data-rotate @click=${() => (this.confirmRotate = { board: b, copy: false })}>${nt('newLink')}</sw-button>
          <sw-toggle .checked=${b.enabled} label=${nt('boardEnabled')} @change=${(e: CustomEvent<{ checked: boolean }>) => this.saveBoard({ enabled: e.detail.checked })}></sw-toggle>
        </div></div>
      <sw-tabs .items=${tabs} active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id as BoardTab)}></sw-tabs>
      <div class="stack">${this.tab === 'general' ? this.generalTab() : this.tab === 'display' ? this.displayTab() : this.noticesTab()}</div>`;
  }

  private generalTab() {
    const b = this.detail!.board;
    const d = this.draft!;
    return html`<div class="two">
      <div class="panel"><div class="hd"><h2>${nt('tabGeneral')}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty && this.nameDraft === b.name} @click=${() => this.saveAll()}>${nt('save')}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${nt('bName')}</label><input id="bg-name" class="inp" maxlength="60" .value=${this.nameDraft} @input=${(e: Event) => (this.nameDraft = (e.target as HTMLInputElement).value)}></div>
            <div class="fld"><label for="bg-slug">${nt('bSlug')}</label><input id="bg-slug" class="inp ltr" .value=${b.slug} disabled></div></div>
          <div class="r">${this.placeField(d.place)}
            <div class="fld"><label for="bg-lang">${nt('lang')}</label><select id="bg-lang" class="inp" data-v=${d.lang} @change=${(e: Event) => this.setD({ lang: (e.target as HTMLSelectElement).value as 'he' | 'en' })}><option value="he">עברית</option><option value="en">English</option></select></div></div>
          <dl class="kv"><dt>${nt('kvTemplate')}</dt><dd>${this.summary(b)}</dd><dt>${nt('bItems')}</dt><dd class="num">${this.detail!.notices.length}</dd>
            <dt>${nt('kvSeen')}</dt><dd>${agoText(b.last_seen_at, Date.now())}</dd><dt>${nt('kvCreated')}</dt><dd class="num">${(b.created_at || '').slice(0, 10)}</dd>
            <dt>${nt('kvRotated')}</dt><dd class="num">${(b.token_rotated_at || '').slice(0, 10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${() => (this.confirmDelete = true)}>${nt('deleteBoard')}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${nt('bAddress')}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(b, '••••••••••••••••••••••••••••••••')}</code></div>
        <p class="hint">${nt('linkOnce')} ${nt('linkHint')}</p>
        <div class="ctl"><sw-button icon="refresh" @click=${() => (this.confirmRotate = { board: b, copy: false })}>${nt('newLink')}</sw-button></div></div>
    </div>`;
  }

  /** NOTICEPOLISH-295: the board's place as a choice of the installation's floors (when they are known), with "אחר..." for free text; the
   * stored value stays the same text field of the display settings, and a value that is not a preset stays editable. */
  private placeField(place: string) {
    const presets = placePresets(this.floors);
    if (!presets.length) {
      return html`<div class="fld"><label for="bg-place">${nt('place')}</label><input id="bg-place" class="inp" maxlength="60" .value=${place} @input=${(e: Event) => this.setD({ place: (e.target as HTMLInputElement).value })}></div>`;
    }
    const custom = !!place && !presets.includes(place);
    const pick = this.placeOther || custom ? '__other' : place;
    return html`<div class="fld"><label for="bg-place">${nt('place')}</label>
      <select id="bg-place" class="inp" data-place-select data-v=${pick} @change=${(e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        this.placeOther = v === '__other';
        if (!this.placeOther) this.setD({ place: v });
      }}><option value="">-</option>${presets.map((p) => html`<option value=${p}>${p}</option>`)}<option value="__other">${nt('placeOther')}</option></select>
      ${pick === '__other' ? html`<input class="inp" data-place-text maxlength="60" aria-label=${nt('place')} .value=${place} @input=${(e: Event) => this.setD({ place: (e.target as HTMLInputElement).value })}>` : nothing}</div>`;
  }

  private setD(p: Partial<Display>): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...p, blocks: { ...this.draft.blocks, ...(p.blocks ?? {}) } } as Display;
    this.dirty = true;
    this.pushPreview();
  }

  private previewSrc(embed = true): string {
    const id = encodeURIComponent(this.detail?.board.id ?? '');
    return `notice-tv.html?${embed ? 'embed=1&' : ''}preview=${id}`;
  }

  private frame(): HTMLIFrameElement | null {
    return this.renderRoot.querySelector('iframe[data-preview]');
  }

  private pushPreview(): void {
    this.frame()?.contentWindow?.postMessage({ smplwise: 'tv', display: this.draft }, location.origin);
  }

  private async cmd(c: 'next' | 'prev' | 'toggle'): Promise<void> {
    this.frame()?.contentWindow?.postMessage({ smplwise: 'tv', cmd: c }, location.origin);
    if (this.sendToTvs && this.detail) {
      try {
        await boardControl(this.detail.board.id, c === 'toggle' ? 'pause' : c);
      } catch (e) {
        this.say(describeError(e));
      }
    }
  }

  private displayTab() {
    const d = this.draft!;
    const tpls: { n: 1 | 2 | 3; t: string; dsc: string }[] = [{ n: 1, t: nt('tpl1'), dsc: nt('tpl1d') }, { n: 2, t: nt('tpl2'), dsc: nt('tpl2d') }, { n: 3, t: nt('tpl3'), dsc: nt('tpl3d') }];
    const portrait = d.layout === 'portrait';
    const s = this.s!.settings;
    const active = this.detail!.notices.filter((n) => n.state === 'active');
    return html`<div class="disp">
      <div class="panel"><div class="hd"><h2>${nt('tplCard')}</h2><span class="sp"></span><span class="chip" data-look="acc">${nt('tplLive')}</span></div>
        <div class="tpls" data-tpls>${tpls.map((t) => html`<button class="tpl" data-tpl=${t.n} aria-pressed=${String(d.template === t.n)} @click=${() => this.setD({ template: t.n })}>
          <div class="sch t${t.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${t.t}</b><span>${t.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${nt('preview')}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${() => window.open(this.previewSrc(false), '_blank', 'noopener')}>${nt('fullScreen')}</sw-button></div>
        <div class="prev ${portrait ? 'port' : ''}"><iframe data-preview title=${nt('preview')} src=${this.previewSrc()} @load=${() => this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${() => this.cmd('prev')}>${nt('prev')}</sw-button><sw-button size="sm" @click=${() => this.cmd('toggle')}>${nt('pauseToggle')}</sw-button>
          <sw-button size="sm" @click=${() => this.cmd('next')}>${nt('next')}</sw-button><label class="ck"><input type="checkbox" .checked=${this.sendToTvs} @change=${(e: Event) => (this.sendToTvs = (e.target as HTMLInputElement).checked)}>${nt('sendToTvs')}</label>
          <span class="hint">${nt('remoteHint')}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${nt('theme')}</span><div class="seg" data-theme-seg>${(['day', 'night', 'auto'] as const).map((th) => html`<button aria-pressed=${String(d.theme === th)} @click=${() => this.setD({ theme: th })}>${nt(th === 'day' ? 'themeDay' : th === 'night' ? 'themeNight' : 'themeAuto')}</button>`)}</div></div>
            <div class="fld"><span class="lbl">${nt('orient')}</span><div class="seg">${(['auto', 'landscape', 'portrait'] as const).map((o) => html`<button aria-pressed=${String(d.layout === o)} @click=${() => this.setD({ layout: o })}>${nt(o === 'auto' ? 'orAuto' : o === 'landscape' ? 'orLand' : 'orPort')}</button>`)}</div></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${nt('dayHours')}</label><input id="bd-dh" class="inp ltr" placeholder="07:00-19:00" .value=${d.day_hours} @change=${(e: Event) => this.setD({ day_hours: (e.target as HTMLInputElement).value.trim() })}><span class="hint">${nt('dayHoursHint')}</span></div>
            <div class="fld"><label for="bd-fs">${nt('fontSize')}</label><select id="bd-fs" class="inp" data-v=${d.font_size} @change=${(e: Event) => this.setD({ font_size: (e.target as HTMLSelectElement).value as Display['font_size'] })}>
              <option value="s">${nt('fsS')}</option><option value="m">${nt('fsM')}</option><option value="l">${nt('fsL')}</option></select></div></div>
          <div class="fld"><label class="ck"><input type="checkbox" .checked=${d.night.enabled} @change=${(e: Event) => this.setD({ night: { ...d.night, enabled: (e.target as HTMLInputElement).checked } })}>${nt('nightDim')}</label>
            ${d.night.enabled ? html`<div class="sum">${nt('nightFrom')}<input class="inp short ltr" type="time" lang=${dateInputLang()} .value=${d.night.from} @change=${(e: Event) => this.setD({ night: { ...d.night, from: (e.target as HTMLInputElement).value } })}>
              ${nt('nightTo')}<input class="inp short ltr" type="time" lang=${dateInputLang()} .value=${d.night.to} @change=${(e: Event) => this.setD({ night: { ...d.night, to: (e.target as HTMLInputElement).value } })}>
              ${nt('nightLevel')}<select class="inp short" data-v=${String(d.night.dim)} @change=${(e: Event) => this.setD({ night: { ...d.night, dim: Number((e.target as HTMLSelectElement).value) } })}>
                ${[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((v) => html`<option value=${String(v)}>${Math.round(v * 100)}%</option>`)}</select></div>` : nothing}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${d.burn_in.shift} @change=${(e: Event) => this.setD({ burn_in: { shift: (e.target as HTMLInputElement).checked } })}>${nt('burnIn')}</label>
            <label class="ck"><input type="checkbox" .checked=${d.blocks.company_logo} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, company_logo: (e.target as HTMLInputElement).checked } })}>${nt('companyLogo')}</label>
            <label class="ck"><input type="checkbox" checked disabled>${nt('smplwiseLogo')}</label></div>
          <notice-display-saver .display=${d} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${nt('whatShown')}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${() => this.saveAll()}>${nt('save')}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${d.blocks.clock} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, clock: (e.target as HTMLInputElement).checked } })}>${nt('blkClock')}</label>
            <div class="sub"><label class="ck"><input type="checkbox" .checked=${d.blocks.hebdate} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, hebdate: (e.target as HTMLInputElement).checked } })}>${nt('blkHebdate')}</label>
              <label class="ck"><input type="checkbox" .checked=${d.blocks.welcome} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, welcome: (e.target as HTMLInputElement).checked } })}>${nt('blkWelcome')}</label></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${d.blocks.weather} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, weather: (e.target as HTMLInputElement).checked } })}>${nt('blkWeather')}</label>
            <div class="sub">${s.weather_entity ? html`<span class="ltr mut">${s.weather_entity}</span>` : html`<span class="mut">${nt('blkWeatherNoEntity')}</span>`}
              <span>${nt('hoursAhead')}</span><select class="inp short" data-v=${String(d.weather.hours)} @change=${(e: Event) => this.setD({ weather: { hours: Number((e.target as HTMLSelectElement).value) } })}>${[3, 5, 8].map((h) => html`<option value=${String(h)}>${h}</option>`)}</select></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${d.blocks.news} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, news: (e.target as HTMLInputElement).checked } })}>${nt('blkNews')}</label>
            <div class="sub">${d.news.feeds.map((f, i) => { const v = feedView(f, s.news_sources); return html`<div class="feed" data-feed=${f.url}>${v.logo ? html`<img class="flg" alt="" src=${v.logo}>` : html`<sw-icon name="link" size="12"></sw-icon>`}<b>${shortName(v.name)}</b>${v.known ? nothing : html`<span class="chip">${nt('nsCustomTag')}</span>`}
                <sw-button size="sm" variant="ghost" @click=${() => this.setD({ news: { ...d.news, feeds: d.news.feeds.filter((_x, k) => k !== i) } })}>${nt('remove')}</sw-button></div>`; })}
              <select class="inp short" data-v=${this.feedPick} @change=${(e: Event) => (this.feedPick = (e.target as HTMLSelectElement).value)}><option value="">${nt('feedPick')}</option>
                ${s.news_sources.filter((f) => f.enabled !== false).map((f) => html`<option value=${f.url}>${f.name}${f.custom ? ' · ' + nt('nsCustomTag') : ''}</option>`)}${s.news_custom ? html`<option value="custom">${nt('feedCustom')}</option>` : nothing}</select>
              ${this.feedPick === 'custom' ? html`<input class="inp ltr" placeholder="https://" .value=${this.feedUrl} @input=${(e: Event) => (this.feedUrl = (e.target as HTMLInputElement).value)}>` : nothing}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick || d.news.feeds.length >= 6} @click=${() => this.addFeed()}>${nt('add')}</sw-button>
              <span>${nt('speed')}</span><div class="seg">${(['slow', 'normal', 'fast'] as const).map((sp) => html`<button aria-pressed=${String(d.news.speed === sp)} @click=${() => this.setD({ news: { ...d.news, speed: sp } })}>${nt(sp === 'slow' ? 'spSlow' : sp === 'normal' ? 'spNormal' : 'spFast')}</button>`)}</div></div></div>
          <notice-display-info .value=${d.blocks.info} .show=${d.blocks.info_show !== false} @info-show-change=${(e: CustomEvent<boolean>) => this.setD({ blocks: { ...d.blocks, info_show: e.detail } })} @info-change=${(e: CustomEvent<string[]>) => this.setD({ blocks: { ...d.blocks, info: e.detail } })}></notice-display-info>
          <div class="blk"><span class="ck"><b>${nt('blkNotices')}</b></span><span class="hint">${active.length} ${nt('kpiActive')}</span>
            <div class="sub"><span>${nt('mode')}</span><div class="seg" data-mode-seg>${(['rotation', 'all', 'focus'] as const).map((m) => html`<button aria-pressed=${String(d.mode === m)} data-mode=${m} @click=${() => this.setD({ mode: m })}>${nt(m === 'rotation' ? 'modeRotation' : m === 'all' ? 'modeAll' : 'modeFocus')}</button>`)}</div></div>
            <div class="sub"><span>${nt('rotateEvery')}</span><input class="inp short num" type="number" min="6" max="60" step="1" data-rot .value=${String(d.rotate_s)}
              @change=${(e: Event) => this.setD({ rotate_s: Math.max(6, Math.min(60, Math.round(Number((e.target as HTMLInputElement).value) || 12))) })}><span>${nt('seconds')}</span><span class="hint">${nt('rotateHint')}</span></div>
            <div class="sub"><span>${nt('urgent')}</span><select class="inp" data-urg data-v=${d.urgent === 'band' ? 'stage' : d.urgent} @change=${(e: Event) => this.setD({ urgent: (e.target as HTMLSelectElement).value as Display['urgent'] })}>
              <option value="stage">${nt('urgStage')}</option><option value="stay">${nt('urgStay')}</option><option value="full">${nt('urgFull')}</option></select></div>
            <div class="sub"><span>${nt('hold')}</span><select class="inp" data-hold data-v=${d.hold} @change=${(e: Event) => this.setD({ hold: (e.target as HTMLSelectElement).value })}>
              <option value="">${nt('holdNone')}</option>${active.map((n) => html`<option value=${n.id}>${n.title}</option>`)}</select><span class="hint">${nt('holdHint')}</span></div>
            <p class="hint">${nt('dwellNote')}</p></div>
          <notice-display-slides .display=${d} .boardId=${this.detail!.board.id} .boards=${this.boards} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)} @slides-changed=${() => this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`;
  }

  private addFeed(): void {
    const d = this.draft;
    if (!d) return;
    const pick = this.feedPick;
    const src = this.s!.settings.news_sources.find((f) => f.url === pick);
    const feed = src ? { id: src.id, name: src.name, url: src.url } : pick === 'custom' && this.feedUrl.startsWith('https://') ? { name: new URL(this.feedUrl).hostname, url: this.feedUrl } : null;
    if (!feed || d.news.feeds.some((f) => f.url === feed.url)) return;
    this.setD({ news: { ...d.news, feeds: [...d.news.feeds, feed] }, blocks: { ...d.blocks, news: true } });
    this.feedPick = '';
    this.feedUrl = '';
  }

  private noticesTab() {
    const d = this.detail!;
    const onBoard = new Set(d.notices.map((n) => n.id));
    const candidates = this.notices.filter((n) => !onBoard.has(n.id) && (n.state === 'active' || n.state === 'scheduled' || n.state === 'draft'));
    const manage = !!this.s?.can.manage;
    const editable = (id: string) => manage && this.notices.some((x) => x.id === id && x.state !== 'archived' && x.state !== 'expired');
    // NOTICEADD-295: the mockup's "הודעה חדשה ללוח" (2.16.0 offered only the picker of existing notices, and drew nothing without one)
    return html`<div class="panel flush">
      <div class="toolbar"><h2>${nt('boardNotices')}</h2><span class="chip num">${d.notices.filter((n) => n.state === 'active').length} ${nt('kpiActive')}</span><span class="sp"></span>
        ${candidates.length ? html`<select class="inp short" data-add-notice @change=${(e: Event) => this.addItem((e.target as HTMLSelectElement).value)}><option value="">${nt('addToBoard')}…</option>
          ${candidates.map((n) => html`<option value=${n.id}>${n.title}</option>`)}</select>` : nothing}
        ${manage ? html`<sw-button variant="primary" icon="plus" data-board-compose @click=${() => this.newNotice(d.board.id)}>${nt('newForBoard')}</sw-button>` : nothing}</div>
      ${d.notices.length ? html`<table class="t"><thead><tr><th>${nt('colState')}</th><th>${nt('colNotice')}</th><th>${nt('colWindow')}</th><th></th></tr></thead><tbody>
        ${d.notices.map((n) => html`<tr data-look=${n.state === 'active' ? SEV_LOOK[n.severity] : 'off'} data-board-notice=${n.id}><td><span class="badge" data-look=${n.state === 'active' ? SEV_LOOK[n.severity] : 'off'}>${nt(SEV_KEY[n.severity])}${n.pinned ? ' · ' + nt('pinned') : ''}</span></td>
          <td><span class="t1">${n.title}</span></td><td class="num mut">${windowText(n)}</td>
          <td class="act">${editable(n.id) ? html`<sw-button size="sm" data-edit-notice @click=${() => this.editNotice(n.id)}>${nt('edit')}</sw-button>` : nothing}
            <sw-button size="sm" @click=${() => this.removeItem(n.id)}>${nt('removeFromBoard')}</sw-button></td></tr>`)}</tbody></table>`
        : html`<sw-state-panel icon="inbox" state="empty" heading=${nt('boardEmpty')}
            actionLabel=${manage ? nt('newForBoard') : ''} @action=${() => this.newNotice(d.board.id)}></sw-state-panel>`}
    </div>`;
  }

  private async addItem(id: string): Promise<void> {
    if (!id || !this.detail) return;
    await this.setItems([...this.detail.notices.map((n) => n.id), id]);
  }

  private async removeItem(id: string): Promise<void> {
    if (!this.detail) return;
    await this.setItems(this.detail.notices.map((n) => n.id).filter((x) => x !== id));
  }

  private async setItems(ids: string[]): Promise<void> {
    try {
      await putBoardItems(this.detail!.board.id, ids);
      this.detail = await getBoard(this.detail!.board.id);
      this.say(nt('saved'));
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private async saveBoard(body: Parameters<typeof patchBoard>[1]): Promise<void> {
    if (!this.detail) return;
    try {
      const r = await patchBoard(this.detail.board.id, body);
      this.detail = { ...this.detail, board: r.board };
      this.draft = structuredClone(r.board.display ?? this.draft) as Display;
      this.dirty = false;
      this.say(nt('saved'));
      void this.loadBoards();
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private async saveAll(): Promise<void> {
    const body: Parameters<typeof patchBoard>[1] = {};
    if (this.draft && this.dirty) body.display = this.draft;
    if (this.detail && this.nameDraft.trim() && this.nameDraft !== this.detail.board.name) body.name = this.nameDraft.trim();
    await this.saveBoard(body);
  }

  private async rotate(board: Board, copy: boolean): Promise<void> {
    try {
      const r = await rotateBoardToken(board.id);
      this.link = { board: r.board, token: r.token, rotated: true };
      if (this.detail?.board.id === r.board.id) this.detail = { ...this.detail, board: r.board };
      void this.loadBoards();
      if (copy) void navigator.clipboard?.writeText(this.linkUrl(r.board, r.token)).then(() => this.say(nt('copied')), () => undefined);
    } catch (e) {
      this.say(describeError(e));
    }
  }

  /** The confirmation before a link is re-issued (the previous link stops working at once). */
  private rotateDialog() {
    const c = this.confirmRotate;
    return html`<sw-dialog ?open=${!!c} heading=${c ? nt('copyAsk', { name: c.board.name }) : ''} @close=${() => (this.confirmRotate = null)} data-rotate-confirm>
      <p>${nt('copyAskBody')}</p>
      <sw-button slot="footer" @click=${() => (this.confirmRotate = null)}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-rotate-go @click=${() => { const x = this.confirmRotate; this.confirmRotate = null; if (x) void this.rotate(x.board, x.copy); }}>${nt('copyAsk2')}</sw-button></sw-dialog>`;
  }

  private deleteDialog() {
    return html`<sw-dialog ?open=${this.confirmDelete} heading=${nt('deleteBoard')} @close=${() => (this.confirmDelete = false)}>
      <p>${nt('deleteBoardQ')}</p>
      <sw-button slot="footer" @click=${() => (this.confirmDelete = false)}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${() => this.removeBoard()}>${nt('deleteBoard')}</sw-button></sw-dialog>`;
  }

  private async removeBoard(): Promise<void> {
    if (!this.detail) return;
    try {
      await deleteBoard(this.detail.board.id);
      this.confirmDelete = false;
      location.hash = NOTICES_SETTINGS_HREF;
      await this.loadBoards();
    } catch (e) {
      this.say(describeError(e));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-notices': SystemNotices;
  }
}
