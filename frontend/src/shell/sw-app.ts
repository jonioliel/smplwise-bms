import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-icon';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-tabs';
import '../components/sw-avatar';
import '../screens/explore-floor-map';
import '../screens/explore-sites';
import '../screens/explore-floors';
import '../screens/explore-plan-import';
import '../screens/explore-plan-editor';
import '../screens/explore-entities';
import '../screens/explore-access';
import '../screens/live-overview';
import '../screens/live-wall';
import '../screens/live-camera';
import '../screens/live-views';
import '../screens/kiosk-wall';
import '../screens/investigate-playback';
import '../screens/investigate-sync';
import '../screens/investigate-history-map';
import '../screens/investigate-events';
import '../screens/investigate-event-detail';
import '../screens/investigate-reviews';
import '../screens/investigate-cases';
import '../screens/investigate-exports';
import '../screens/investigate-search';
import '../screens/investigate-rules';
import '../screens/system-access';
import '../screens/system-audit';
import '../screens/system-setup';
import '../screens/system-devices';
import '../screens/system-diagnostics';
import '../screens/system-storage';
import '../screens/screens-index';
import '../screens/styleguide-screen';
import { onRouteChange, type RouteState } from '../router';
import { KIND_ICON, KIND_LABEL, search as apiSearch, type SearchResult } from '../api/search';
import { NAV, GROUP_TABS, groupOf, activeTabOf, NAV_A, AREA_TABS, areaOf, activeAreaTab, crumbsOf } from './nav';
import { onDesign, resolveDesign, type DesignId } from '../api/design';
import { t } from '../i18n/he';
import { isApi, loadSession, onSession, type Session } from '../api/session';
import '../components/sw-state-panel';

/**
 * Application shell in the boards' language: a compact white side nav (brand mark, six flat entries,
 * active entry as a soft-blue pill), a white top bar with a small search field, alerts and the HA
 * identity avatar, and the section's pages as a quiet pill-tab row above the content. Phones use a
 * bottom bar; narrow tablets collapse the side nav to icons.
 */
@customElement('sw-app')
export class SwApp extends LitElement {
  @state() private route: RouteState | null = null;
  @state() private session: Session = { mode: 'loading', me: null, error: null };
  @state() private design: DesignId = 'b';
  @state() private searchQ = '';
  @state() private searchResults: SearchResult[] = [];
  @state() private searchOpen = false;
  @state() private searchIndex = -1;
  @state() private searchBusy = false;
  private searchTimer = 0;
  private searchSeq = 0;
  private stopRouter?: () => void;
  private stopSession?: () => void;
  private stopDesign?: () => void;

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sw-rail-w-wide) minmax(0, 1fr);
      grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr);
      grid-template-areas:
        'rail topbar'
        'rail main';
      block-size: 100dvh;
      background: var(--sw-bg);
    }
    :host([data-kiosk]) {
      display: block;
    }
    nav.rail {
      grid-area: rail;
      display: flex;
      flex-direction: column;
      background: var(--sw-surface);
      border-inline-end: 1px solid var(--sw-border);
      padding: 10px 10px 8px;
      gap: 2px;
      overflow: auto;
      scrollbar-width: none;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px 14px;
      min-block-size: 44px;
    }
    .brand img {
      block-size: 26px;
      inline-size: auto;
    }
    .brand .name {
      font-weight: var(--sw-fw-bold);
      font-size: 13px;
      color: var(--sw-text);
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    a.item {
      display: flex;
      align-items: center;
      gap: 9px;
      min-block-size: 32px;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--sw-text-2);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    a.item sw-icon {
      color: var(--sw-text-3);
    }
    a.item:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    a.item.active {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    a.item.active sw-icon {
      color: var(--sw-accent);
    }
    .rail .grow {
      flex: 1;
    }
    a.item.small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-block-size: 26px;
      font-weight: var(--sw-fw-regular);
    }
    header.topbar {
      grid-area: topbar;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      background: var(--sw-surface);
      border-block-end: 1px solid var(--sw-border);
      z-index: var(--sw-z-topbar);
    }
    .search {
      inline-size: 280px;
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 30px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
      background: var(--sw-surface);
    }
    .search input {
      flex: 1;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      outline: none;
      min-inline-size: 0;
    }
    .topbar .spacer {
      flex: 1;
    }
    .brand-mobile {
      display: none;
      align-items: center;
    }
    .brand-mobile img {
      block-size: 24px;
      inline-size: auto;
    }
    .bell {
      position: relative;
    }
    .bell::after {
      content: '';
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 5px;
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
      border: 1.5px solid var(--sw-surface);
    }
    main {
      grid-area: main;
      min-block-size: 0;
      min-inline-size: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }
    .subnav {
      padding: 12px 24px 0;
      display: flex;
    }
    .subnav:empty {
      display: none;
    }
    main > .screen {
      flex: 1;
      min-block-size: 0;
      display: flex;
      flex-direction: column;
    }
    main > .screen > * {
      flex: 1;
      min-block-size: 0;
    }
    nav.bottom {
      display: none;
    }
    .gate {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .who b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    @media (max-width: 1023px) {
      :host {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      .brand .name,
      a.item span {
        display: none;
      }
      a.item {
        justify-content: center;
        padding: 0;
      }
      .brand {
        justify-content: center;
        padding-inline: 0;
      }
      .subnav {
        padding: 10px 16px 0;
        overflow-x: auto;
        scrollbar-width: none;
      }
    }
    @media (max-width: 767px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      nav.rail {
        display: none;
      }
      header.topbar {
        padding: 0 12px;
      }
      .subnav {
        padding: 8px 12px 0;
      }
      nav.bottom {
        grid-area: bottom;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        padding-block-end: env(safe-area-inset-bottom);
      }
      nav.bottom a {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 10px;
        color: var(--sw-text-3);
        text-decoration: none;
        min-block-size: var(--sw-bottomnav-h);
        font-weight: var(--sw-fw-medium);
      }
      nav.bottom a.active {
        color: var(--sw-accent-text);
      }
      .brand-mobile {
        display: inline-flex;
      }
      .search {
        display: none;
      }
    }

    /* ---- design SW A: four-area icon rail on the right, 72px top bar with crumbs, wide search, user chip ---- */
    :host([data-design='a']) nav.rail {
      padding: 14px 8px 12px;
      gap: 6px;
      align-items: center;
    }
    .brand-tile {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 12px;
      background: var(--sw-accent);
      color: #fff;
      font-weight: 800;
      font-size: 22px;
      text-decoration: none;
      margin-block-end: 12px;
      box-shadow: 0 6px 14px rgba(39, 103, 237, 0.25);
    }
    a.item.a {
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      inline-size: 70px;
      min-block-size: 64px;
      padding: 8px 0;
      border-radius: 12px;
      font-size: 11.5px;
      position: relative;
    }
    a.item.a span {
      display: inline;
    }
    a.item.a.active::after {
      content: '';
      position: absolute;
      inset-inline-end: -8px;
      inset-block: 16px;
      inline-size: 3px;
      border-radius: 3px;
      background: var(--sw-accent);
    }
    a.item.a.small {
      min-block-size: 44px;
      font-size: 10.5px;
    }
    .secure {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 10.5px;
      color: var(--sw-text-3);
      padding: 8px 0 4px;
      text-align: center;
      line-height: 1.25;
    }
    :host([data-design='a']) header.topbar {
      padding: 0 26px;
      gap: 14px;
    }
    .crumbs-a {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .crumbs-a .strong {
      color: var(--sw-heading, var(--sw-text));
      font-weight: 700;
    }
    .crumbs-a sw-icon {
      color: var(--sw-text-3);
    }
    .searchwrap {
      position: relative;
      display: inline-flex;
    }
    .results {
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: calc(100% + 6px);
      inline-size: min(560px, 90vw);
      max-block-size: 60vh;
      overflow: auto;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
      z-index: var(--sw-z-drawer);
    }
    .searchwrap.a .results {
      inset-inline-start: 24px;
    }
    .results .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--sw-text);
    }
    .results .row.on,
    .results .row:hover {
      background: var(--sw-accent-soft);
    }
    .results .row sw-icon {
      color: var(--sw-text-3);
      flex: none;
    }
    .results .txt {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      flex: 1;
    }
    .results .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .results .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .results .kind {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      flex: none;
    }
    .results .empty {
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .search.a {
      inline-size: min(520px, 38vw);
      block-size: 46px;
      border-radius: 12px;
      margin-inline-start: 24px;
      padding: 0 14px;
    }
    .search.a input {
      font-size: 14px;
    }
    .search.a kbd {
      font: inherit;
      font-size: 11px;
      color: var(--sw-text-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      padding: 1px 6px;
      background: var(--sw-surface);
      direction: ltr;
    }
    .status-a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: #15803d;
      white-space: nowrap;
    }
    .status-a i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .user-a {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .who-a {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      font-size: 12px;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .who-a b {
      color: var(--sw-heading, var(--sw-text));
      font-size: 13px;
    }
    .logo-a {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      direction: ltr;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--sw-heading, var(--sw-text));
      margin-inline-start: 10px;
    }
    .logo-a b {
      font-size: 24px;
      letter-spacing: -0.5px;
      font-weight: 700;
    }
    .logo-a small {
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--sw-text-3);
    }
    :host([data-design='a']) .subnav {
      padding: 14px 30px 0;
    }
    :host([data-design='a']) nav.bottom {
      grid-template-columns: repeat(4, 1fr);
    }
    @media (max-width: 1279px) {
      .crumbs-a {
        display: none;
      }
      .search.a {
        inline-size: 260px;
        margin-inline-start: 0;
      }
      .logo-a {
        display: none;
      }
    }
    @media (max-width: 1023px) {
      :host([data-design='a']) {
        grid-template-columns: var(--sw-rail-w) minmax(0, 1fr);
      }
      :host([data-design='a']) a.item.a span {
        display: inline;
      }
      :host([data-design='a']) .subnav {
        padding: 10px 16px 0;
      }
    }
    @media (max-width: 767px) {
      /* the tablet rule above (rail + content) is more specific than the base phone rule: repeat the
         single-column phone grid for SW A, otherwise the hidden rail keeps an empty column */
      :host([data-design='a']) {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: var(--sw-topbar-h) minmax(0, 1fr) var(--sw-bottomnav-h);
        grid-template-areas:
          'topbar'
          'main'
          'bottom';
      }
      .who-a {
        display: none;
      }
      .status-a {
        display: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stopSession = onSession((s) => {
      this.session = s;
      if (s.mode !== 'loading') void resolveDesign();
    });
    this.stopDesign = onDesign((d) => {
      this.design = d;
      this.setAttribute('data-design', d);
    });
    void loadSession();
    window.addEventListener('keydown', this.onGlobalKey);
    this.stopRouter = onRouteChange((route) => {
      this.route = route;
      this.toggleAttribute('data-kiosk', route.segments[0] === 'kiosk');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopRouter?.();
    this.stopSession?.();
    this.stopDesign?.();
    window.removeEventListener('keydown', this.onGlobalKey);
  }

  // ---- global search (top bar) ----

  private onGlobalKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
      input?.focus();
      input?.select();
      if (this.searchQ.trim() && this.searchResults.length) this.searchOpen = true;
    }
  };

  private onSearchInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.searchQ = q;
    window.clearTimeout(this.searchTimer);
    if (!q.trim()) {
      this.searchResults = [];
      this.searchOpen = false;
      return;
    }
    this.searchTimer = window.setTimeout(() => void this.runSearch(q), 180);
  }

  private async runSearch(q: string) {
    if (!isApi()) {
      this.searchResults = [];
      this.searchOpen = true;
      return;
    }
    const seq = ++this.searchSeq;
    this.searchBusy = true;
    try {
      const r = await apiSearch(q, 6);
      if (seq !== this.searchSeq) return;
      this.searchResults = r.results;
      this.searchIndex = r.results.length ? 0 : -1;
      this.searchOpen = true;
    } catch {
      if (seq === this.searchSeq) {
        this.searchResults = [];
        this.searchOpen = true;
      }
    } finally {
      if (seq === this.searchSeq) this.searchBusy = false;
    }
  }

  private onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.closeSearch();
      (e.target as HTMLInputElement).blur();
      return;
    }
    if (!this.searchOpen || !this.searchResults.length) {
      if (e.key === 'Enter' && this.searchQ.trim()) void this.runSearch(this.searchQ);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.searchIndex = (this.searchIndex - 1 + this.searchResults.length) % this.searchResults.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.searchResults[this.searchIndex] ?? this.searchResults[0];
      if (r) this.openResult(r);
    }
  }

  private openResult(r: SearchResult) {
    this.closeSearch();
    const input = this.renderRoot.querySelector<HTMLInputElement>('.search input');
    if (input) {
      input.value = '';
      input.blur();
    }
    this.searchQ = '';
    this.searchResults = [];
    window.location.hash = `#${r.route}`;
  }

  private closeSearch() {
    this.searchOpen = false;
    this.searchIndex = -1;
  }

  private renderSearch(designA: boolean) {
    const open = this.searchOpen && !!this.searchQ.trim();
    return html`<span class="searchwrap ${designA ? 'a' : ''}">
      <label class="search ${designA ? 'a' : ''}"><sw-icon name="search" size=${designA ? 16 : 14}></sw-icon><input type="search" placeholder=${designA ? 'חיפוש חדרים, מצלמות, קומות וישויות…' : t('app.search')} aria-label=${t('app.search')} autocomplete="off" role="combobox" aria-expanded=${open} aria-controls="search-results" .value=${this.searchQ} @input=${this.onSearchInput} @keydown=${this.onSearchKey} @focus=${() => { if (this.searchResults.length) this.searchOpen = true; }} @blur=${() => setTimeout(() => this.closeSearch(), 150)} />${designA ? html`<kbd>⌘ K</kbd>` : nothing}</label>
      ${open
        ? html`<div class="results" id="search-results" role="listbox" aria-label="תוצאות חיפוש">
            ${!isApi()
              ? html`<div class="empty">החיפוש עובד מול השרת (במצב הדגמה אין נתונים).</div>`
              : this.searchBusy && !this.searchResults.length
                ? html`<div class="empty">מחפש…</div>`
                : this.searchResults.length
                  ? this.searchResults.map((r, i) => html`<div class="row ${i === this.searchIndex ? 'on' : ''}" role="option" aria-selected=${i === this.searchIndex} @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.openResult(r)}><sw-icon .name=${KIND_ICON[r.kind]} size=${16}></sw-icon><span class="txt"><span class="t">${r.title}</span><span class="s">${r.subtitle}</span></span><span class="kind">${KIND_LABEL[r.kind]}</span></div>`)
                  : html`<div class="empty">לא נמצא דבר עבור "${this.searchQ}". חדרים מופיעים רק אם סומנו "הכללה בחיפוש מרחבי"; אירועים מסוננים במרכז האירועים.</div>`}
          </div>`
        : nothing}
    </span>`;
  }

  /** Full-screen gate for identity problems; `null` (not lit's `nothing`, which is truthy) when the app may render. */
  private renderGate() {
    const s = this.session;
    if (s.mode === 'unauthenticated') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="הזדהות דרך Home Assistant נדרשת" hint=${s.error ?? ''}></sw-state-panel></div>`;
    }
    if (s.mode === 'no_access') {
      return html`<div class="gate"><sw-state-panel state="forbidden" heading="אין לך עדיין תפקיד במערכת" hint="המשתמש ${s.me?.user.display_name || s.me?.user.username || ''} מזוהה מ־Home Assistant, אך מנהל ה־VMS טרם שייך לו תפקיד והיקף. פנה למנהל המערכת."></sw-state-panel></div>`;
    }
    return null;
  }

  private renderScreen() {
    const r = this.route;
    if (!r) return nothing;
    const s = r.segments;
    if (s[0] === 'styleguide') return html`<styleguide-screen></styleguide-screen>`;
    if (s[0] === 'screens') return html`<screens-index></screens-index>`;
    if (s[0] === 'kiosk') return html`<kiosk-wall></kiosk-wall>`;
    switch (r.mode) {
      case 'live':
        if (s[1] === 'wall') return html`<live-wall></live-wall>`;
        if (s[1] === 'views') return html`<live-views></live-views>`;
        if (s[1] === 'cameras') return html`<live-camera .cameraId=${s[2] ?? 'cam-1'}></live-camera>`;
        return html`<live-overview></live-overview>`;
      case 'investigate':
        if (s[1] === 'playback' && s[2] === 'sync') return html`<investigate-sync></investigate-sync>`;
        if (s[1] === 'playback') return html`<investigate-playback .cameraId=${r.params.get('camera') ?? ''} .at=${r.params.get('t') ?? ''}></investigate-playback>`;
        if (s[1] === 'floors') return html`<investigate-history-map .floorId=${s[2] ?? 'f0'} .at=${r.params.get('t') ?? ''} .camera=${r.params.get('camera') ?? ''}></investigate-history-map>`;
        if (s[1] === 'events' && s[2]) return html`<investigate-event-detail .eventId=${s[2]}></investigate-event-detail>`;
        if (s[1] === 'events') return html`<investigate-events .cameraId=${r.params.get('camera') ?? ''} .date=${r.params.get('date') ?? ''}></investigate-events>`;
        if (s[1] === 'reviews') return html`<investigate-reviews></investigate-reviews>`;
        if (s[1] === 'cases' && s[2]) return html`<investigate-case-detail .caseId=${s[2]}></investigate-case-detail>`;
        if (s[1] === 'cases') return html`<investigate-cases></investigate-cases>`;
        if (s[1] === 'exports') return html`<investigate-exports></investigate-exports>`;
        if (s[1] === 'search') return html`<investigate-search></investigate-search>`;
        if (s[1] === 'rules' && s[2]) return html`<investigate-rule-editor .ruleId=${s[2]}></investigate-rule-editor>`;
        if (s[1] === 'rules') return html`<investigate-rules></investigate-rules>`;
        return html`<investigate-playback></investigate-playback>`;
      case 'system':
        if (s[1] === 'audit') return html`<system-audit></system-audit>`;
        if (s[1] === 'setup') return html`<system-setup></system-setup>`;
        if (s[1] === 'devices') return html`<system-devices></system-devices>`;
        if (s[1] === 'storage') return html`<system-storage></system-storage>`;
        if (s[1] === 'access') return html`<system-access></system-access>`;
        return html`<system-diagnostics></system-diagnostics>`;
      case 'explore':
      default: {
        if (s[1] === 'sites') return html`<explore-sites></explore-sites>`;
        if (s[1] === 'buildings') return html`<explore-floors .buildingId=${s[2] ?? 'bld-a'}></explore-floors>`;
        if (s[1] === 'entities') return html`<explore-entities></explore-entities>`;
        if (s[1] === 'access') return html`<explore-access></explore-access>`;
        if (s[1] === 'floors' && s[3] === 'import') return html`<explore-plan-import .floorId=${s[2]}></explore-plan-import>`;
        if (s[1] === 'floors' && s[3] === 'edit') return html`<explore-plan-editor .floorId=${s[2]} .presetEntity=${r.params.get('entity') ?? ''}></explore-plan-editor>`;
        const floorId = s[1] === 'floors' && s[2] ? s[2] : 'f0';
        const screenState = (r.params.get('state') ?? 'ready') as 'ready';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState} .focusZone=${r.params.get('zone') ?? ''} .focusCamera=${r.params.get('camera') ?? ''} .focusEntity=${r.params.get('entity') ?? ''}></explore-floor-map>`;
      }
    }
  }

  private renderA() {
    const area = areaOf(this.route);
    const tabs = area ? AREA_TABS[area] : [];
    const editor = this.route?.segments[3] === 'edit' || this.route?.segments[3] === 'import';
    const crumbs = crumbsOf(this.route);
    const me = this.session.me;
    const name = me?.user.display_name || me?.user.username || 'יוני';
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <a class="brand-tile" href="#/live" title="SmplWise"><span>S</span></a>
        ${NAV_A.map(
          (n) => html`<a class=${classMap({ item: true, a: true, active: area === n.id })} href=${n.href} title=${n.label} aria-current=${area === n.id ? 'page' : 'false'}>
            <sw-icon .name=${n.icon} size=${23}></sw-icon><span>${n.label}</span>
          </a>`,
        )}
        <div class="grow"></div>
        <a class=${classMap({ item: true, a: true, small: true, active: this.route?.segments[0] === 'screens' })} href="#/screens" title="כל המסכים"><sw-icon name="list" size=${16}></sw-icon><span>מסכים</span></a>
        <div class="secure"><sw-icon name="shield" size=${18}></sw-icon><span>מקומי ומאובטח</span></div>
      </nav>
      <header class="topbar">
        <div class="crumbs-a">${crumbs.map((c, i) => html`${i ? html`<sw-icon name="chevron" size=${12}></sw-icon>` : nothing}<span class=${i === 0 ? 'strong' : ''}>${c}</span>`)}</div>
        ${this.renderSearch(true)}
        <span class="spacer"></span>
        ${this.session.mode === 'api' || this.session.mode === 'no_access'
          ? html`<span class="status-a"><i></i>מערכת מקומית</span>`
          : this.session.mode === 'demo'
            ? html`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`
            : nothing}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${t('app.notifications')}></sw-button>
        <span class="user-a"><sw-avatar name=${name} size=${34} title=${t('app.account')} aria-label=${t('app.account')}></sw-avatar><span class="who-a"><b>${name}</b><span>${me?.bindings[0]?.role_name ?? (this.session.mode === 'demo' ? 'מנהל VMS' : 'ללא שיוך')}</span></span></span>
        <span class="logo-a"><b>smplwise</b><small>VMS</small></span>
      </header>
      <main>
        ${this.renderGate() || html`
          <div class="subnav">${tabs.length > 1 && !editor ? html`<sw-tabs .items=${tabs} .active=${activeAreaTab(this.route)}></sw-tabs>` : nothing}</div>
          <div class="screen">${this.session.mode === 'loading' ? nothing : this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${NAV_A.map((n) => html`<a class=${classMap({ active: area === n.id })} href=${n.href}><sw-icon .name=${n.icon} size=${20}></sw-icon>${n.label}</a>`)}
      </nav>
    `;
  }

  render() {
    const base = import.meta.env.BASE_URL;
    if (this.route?.segments[0] === 'kiosk') return html`<main style="block-size:100dvh">${this.renderScreen()}</main>`;
    if (this.design === 'a') return this.renderA();
    const group = groupOf(this.route);
    const tabs = group ? GROUP_TABS[group] : [];
    const editor = this.route?.segments[3] === 'edit' || this.route?.segments[3] === 'import';
    return html`
      <nav class="rail" aria-label="ניווט ראשי">
        <div class="brand">
          <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
          <span class="name">SmplWise</span>
        </div>
        ${NAV.map(
          (n) => html`<a class=${classMap({ item: true, active: group === n.id })} href=${n.href} title=${n.label} aria-current=${group === n.id ? 'page' : 'false'}>
            <sw-icon .name=${n.icon} size=${16}></sw-icon><span>${n.label}</span>
          </a>`,
        )}
        <div class="grow"></div>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'screens' })} href="#/screens" title="כל המסכים">
          <sw-icon name="list" size=${14}></sw-icon><span>כל המסכים</span>
        </a>
        <a class=${classMap({ item: true, small: true, active: this.route?.segments[0] === 'styleguide' })} href="#/styleguide" title=${t('nav.styleguide')}>
          <sw-icon name="layers" size=${14}></sw-icon><span>${t('nav.styleguide')}</span>
        </a>
      </nav>
      <header class="topbar">
        <span class="brand-mobile"><img src="${base}brand/smplwise-mark.png" alt="SmplWise" /></span>
        ${this.renderSearch(false)}
        <span class="spacer"></span>
        ${this.session.mode === 'api' || this.session.mode === 'no_access'
          ? html`<span class="who"><b>${this.session.me?.user.display_name || this.session.me?.user.username}</b>${this.session.me?.bindings[0] ? html`<span>· ${this.session.me.bindings[0].role_name}</span>` : nothing}</span>`
          : this.session.mode === 'demo'
            ? html`<sw-badge kind="neutral" label="נתוני הדגמה"></sw-badge>`
            : nothing}
        <sw-button class="bell" variant="ghost" size="sm" iconOnly icon="bell" label=${t('app.notifications')}></sw-button>
        <sw-avatar name=${this.session.me?.user.display_name || this.session.me?.user.username || 'יוני'} size=${28} title=${t('app.account')} aria-label=${t('app.account')}></sw-avatar>
      </header>
      <main>
        ${this.renderGate() || html`
          <div class="subnav">${tabs.length > 1 && !editor ? html`<sw-tabs .items=${tabs} .active=${activeTabOf(this.route)}></sw-tabs>` : nothing}</div>
          <div class="screen">${this.session.mode === 'loading' ? nothing : this.renderScreen()}</div>`}
      </main>
      <nav class="bottom" aria-label="ניווט ראשי">
        ${NAV.slice(0, 4).map((n) => html`<a class=${classMap({ active: group === n.id })} href=${n.href}><sw-icon .name=${n.icon} size=${20}></sw-icon>${n.label}</a>`)}
        <a class=${classMap({ active: group === 'settings' || group === 'playback' })} href="#/system/diagnostics"><sw-icon name="more" size=${20}></sw-icon>עוד</a>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-app': SwApp;
  }
}
