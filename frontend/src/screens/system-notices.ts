import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { settingsLadderStyles } from '../styles/settings';
import '../components/sw-page';
import '../components/sw-segmented';
import '../components/sw-field';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-button';
import '../components/sw-icon';
import { toggled } from '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-tabs';
import '../components/sw-state-panel';
import '../components/sw-table';
import '../components/sw-dropdown'; // MULTI-BUILDING-HOME-2500: the board's building
import type { TableColumn } from '../components/sw-table';
import { qrSvg } from '../components/sw-second-factor';
import { ApiError, describeError } from '../api/client';
import {
  audienceOptions, boardControl, boardLink, createBoard, deleteBoard, getBoard, listBoards, listNotices, noticesSettings, patchBoard, patchNoticesSettings, putBoardItems, putTvDefaults,
  getBoardLink, rotateBoardToken, type Board, type NewsSource, type Notice, type SettingsResponse,
} from '../api/notices';
import { effectiveTv, effectiveTv2, tv2DefaultsOf, tvDefaultsOf, type Display, type Tv2Defaults, type TvDefaults } from '../notice-tv/tv-logic';
import { nt } from '../i18n/notices';
import { SEV_KEY, SEV_LOOK, agoText, boardDraft, draftOf, newDraft, placePresets, retentionOptions, seenState, slugOk, suggestSlug, windowText, type Draft } from '../notices/model';
import '../notices/compose-dialog';
import '../notices/display-saver';
import '../notices/display-layout';
import '../notices/display-design';
import '../notices/display-fit'; // TV-SETTINGS-2380: portrait chips + safe margin
import { tvFitDefaultsOf, type TvFitDefaults } from '../notices/display-fit-model';
import '../notices/display-info';
import '../notices/info-sources'; // TV-CHIPS-2381
import '../notices/display-slides';
import '../notices/display-transit';
import '../notices/news-sources';
import { feedView, shortName } from '../notices/news-model';
import type { NoticeSavedDetail } from '../notices/compose-dialog';
import type { InfoSourcesPatch } from '../notices/info-chips-model'; // BOARD-ANSWERS-2400
import { noticesCss } from '../notices/styles';
import { NOTICES_HREF, NOTICES_SETTINGS_HREF, applyNoticesHidden } from '../shell/nav';
import '../notices/display-home';
import { liftRef, liftedReset } from '../components/top-layer';
import { dateInputLang } from '../api/day-format';
import { activateKeydown } from '../components/a11y-keys'; // CR-A11Y-ROWS-2443 (D14): Enter / Space on a clickable row or card

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
    liftedReset,
    settingsLadderStyles,
    noticesCss,
    css`
      /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (one field look for the whole
         form); the short fields (days, connections, the night hours, the dim level, the forecast hours, the feed and notice pickers) keep
         their 90 px */
      sw-field.short { inline-size: 90px; }
      /* CR-CMP2-TABLES-REST-2470 (owner N10): the boards and a board's notices are the shared table inside their panel (no second card,
         never wider than the panel; the module's 10 / 12 px cells) */
      sw-table.t { --sw-table-min: 0; --sw-table-cell-pad: 10px 12px; }
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
      /* NOTICE-NEWS-EMPTY-2500: news on, no source chosen - the module's warning line under the news switch, aligned with its sub rows */
      .alert[data-news-unset] { align-items: center; flex-wrap: wrap; margin-inline-start: 22px; }
      .alert[data-news-unset] > span { flex: 1 1 220px; min-inline-size: 0; }
      .feed .u { color: var(--sw-text-3); font-size: var(--sw-fs-xs); direction: ltr; unicode-bidi: isolate; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 260px; }
      .link { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border); }
      .link code { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; direction: ltr; text-align: start; font-size: var(--sw-fs-xs); color: var(--sw-text); }
      .qr { background: var(--sw-surface-solid); padding: 6px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); line-height: 0; }
      .alert { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
      .ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block-start: 8px; }
      .stack { display: grid; gap: 14px; }
      @media (max-width: 1023px) { .disp { grid-template-columns: minmax(0, 1fr); } }
      /* POLISH4-WP8: a template tile gives on pointer-down, shows hover only on a fine pointer and a focus ring on the keyboard; on a phone
         the saved / failed toast clears the bottom bar */
      .tpl { transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color); }
      .tpl:active { transform: scale(var(--sw-press-scale)); }
      .tpl:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
      @media (hover: hover) and (pointer: fine) { .tpl:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); } }
      @media (prefers-reduced-motion: reduce) { .tpl { transition-duration: 0ms; } .tpl:active { transform: none; } }
      @media (max-width: 767px) {
        .toast { inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 16px + env(safe-area-inset-bottom, 0px)); max-inline-size: calc(100% - 32px); }
        .feed .u { max-inline-size: 100%; }
      }
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
  /** MULTI-BUILDING-HOME-2500 (Q68): the buildings a board can belong to (empty = one building, or the multi-building switch off) */
  @state() private bldChoices: { id: string; name: string }[] = [];
  @state() private notices: Notice[] = [];
  @state() private feedPick = '';
  @state() private feedUrl = '';
  @state() private confirmDelete = false;
  /** NOTICE-NEWS-EMPTY-2500: the index of the board's last news source while its removal waits for the confirmation (news on only). */
  @state() private confirmLastFeed: number | null = null;
  /** The board whose link is about to be replaced ("החלף קישור"). BOARD-MGMT-2381: `legacy` = the request came from "העתק קישור" on a board
   * whose link has no stored copy - the dialog says why it cannot be copied; nothing is replaced without this confirmation. */
  @state() private confirmRotate: { board: Board; copy: boolean; legacy?: boolean } | null = null;
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
      const r = await listBoards();
      this.boards = r.boards;
      this.bldChoices = r.buildings ?? []; // MULTI-BUILDING-HOME-2500 (Q68): only on a multi-building site
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
    return html`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push ?? false} .pushDefault=${this.s?.settings.push_default ?? 'by_severity'} .boards=${this.boards} .boardBuildings=${this.bldChoices} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
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
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.lastFeedDialog()} ${this.composeDialog()}
      ${this.toast ? html`<div class="toast" role="status" ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog (2382 train: the notice board's toasts) */}>${this.toast}</div>` : nothing}`;
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
          <sw-toggle controlled .checked=${st.enabled} ?disabled=${!can.configure} label=${st.enabled ? nt('moduleOn') : nt('moduleOff')} data-module-switch
            @change=${(e: CustomEvent<{ checked: boolean }>) => this.patchSettings({ enabled: e.detail.checked })}></sw-toggle></div>
          <dl class="kv"><dt>${nt('kvWrite')}</dt><dd>${nt('kvWriteV')} <span class="mut ltr">(notices.manage)</span></dd><dt>${nt('kvPush')}</dt><dd>${nt('kvPushV')} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${nt('kvBoards')}</dt><dd>${nt('kvBoardsV')} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${can.configure ? this.defaultsCard() : nothing}
      </div>
      ${can.configure ? html`<notice-news-sources .sources=${st.news_sources} @ns-message=${(e: CustomEvent<string>) => this.say(e.detail)}
        @news-sources-change=${(e: CustomEvent<NewsSource[]>) => (this.s = { ...this.s!, settings: { ...this.s!.settings, news_sources: e.detail } })}></notice-news-sources>` : nothing}
      ${st.enabled && can.boards ? html`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${nt('boardsCard')}</h2><span class="chip num">${nt('boardsCount', { n: this.boards.length, m: st.boards_max })}</span><span class="sp"></span>
          ${can.configure ? html`<label class="ck"><sw-toggle controlled size="sm" labelHidden in-label label=${nt('dRemote')} .checked=${st.boards_remote} @change=${(e: Event) => this.patchSettings({ boards_remote: toggled(e) })}></sw-toggle>${nt('dRemote')}</label>` : nothing}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length >= st.boards_max} @click=${() => this.openCreate()}>${nt('newBoard')}</sw-button></div>
        ${this.boards.length ? html`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map((b) => this.boardCard(b))}</div>`
          : html`<sw-state-panel icon="wall" state="empty" heading=${nt('noBoards')} hint=${nt('boardsEmpty')} actionLabel=${nt('firstBoard')} @action=${() => this.openCreate()}></sw-state-panel>`}
      </div>` : nothing}
      ${st.enabled && can.boards ? this.tvDefaultsCard() : nothing}`;
  }

  /** TVOPT-295: the installation defaults of the four TV options (notices.boards, like a board's own screen settings). */
  private tvDefaults(): TvDefaults {
    return tvDefaultsOf(this.s?.settings.tv_defaults);
  }

  private tvDefaultsCard() {
    return html`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${nt('tvDefaultsCard')}</h2></div><div class="form">
      <p class="hint">${nt('tvDefaultsHint')}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${(e: CustomEvent<Partial<Tv2Defaults>>) => void this.saveTvDefaults(e.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${(e: CustomEvent<Partial<TvFitDefaults>>) => void this.saveTvDefaults(e.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${(e: CustomEvent<Partial<TvDefaults>>) => void this.saveTvDefaults(e.detail)}></notice-display-layout>
    </div></div>`;
  }

  /** BOARDV2-297: the installation defaults of the V2 board options (the same card, the same permission). */
  private tv2Defaults(): Tv2Defaults {
    return tv2DefaultsOf(this.s?.settings.tv2_defaults);
  }

  /** TV-SETTINGS-2380: the installation defaults of the two TV-fit options (they travel in `tv2_defaults`). */
  private tvFitDefaults(): TvFitDefaults {
    return tvFitDefaultsOf(this.s?.settings.tv2_defaults);
  }

  private async saveTvDefaults(body: Partial<TvDefaults & Tv2Defaults & TvFitDefaults>): Promise<void> {
    try {
      const r = await putTvDefaults(body);
      if (this.s) this.s = { ...this.s, settings: { ...this.s.settings, tv_defaults: r.tv_defaults, ...(r.tv2_defaults ? { tv2_defaults: r.tv2_defaults } : {}) } };
      this.say(nt('saved'));
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private defaultsCard() {
    const s = this.s!;
    const st = s.settings;
    return html`<div class="panel" data-defaults-card><div class="hd"><h2>${nt('defaultsCard')}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${nt('dDays')}</label><div class="sum"><sw-field class="short"><input id="ns-days" class="num" type="number" min="1" max="90" .value=${String(st.default_days)}
          @change=${(e: Event) => this.patchSettings({ default_days: Number((e.target as HTMLInputElement).value) })}></sw-field><span class="mut">${nt('dDaysUnit')}</span></div></div>
        <div class="fld"><label for="ns-sev">${nt('dSeverity')}</label><sw-field><select id="ns-sev" data-v=${st.default_severity} @change=${(e: Event) => this.patchSettings({ default_severity: (e.target as HTMLSelectElement).value as 'info' | 'alert' })}>
          <option value="info">${nt('sevInfo')}</option><option value="alert">${nt('sevAlert')}</option></select></sw-field></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${nt('dReads')}</label><sw-field><select id="ns-reads" data-v=${st.reads_names ? 'names' : 'counts'} @change=${(e: Event) => this.patchSettings({ reads_names: (e.target as HTMLSelectElement).value === 'names' })}>
          <option value="names">${nt('dReadsNames')}</option><option value="counts">${nt('dReadsCounts')}</option></select></sw-field></div>
        <div class="fld"><label for="ns-ret">${nt('dRetention')}</label><sw-field><select id="ns-ret" data-v=${String(st.retention_days)}
          @change=${(e: Event) => this.patchSettings({ retention_days: Number((e.target as HTMLSelectElement).value) })}>
          ${retentionOptions(st.retention_days).map((o) => html`<option value=${String(o.value)}>${o.label}</option>`)}</select></sw-field></div>
        <notice-home-empty .value=${st.home_empty ?? 'hide'} @home-empty-change=${(e: CustomEvent<'hide' | 'line'>) => this.patchSettings({ home_empty: e.detail })}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${nt('dPush')}</label><sw-field><select id="ns-push" data-v=${st.push_default}
          @change=${(e: Event) => this.patchSettings({ push_default: (e.target as HTMLSelectElement).value as 'by_severity' | 'always' | 'never' })}>
          <option value="by_severity">${nt('dPushSev')}</option><option value="always">${nt('dPushAlways')}</option><option value="never">${nt('dPushNever')}</option></select></sw-field>
          <span class="hint">${nt('dPushHint')}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${nt('dWeather')}</label><sw-field><select id="ns-wx" data-v=${st.weather_entity} @change=${(e: Event) => this.patchSettings({ weather_entity: (e.target as HTMLSelectElement).value })}>
          <option value="">${nt('dWeatherNone')}</option>${s.weather_entities.map((w) => html`<option value=${w.entity_id}>${w.name}</option>`)}</select></sw-field></div>
        <div class="fld"><label for="ns-bn">${nt('dBuilding')}</label><sw-field><input id="ns-bn" maxlength="60" .value=${st.building_name} placeholder=${s.building_fallback}
          @change=${(e: Event) => this.patchSettings({ building_name: (e.target as HTMLInputElement).value })}></sw-field><span class="hint">${nt('dBuildingHint', { name: s.building_fallback || '-' })}</span></div>
      </div>
      <notice-info-sources .parking=${st.parking_entities ?? []} .gym=${st.gym_entities ?? []} .candidates=${s.info_entities ?? {}}
        .inverted=${{ parking: st.parking_inverted ?? [], gym: st.gym_inverted ?? [] }}
        @info-sources-change=${(e: CustomEvent<InfoSourcesPatch>) => this.patchSettings(e.detail)}></notice-info-sources>
      <div class="fld"><label for="ns-origin">${nt('dOrigin')}</label><sw-field><input id="ns-origin" class="ltr" maxlength="220" .value=${st.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${(e: Event) => this.patchSettings({ boards_origin: (e.target as HTMLInputElement).value })}></sw-field><span class="hint">${nt('dOriginHint')}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${nt('dConnTotal')}</label><sw-field class="short"><input id="ns-ctot" class="num" type="number" min="4" max="256" data-conn-total .value=${String(st.conn_total)}
          @change=${(e: Event) => this.patchSettings({ conn_total: Number((e.target as HTMLInputElement).value) })}></sw-field></div>
        <div class="fld"><label for="ns-cadr">${nt('dConnPerAddr')}</label><sw-field class="short"><input id="ns-cadr" class="num" type="number" min="1" max="64" data-conn-per-address .value=${String(st.conn_per_address)}
          @change=${(e: Event) => this.patchSettings({ conn_per_address: Number((e.target as HTMLInputElement).value) })}></sw-field></div>
      </div>
      <label class="ck" data-places-tree-setting><sw-toggle controlled size="sm" labelHidden in-label label=${nt('dPlacesTree')} .checked=${st.show_places_tree !== false} @change=${(e: Event) => this.patchSettings({ show_places_tree: toggled(e) })}></sw-toggle>${nt('dPlacesTree')}</label>
      <label class="ck"><sw-toggle controlled size="sm" labelHidden in-label label=${nt('dCustomFeeds')} .checked=${st.news_custom} @change=${(e: Event) => this.patchSettings({ news_custom: toggled(e) })}></sw-toggle>${nt('dCustomFeeds')}</label>
      <div class="fld"><span class="lbl">${nt('companyLogo')}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${nt('logoWhere')}</a></div>
    </div></div>`;
  }

  // ---------------------------------------------------------------- boards list

  /** CR-CMP2-TABLES-REST-2470: the module badge on the phone cards; inside the shared table the same state in the shared tones (online ok,
   * idle / never warn, off neutral) */
  private seenBadge(b: Board, inTable = false) {
    const st = seenState(b, Date.now());
    const look = st === 'online' ? 'ok' : st === 'off' ? 'off' : 'unk';
    const label = st === 'online' ? nt('bOnline') : st === 'off' ? nt('bDisabled') : st === 'never' ? nt('bNever') : nt('bIdle');
    if (inTable) return html`<span class="chip" data-tone=${look === 'ok' ? 'ok' : look === 'unk' ? 'warn' : nothing}>${label}</span>`;
    return html`<span class="badge" data-look=${look}>${label}</span>`;
  }

  /** NOTICE-NEWS-EMPTY-2500: the board's news block is on and it has no source - the TV shows no news. The server says so (`news_unset`);
   * an older server's answer is read from the display itself. */
  private newsUnset(b: Board): boolean {
    if (typeof b.news_unset === 'boolean') return b.news_unset;
    return !!b.display?.blocks?.news && !b.display.news?.feeds?.length;
  }

  /** The warning chip of such a board: the shared table's warn tone inside the table, the module's warn badge on the phone card and the
   * board line. */
  private newsUnsetChip(b: Board, inTable = false) {
    if (!this.newsUnset(b)) return nothing;
    return inTable
      ? html` <span class="chip" data-tone="warn" data-news-unset-chip title=${nt('newsUnset')}>${nt('newsUnsetChip')}</span>`
      : html`<span class="badge" data-look="warn" data-news-unset-chip title=${nt('newsUnset')}>${nt('newsUnsetChip')}</span>`;
  }

  private summary(b: Board): string {
    const d = b.display;
    if (!d) return '';
    const tpl = nt(d.template === 1 ? 'tpl1' : d.template === 2 ? 'tpl2' : 'tpl3');
    const theme = nt(d.theme === 'day' ? 'themeDay' : d.theme === 'night' ? 'themeNight' : 'orAuto');
    return `${tpl} · ${theme} · ${d.rotate_s} ${nt('seconds')}`;
  }

  /** CR-CMP2-TABLES-REST-2470 (owner N10): the boards on the shared table - the state chip (shared tones), the name over its display line,
   * the address (an LTR isolate), the notices count, last seen, the row's keys. A row opens its board through row-select (a click, or
   * Enter / Space on the row's tab stop; the arrows walk the rows); a key in the row stops its own click. */
  private boardsTable() {
    const cols: TableColumn<Board>[] = [
      { key: 'state', label: nt('bState'), kind: 'status', render: (b) => html`${this.seenBadge(b, true)}${this.newsUnsetChip(b, true)}` },
      { key: 'name', label: nt('bName'), kind: 'truncate', cellTitle: (b) => b.name, render: (b) => html`<span class="t1">${b.name}</span><span class="t2">${this.summary(b)}</span>` },
      { key: 'slug', label: nt('bAddress'), kind: 'muted', render: (b) => html`<bdi dir="ltr">/b/${b.slug}</bdi>` },
      { key: 'items', label: nt('bItems'), kind: 'num', render: (b) => String(b.item_count ?? 0) },
      { key: 'seen', label: nt('bSeen'), kind: 'muted', render: (b) => agoText(b.last_seen_at, Date.now()) },
      { key: 'act', label: '', kind: 'actions', render: (b) => this.rowActions(b) },
    ];
    return html`<sw-table class="t" bare data-boards-table rowKey="slug" .columns=${cols as unknown as TableColumn[]} .rows=${this.boards as unknown as Record<string, unknown>[]}
      .rowAttrs=${(b: Record<string, unknown>) => ({ 'data-board': String(b.slug) })}
      @row-select=${(e: CustomEvent<{ row: Record<string, unknown> }>) => this.goBoard(e.detail.row as unknown as Board)}></sw-table>`;
  }

  /** NOTICEPOLISH-295: a row's actions - "הפעלה" for a disabled board, "העתקת קישור" for a system administrator, "פתיחה". */
  private rowActions(b: Board) {
    const stop = (fn: () => void) => (e: Event) => { e.stopPropagation(); fn(); };
    return html`${!b.enabled ? html`<sw-button size="sm" data-activate @click=${stop(() => void this.activate(b))}>${nt('activate')}</sw-button>` : nothing}
      ${this.canCopyLink() ? html`<sw-button size="sm" data-copy-link @click=${stop(() => void this.copyLink(b))}>${nt('copyLink')}</sw-button>` : nothing}
      <sw-button size="sm" @click=${stop(() => this.goBoard(b))}>${nt('open')}</sw-button>`;
  }

  /** "העתק קישור" is offered to a system administrator (system.configure) who also holds the boards right; nobody else is shown it. */
  private canCopyLink(): boolean {
    const can = this.s?.can;
    return !!(can?.configure && can.boards);
  }

  /** NOTICEPERM-295 + BOARD-MGMT-2381 (owner 03.11, answer 5A): the TV link is permanent - the stored one is read back and copied, the
   * same link every time, and nothing on the board changes (a paired TV stays connected). A board saved before the stored token existed
   * has no copy to read: the replace confirmation opens with the reason, and only its explicit "החלף קישור" replaces the link.
   * BOARD-ANSWERS-2400 (owner 04.11, Q13 = B): the server keeps that copy the next time the board's TV connects, so the reason says so. */
  private async copyLink(b: Board): Promise<void> {
    if (!b.has_stored_link) {
      this.confirmRotate = { board: b, copy: true, legacy: true };
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
    return html`<div class="card" tabindex="0" role="link" data-board-card=${b.slug} @click=${() => this.goBoard(b)} @keydown=${activateKeydown(() => this.goBoard(b))}><div class="row">${this.seenBadge(b)}${this.newsUnsetChip(b)}<span class="ltr mut">/b/${b.slug}</span></div><span class="t1">${b.name}</span><span class="t2">${this.summary(b)}</span></div>`;
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
        <div class="fld"><label for="nb-name">${nt('bName')}</label><sw-field><input id="nb-name" maxlength="60" .value=${c.name} @input=${(e: Event) => (this.creating = { ...c, name: (e.target as HTMLInputElement).value, err: '' })}></sw-field></div>
        <div class="fld"><label for="nb-slug">${nt('bSlug')}</label><sw-field><input id="nb-slug" class="ltr" maxlength="40" .value=${c.slug} @input=${(e: Event) => (this.creating = { ...c, slug: (e.target as HTMLInputElement).value.toLowerCase(), err: '' })}></sw-field><span class="hint">${nt('bSlugHint')}</span></div>
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
      <div class="top"><div><h1>${b.name}</h1><p class="sub"><a href=${NOTICES_SETTINGS_HREF}>${nt('back')}</a> · <span class="ltr">/b/${b.slug}</span> · ${agoText(b.last_seen_at, Date.now())} ${this.newsUnsetChip(b)}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${() => window.open(this.previewSrc(false), '_blank', 'noopener')}>${nt('openTv')}</sw-button>
          ${this.canCopyLink() ? html`<sw-button icon="copy" data-copy-link @click=${() => void this.copyLink(b)}>${nt('copyLink')}</sw-button>` : nothing}
          <sw-button icon="refresh" data-rotate @click=${() => (this.confirmRotate = { board: b, copy: false })}>${nt('newLink')}</sw-button>
          <sw-toggle controlled .checked=${b.enabled} label=${nt('boardEnabled')} @change=${(e: CustomEvent<{ checked: boolean }>) => this.saveBoard({ enabled: e.detail.checked })}></sw-toggle>
        </div></div>
      <sw-tabs .items=${tabs} active=${this.tab} panel="board-panel" @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id as BoardTab)}></sw-tabs>
      <div class="stack" id="board-panel">${this.tab === 'general' ? this.generalTab() : this.tab === 'display' ? this.displayTab() : this.noticesTab()}</div>`;
  }

  private generalTab() {
    const b = this.detail!.board;
    const d = this.draft!;
    return html`<div class="two">
      <div class="panel"><div class="hd"><h2>${nt('tabGeneral')}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty && this.nameDraft === b.name} @click=${() => this.saveAll()}>${nt('save')}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${nt('bName')}</label><sw-field><input id="bg-name" maxlength="60" .value=${this.nameDraft} @input=${(e: Event) => (this.nameDraft = (e.target as HTMLInputElement).value)}></sw-field></div>
            <div class="fld"><label for="bg-slug">${nt('bSlug')}</label><sw-field><input id="bg-slug" class="ltr" .value=${b.slug} disabled></sw-field></div></div>
          ${this.bldChoices.length ? html`<div class="fld" data-board-building><label>${nt('bBuilding')}</label><sw-dropdown block label=${nt('bBuilding')} .items=${[{ id: '', label: nt('bBuildingSite') }, ...this.bldChoices.map((x) => ({ id: x.id, label: x.name }))]} .value=${b.building_id ?? ''} @change=${(e: CustomEvent<{ id: string }>) => this.saveBoard({ building_id: e.detail.id })}></sw-dropdown><p class="hint">${nt('bBuildingHint')}</p></div>` : nothing}
          <div class="r">${this.placeField(d.place)}
            <div class="fld"><label for="bg-lang">${nt('lang')}</label><sw-field><select id="bg-lang" data-v=${d.lang} @change=${(e: Event) => this.setD({ lang: (e.target as HTMLSelectElement).value as 'he' | 'en' })}><option value="he">${'עברית' /* i18n-keep: the Hebrew language's own name */}</option><option value="en">English</option></select></sw-field></div></div>
          <dl class="kv"><dt>${nt('kvTemplate')}</dt><dd>${this.summary(b)}</dd><dt>${nt('bItems')}</dt><dd class="num">${this.detail!.notices.length}</dd>
            <dt>${nt('kvSeen')}</dt><dd>${agoText(b.last_seen_at, Date.now())}</dd><dt>${nt('kvCreated')}</dt><dd class="num">${(b.created_at || '').slice(0, 10)}</dd>
            <dt>${nt('kvRotated')}</dt><dd class="num">${(b.token_rotated_at || '').slice(0, 10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${() => (this.confirmDelete = true)}>${nt('deleteBoard')}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${nt('bAddress')}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(b, '••••••••••••••••••••••••••••••••')}</code></div>
        <p class="hint">${nt('linkOnce')} ${nt('linkHint')}</p>
        ${b.has_stored_link === false ? html`<p class="hint" data-link-pending>${nt('linkPending')}</p>` : nothing}
        <div class="ctl"><sw-button icon="refresh" @click=${() => (this.confirmRotate = { board: b, copy: false })}>${nt('newLink')}</sw-button></div></div>
    </div>`;
  }

  /** NOTICEPOLISH-295: the board's place as a choice of the installation's floors (when they are known), with "אחר..." for free text; the
   * stored value stays the same text field of the display settings, and a value that is not a preset stays editable. */
  private placeField(place: string) {
    const presets = placePresets(this.floors);
    if (!presets.length) {
      return html`<div class="fld"><label for="bg-place">${nt('place')}</label><sw-field><input id="bg-place" maxlength="60" .value=${place} @input=${(e: Event) => this.setD({ place: (e.target as HTMLInputElement).value })}></sw-field></div>`;
    }
    const custom = !!place && !presets.includes(place);
    const pick = this.placeOther || custom ? '__other' : place;
    return html`<div class="fld"><label for="bg-place">${nt('place')}</label>
      <sw-field><select id="bg-place" data-place-select data-v=${pick} @change=${(e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        this.placeOther = v === '__other';
        if (!this.placeOther) this.setD({ place: v });
      }}><option value="">-</option>${presets.map((p) => html`<option value=${p}>${p}</option>`)}<option value="__other">${nt('placeOther')}</option></select></sw-field>
      ${pick === '__other' ? html`<sw-field><input data-place-text maxlength="60" aria-label=${nt('place')} .value=${place} @input=${(e: Event) => this.setD({ place: (e.target as HTMLInputElement).value })}></sw-field>` : nothing}</div>`;
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
          <sw-button size="sm" @click=${() => this.cmd('next')}>${nt('next')}</sw-button><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('sendToTvs')} .checked=${this.sendToTvs} @change=${(e: Event) => (this.sendToTvs = toggled(e))}></sw-toggle>${nt('sendToTvs')}</label>
          <span class="hint">${nt('remoteHint')}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${nt('theme')}</span><sw-segmented label=${nt('theme')} data-theme-seg value=${d.theme} @change=${(e: CustomEvent<SegmentedChange>) => this.setD({ theme: e.detail.value as 'day' | 'night' | 'auto' })}
            .options=${(['day', 'night', 'auto'] as const).map((th) => ({ value: th, label: nt(th === 'day' ? 'themeDay' : th === 'night' ? 'themeNight' : 'themeAuto') }))}></sw-segmented></div>
            <div class="fld"><span class="lbl">${nt('orient')}</span><sw-segmented label=${nt('orient')} value=${d.layout} @change=${(e: CustomEvent<SegmentedChange>) => this.setD({ layout: e.detail.value as 'auto' | 'landscape' | 'portrait' })}
            .options=${(['auto', 'landscape', 'portrait'] as const).map((o) => ({ value: o, label: nt(o === 'auto' ? 'orAuto' : o === 'landscape' ? 'orLand' : 'orPort') }))}></sw-segmented></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${nt('dayHours')}</label><sw-field><input id="bd-dh" class="ltr" placeholder="07:00-19:00" .value=${d.day_hours} @change=${(e: Event) => this.setD({ day_hours: (e.target as HTMLInputElement).value.trim() })}></sw-field><span class="hint">${nt('dayHoursHint')}</span></div>
            <div class="fld"><label for="bd-fs">${nt('fontSize')}</label><sw-field><select id="bd-fs" data-v=${d.font_size} @change=${(e: Event) => this.setD({ font_size: (e.target as HTMLSelectElement).value as Display['font_size'] })}>
              <option value="s">${nt('fsS')}</option><option value="m">${nt('fsM')}</option><option value="l">${nt('fsL')}</option></select></sw-field></div></div>
          <div class="fld"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('nightDim')} .checked=${d.night.enabled} @change=${(e: Event) => this.setD({ night: { ...d.night, enabled: toggled(e) } })}></sw-toggle>${nt('nightDim')}</label>
            ${d.night.enabled ? html`<div class="sum">${nt('nightFrom')}<sw-field class="short"><input class="ltr" type="time" lang=${dateInputLang()} .value=${d.night.from} @change=${(e: Event) => this.setD({ night: { ...d.night, from: (e.target as HTMLInputElement).value } })}></sw-field>
              ${nt('nightTo')}<sw-field class="short"><input class="ltr" type="time" lang=${dateInputLang()} .value=${d.night.to} @change=${(e: Event) => this.setD({ night: { ...d.night, to: (e.target as HTMLInputElement).value } })}></sw-field>
              ${nt('nightLevel')}<sw-field class="short"><select data-v=${String(d.night.dim)} @change=${(e: Event) => this.setD({ night: { ...d.night, dim: Number((e.target as HTMLSelectElement).value) } })}>
                ${[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((v) => html`<option value=${String(v)}>${Math.round(v * 100)}%</option>`)}</select></sw-field></div>` : nothing}</div>
          <div class="chips"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('burnIn')} .checked=${d.burn_in.shift} @change=${(e: Event) => this.setD({ burn_in: { shift: toggled(e) } })}></sw-toggle>${nt('burnIn')}</label>
            <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('companyLogo')} .checked=${d.blocks.company_logo} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, company_logo: toggled(e) } })}></sw-toggle>${nt('companyLogo')}</label>
            <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('smplwiseLogo')} checked disabled></sw-toggle>${nt('smplwiseLogo')}</label></div>
          <notice-display-design .display=${d} .defaults=${this.tv2Defaults()} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-design>
          <notice-display-fit .display=${d} .defaults=${this.tvFitDefaults()} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-fit>
          <notice-display-layout .display=${d} .defaults=${this.tvDefaults()} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-layout>
          <notice-display-saver .display=${effectiveTv(d, this.tvDefaults())} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${nt('whatShown')}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${() => this.saveAll()}>${nt('save')}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('blkClock')} .checked=${d.blocks.clock} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, clock: toggled(e) } })}></sw-toggle>${nt('blkClock')}</label>
            <div class="sub"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('blkHebdate')} .checked=${d.blocks.hebdate} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, hebdate: toggled(e) } })}></sw-toggle>${nt('blkHebdate')}</label>
              <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('blkWelcome')} .checked=${d.blocks.welcome} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, welcome: toggled(e) } })}></sw-toggle>${nt('blkWelcome')}</label></div></div>
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('blkWeather')} .checked=${d.blocks.weather} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, weather: toggled(e) } })}></sw-toggle>${nt('blkWeather')}</label>
            <div class="sub">${s.weather_entity ? html`<span class="ltr mut">${s.weather_entity}</span>` : html`<span class="mut">${nt('blkWeatherNoEntity')}</span>`}
              <span>${nt('hoursAhead')}</span><sw-field class="short"><select data-v=${String(d.weather.hours)} @change=${(e: Event) => this.setD({ weather: { hours: Number((e.target as HTMLSelectElement).value) } })}>${[3, 5, 8].map((h) => html`<option value=${String(h)}>${h}</option>`)}</select></sw-field></div></div>
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${nt('blkNews')} .checked=${d.blocks.news} @change=${(e: Event) => this.setD({ blocks: { ...d.blocks, news: toggled(e) } })}></sw-toggle>${nt('blkNews')}</label>
            ${d.blocks.news && !d.news.feeds.length ? html`<div class="alert" role="status" data-news-unset><sw-icon name="warning" size="14"></sw-icon><span>${nt('newsUnset')}</span>
              ${this.allFeeds().length ? html`<sw-button size="sm" icon="plus" data-news-add-all @click=${() => this.addAllFeeds()}>${nt('newsAddAll')}</sw-button>` : nothing}</div>` : nothing}
            <div class="sub">${d.news.feeds.map((f, i) => { const v = feedView(f, s.news_sources); return html`<div class="feed" data-feed=${f.url}>${v.logo ? html`<img class="flg" alt="" src=${v.logo}>` : html`<sw-icon name="link" size="12"></sw-icon>`}<b>${shortName(v.name)}</b>${v.known ? nothing : html`<span class="chip">${nt('nsCustomTag')}</span>`}
                <sw-button size="sm" variant="ghost" data-feed-remove @click=${() => this.removeFeed(i)}>${nt('remove')}</sw-button></div>`; })}
              <sw-field class="short"><select data-v=${this.feedPick} @change=${(e: Event) => (this.feedPick = (e.target as HTMLSelectElement).value)}><option value="">${nt('feedPick')}</option>
                ${s.news_sources.filter((f) => f.enabled !== false).map((f) => html`<option value=${f.url}>${f.name}${f.custom ? ' · ' + nt('nsCustomTag') : ''}</option>`)}${s.news_custom ? html`<option value="custom">${nt('feedCustom')}</option>` : nothing}</select></sw-field>
              ${this.feedPick === 'custom' ? html`<sw-field><input class="ltr" placeholder="https://" .value=${this.feedUrl} @input=${(e: Event) => (this.feedUrl = (e.target as HTMLInputElement).value)}></sw-field>` : nothing}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick || d.news.feeds.length >= 6} @click=${() => this.addFeed()}>${nt('add')}</sw-button>
              <span>${nt('speed')}</span><sw-segmented label=${nt('speed')} value=${d.news.speed} @change=${(e: CustomEvent<SegmentedChange>) => this.setD({ news: { ...d.news, speed: e.detail.value as 'slow' | 'normal' | 'fast' } })}
                .options=${(['slow', 'normal', 'fast'] as const).map((sp) => ({ value: sp, label: nt(sp === 'slow' ? 'spSlow' : sp === 'normal' ? 'spNormal' : 'spFast') }))}></sw-segmented></div></div>
          <notice-display-info .value=${d.blocks.info} .show=${d.blocks.info_show !== false} .sources=${s.parking_entities ? { parking: s.parking_entities, gym: s.gym_entities ?? [] } : null} @info-show-change=${(e: CustomEvent<boolean>) => this.setD({ blocks: { ...d.blocks, info_show: e.detail } })} @info-change=${(e: CustomEvent<string[]>) => this.setD({ blocks: { ...d.blocks, info: e.detail } })}></notice-display-info>
          <div class="blk"><span class="ck"><b>${nt('blkNotices')}</b></span><span class="hint">${active.length} ${nt('kpiActive')}</span>
            <div class="sub"><span>${nt('mode')}</span><sw-segmented label=${nt('mode')} data-mode-seg value=${d.mode} @change=${(e: CustomEvent<SegmentedChange>) => this.setD({ mode: e.detail.value as 'rotation' | 'all' | 'focus' })}
              .options=${(['rotation', 'all', 'focus'] as const).map((m) => ({ value: m, label: nt(m === 'rotation' ? 'modeRotation' : m === 'all' ? 'modeAll' : 'modeFocus'), attrs: { 'data-mode': m } }))}></sw-segmented></div>
            <div class="sub"><span>${nt('rotateEvery')}</span><sw-field class="short"><input class="num" type="number" min="6" max="60" step="1" data-rot .value=${String(d.rotate_s)}
              @change=${(e: Event) => this.setD({ rotate_s: Math.max(6, Math.min(60, Math.round(Number((e.target as HTMLInputElement).value) || 12))) })}></sw-field><span>${nt('seconds')}</span><span class="hint">${nt('rotateHint')}</span></div>
            <div class="sub"><span>${nt('urgent')}</span><sw-field><select data-urg data-v=${d.urgent === 'band' ? 'stage' : d.urgent} @change=${(e: Event) => this.setD({ urgent: (e.target as HTMLSelectElement).value as Display['urgent'] })}>
              <option value="stage">${nt('urgStage')}</option><option value="stay">${nt('urgStay')}</option><option value="full">${nt('urgFull')}</option></select></sw-field></div>
            <div class="sub"><span>${nt('hold')}</span><sw-field><select data-hold data-v=${d.hold} @change=${(e: Event) => this.setD({ hold: (e.target as HTMLSelectElement).value })}>
              <option value="">${nt('holdNone')}</option>${active.map((n) => html`<option value=${n.id}>${n.title}</option>`)}</select></sw-field><span class="hint">${nt('holdHint')}</span></div>
            <p class="hint">${nt('dwellNote')}</p></div>
          <notice-display-transit .display=${d} .v2Layout=${((e2) => (e2.design === 'v2' ? e2.board_layout : null))(effectiveTv2(d, this.tv2Defaults()))} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)}></notice-display-transit>
          <notice-display-slides .display=${d} .lux=${['gallery', 'concierge', 'stone'].includes(effectiveTv2(d, this.tv2Defaults()).design)} .boardId=${this.detail!.board.id} .boards=${this.boards} @display-change=${(e: CustomEvent<Partial<Display>>) => this.setD(e.detail)} @slides-changed=${() => this.pushPreview()}></notice-display-slides>
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

  /** NOTICE-NEWS-EMPTY-2500: the enabled sources of the installation's list as board feeds (a board-stored raw URL the list has not adopted -
   * `custom` - is left out: it is not a list source and the server refuses it while custom feeds are off). */
  private allFeeds(): { id: string; name: string; url: string }[] {
    return (this.s?.settings.news_sources ?? []).filter((f) => f.enabled !== false && !f.custom).map((f) => ({ id: f.id, name: f.name, url: f.url }));
  }

  /** "הוספת כל המקורות": the list's enabled sources the board does not have yet, in the list's order, up to the board's 6 (as addFeed). */
  private addAllFeeds(): void {
    const d = this.draft;
    if (!d) return;
    const have = new Set(d.news.feeds.map((f) => f.url));
    const feeds = [...d.news.feeds, ...this.allFeeds().filter((f) => !have.has(f.url))].slice(0, 6);
    if (feeds.length === d.news.feeds.length) return;
    this.setD({ news: { ...d.news, feeds }, blocks: { ...d.blocks, news: true } });
  }

  /** A source's "הסרה". The board's LAST source while news is on asks first: without a source the TV shows no news at all. */
  private removeFeed(i: number): void {
    const d = this.draft;
    if (!d) return;
    if (d.blocks.news && d.news.feeds.length === 1 && this.confirmLastFeed === null) {
      this.confirmLastFeed = i;
      return;
    }
    this.setD({ news: { ...d.news, feeds: d.news.feeds.filter((_x, k) => k !== i) } });
  }

  private lastFeedDialog() {
    const i = this.confirmLastFeed;
    return html`<sw-dialog ?open=${i !== null} heading=${nt('newsLastQ')} @close=${() => (this.confirmLastFeed = null)} data-news-last-confirm>
      <p>${nt('newsLastBody')}</p>
      <sw-button slot="footer" data-news-last-cancel @click=${() => (this.confirmLastFeed = null)}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="danger" data-news-last-go @click=${() => {
        const k = this.confirmLastFeed;
        if (k !== null) this.removeFeed(k);
        this.confirmLastFeed = null;
      }}>${nt('remove')}</sw-button></sw-dialog>`;
  }

  private noticesTab() {
    const d = this.detail!;
    const onBoard = new Set(d.notices.map((n) => n.id));
    const candidates = this.notices.filter((n) => !onBoard.has(n.id) && (n.state === 'active' || n.state === 'scheduled' || n.state === 'draft'));
    const manage = !!this.s?.can.manage;
    const editable = (id: string) => manage && this.notices.some((x) => x.id === id && x.state !== 'archived' && x.state !== 'expired');
    // CR-CMP2-TABLES-REST-2470 (owner N10): the board's notices on the shared table - severity (+ pinned) as a shared tone chip (info /
    // warn / bad; a notice that is not active is neutral), the title, the time window, edit / remove at the reading end
    const tone = (n: Notice) => (n.state !== 'active' ? undefined : n.severity === 'critical' ? 'bad' : n.severity === 'alert' ? 'warn' : 'info');
    const noticeCols: TableColumn<Notice>[] = [
      { key: 'sev', label: nt('colState'), kind: 'status', render: (n) => html`<span class="chip" data-tone=${tone(n) ?? nothing}>${nt(SEV_KEY[n.severity])}${n.pinned ? ' · ' + nt('pinned') : ''}</span>` },
      { key: 'title', label: nt('colNotice'), kind: 'truncate', cellTitle: (n) => n.title, render: (n) => html`<span class="t1">${n.title}</span>` },
      { key: 'window', label: nt('colWindow'), kind: 'muted', render: (n) => windowText(n) },
      { key: 'act', label: '', kind: 'actions', render: (n) => html`${editable(n.id) ? html`<sw-button size="sm" data-edit-notice @click=${() => this.editNotice(n.id)}>${nt('edit')}</sw-button>` : nothing}
          <sw-button size="sm" @click=${() => this.removeItem(n.id)}>${nt('removeFromBoard')}</sw-button>` },
    ];
    // NOTICEADD-295: the mockup's "הודעה חדשה ללוח" (2.16.0 offered only the picker of existing notices, and drew nothing without one)
    return html`<div class="panel flush">
      <div class="toolbar"><h2>${nt('boardNotices')}</h2><span class="chip num">${d.notices.filter((n) => n.state === 'active').length} ${nt('kpiActive')}</span><span class="sp"></span>
        ${candidates.length ? html`<sw-field class="short"><select data-add-notice @change=${(e: Event) => this.addItem((e.target as HTMLSelectElement).value)}><option value="">${nt('addToBoard')}…</option>
          ${candidates.map((n) => html`<option value=${n.id}>${n.title}</option>`)}</select></sw-field>` : nothing}
        ${manage ? html`<sw-button variant="primary" icon="plus" data-board-compose @click=${() => this.newNotice(d.board.id)}>${nt('newForBoard')}</sw-button>` : nothing}</div>
      ${d.notices.length ? html`<sw-table class="t" bare static-rows data-board-notices .columns=${noticeCols as unknown as TableColumn[]} .rows=${d.notices as unknown as Record<string, unknown>[]}
          .rowAttrs=${(n: Record<string, unknown>) => ({ 'data-board-notice': String(n.id), 'data-look': n.state === 'active' ? SEV_LOOK[n.severity as Notice['severity']] : 'off' })}></sw-table>`
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

  /** "החלף קישור": the confirmation before a link is replaced (TVs on the current link disconnect at once). The rotation is audited by the
   * server (`notices.board.rotate`). */
  private rotateDialog() {
    const c = this.confirmRotate;
    return html`<sw-dialog ?open=${!!c} heading=${c ? nt('copyAsk', { name: c.board.name }) : ''} @close=${() => (this.confirmRotate = null)} data-rotate-confirm>
      ${c?.legacy ? html`<p data-no-stored-link>${nt('noStoredLink')}</p>` : nothing}
      <p>${nt('copyAskBody')}</p>
      <sw-button slot="footer" @click=${() => (this.confirmRotate = null)}>${nt('cancel')}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${() => { const x = this.confirmRotate; this.confirmRotate = null; if (x) void this.rotate(x.board, x.copy); }}>${nt('copyAsk2')}</sw-button></sw-dialog>`;
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
