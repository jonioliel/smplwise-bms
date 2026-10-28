import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { canNav, isApi, onSession } from '../api/session';
import { onRouteChange, parseRoute, type RouteState } from '../router';
import { activeEntry, searchSettings, visibleGroups, type SettingsEntry, type SettingsGroup } from './system-index';
import { SkinController } from '../design/skin';
import { getReadinessChip, levelTone, onReadinessChip } from '../api/readiness';

/**
 * SET-polish (2026-10-10): the settings' own navigation. On a wide screen a column at the start side of every הגדרות page: a
 * search field, then the destinations grouped (מראה ותצוגה · משתמשים ואבטחה · התראות ואוטומציה · מדיה · מערכת ותשתית), the
 * sub-pages indented under their screen, the current one marked. On a phone (`compact`) only the search field, above the page;
 * its results drop down in place. Typing filters the index (system-index.ts): every word must match the label, the keywords or
 * the parent; ArrowUp / ArrowDown walk the results, Enter opens, Escape clears. The links are plain anchors to the same hash
 * routes the tab row uses - the index adds no screen and grants nothing.
 */
@customElement('system-nav')
export class SystemNav extends LitElement {
  readonly skin = new SkinController(this);
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private groups: SettingsGroup[] = [];
  @state() private route: RouteState | null = null;
  @state() private q = '';
  @state() private cursor = -1;
  /** Owner decision 402 (2.16.0): one group open at a time so the column fits the screen. null = the group of the page the user is on; '' = all closed. */
  @state() private opened: string | null = null;
  private offRoute: (() => void) | null = null;
  private offSession: (() => void) | null = null;
  private offChip: (() => void) | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      inline-size: 236px;
      flex: none;
      box-sizing: border-box;
      position: sticky;
      inset-block-start: 0;
      align-self: flex-start;
      max-block-size: 100dvh;
      overflow: auto;
      scrollbar-width: thin;
      padding: 16px 0 24px var(--sw-page-pad);
      /* LOGOFIX-295: the developer / installer logos at the page's start sit over this column's first rows - it starts below them (0 without logos) */
      padding-block-start: calc(16px + var(--sw-lead-reserve-h, 0px));
      padding-inline-end: 0;
      padding-inline-start: var(--sw-page-pad);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    :host([compact]) {
      position: static;
      inline-size: auto;
      max-block-size: none;
      overflow: visible;
      padding: 10px 12px 0;
      gap: 0;
    }
    .search {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search sw-icon {
      position: absolute;
      inset-inline-start: 10px;
      color: var(--sw-text-3);
      pointer-events: none;
    }
    .search input {
      inline-size: 100%;
      box-sizing: border-box;
      /* the large control height on a desktop; a skin whose desktop targets follow the touch dial (bubble) sets
         --sw-settings-search-h on the shell; touch layouts (below) always get 44 px */
      min-block-size: var(--sw-settings-search-h, var(--sw-ctl-h-lg));
      padding: 0 32px 0 10px;
      padding-inline-start: 32px;
      padding-inline-end: 30px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .search input::placeholder {
      color: var(--sw-text-3);
    }
    .search input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .search .clear {
      position: absolute;
      inset-inline-end: 4px;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border: 0;
      border-radius: var(--sw-r-xs);
      background: transparent;
      color: var(--sw-text-3);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .search .clear:hover {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    .search .clear:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .grp {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    /* R5-SYSTEM-297: a group label is a heading of the column (12.5/700, the heading ink), not a 10 px uppercase smudge */
    .grp > b {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      padding: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.005em;
      color: var(--sw-heading, var(--sw-text));
    }
    .grp > b sw-icon {
      color: var(--sw-text-2);
    }
    /* the group label is the button that opens / closes its entries (the whole column has to fit the screen without a scroll) */
    .grp > b .gh {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      min-block-size: max(28px, var(--sw-settings-row-h, 0px));
      padding: 0 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      text-align: start;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .grp > b .gh:hover {
        background: var(--sw-hover-wash);
      }
    }
    .grp > b .gh:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .grp > b .gh .chev {
      margin-inline-start: auto;
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .grp > b .gh[aria-expanded='true'] .chev {
      transform: rotate(180deg);
    }
    .grp[data-open='true'] > b {
      margin-block-end: 2px;
    }
    /* R5-SYSTEM-297: the entries read at a glance (13.5/500), the current one is a filled field in 600; a press gives (transform only) */
    a {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: max(32px, var(--sw-settings-row-h, 0px));
      padding: 4px 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      text-decoration: none;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
      line-height: 1.3;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    a:active {
      transform: scale(var(--sw-press-scale));
    }
    .grp > b .gh {
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .grp > b .gh:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      a,
      .grp > b .gh {
        transition-duration: 0ms;
      }
    }
    .score-chip {
      margin-inline-start: auto;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.5;
      font-variant-numeric: tabular-nums;
    }
    .score-chip[data-tone='danger'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .score-chip[data-tone='warning'] {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .score-chip[data-tone='success'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    a.sub {
      margin-inline-start: 14px;
      min-block-size: max(28px, var(--sw-settings-row-h, 0px));
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-sm);
      border-inline-start: 2px solid var(--sw-border);
      border-radius: 0 var(--sw-r-sm) var(--sw-r-sm) 0;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      a:hover {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    a[aria-current='page'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 22%, transparent);
    }
    a.sub[aria-current='page'] {
      border-inline-start-color: var(--sw-accent);
    }
    a:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .crumb {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
    }
    /* the results: the same links, flat, with where they live */
    .results {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .results a {
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
    }
    .results a[data-cursor='true'] {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
    }
    .none {
      padding: 8px 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    :host([compact]) .results,
    :host([compact]) .none {
      margin-block-start: 6px;
      padding: 6px;
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      box-shadow: var(--sw-shadow-2);
    }
    :host([compact]) nav {
      display: none;
    }
    /* Owner decision 402: on a short desktop screen the open group is drawn denser so the whole column fits without a scroll (the ‘system’
       group is the longest, 17 entries); the overflow:auto on :host stays only as the last resort below about 700 px of height */
    @media (min-width: 1101px) and (max-height: 960px) {
      :host {
        gap: var(--sw-s-2);
        padding-block: 10px 10px;
        padding-block-start: calc(10px + var(--sw-lead-reserve-h, 0px)); /* LOGOFIX-295 */
      }
      nav {
        gap: var(--sw-s-2);
      }
      a {
        min-block-size: max(28px, var(--sw-settings-row-h, 0px));
        padding-block: 2px;
      }
      a.sub {
        min-block-size: max(26px, var(--sw-settings-row-h, 0px));
      }
      .grp > b .gh {
        min-block-size: max(26px, var(--sw-settings-row-h, 0px));
      }
    }
    @media (min-width: 1101px) and (max-height: 800px) {
      :host {
        gap: 6px;
        padding-block: 6px 6px;
        padding-block-start: calc(6px + var(--sw-lead-reserve-h, 0px)); /* LOGOFIX-295 */
      }
      nav {
        gap: 4px;
      }
      a {
        min-block-size: max(24px, var(--sw-settings-row-h, 0px));
        padding-block: 0;
        font-size: var(--sw-fs-xs);
      }
      a.sub {
        min-block-size: max(22px, var(--sw-settings-row-h, 0px));
      }
      .grp > b .gh {
        min-block-size: max(24px, var(--sw-settings-row-h, 0px));
      }
      .search input {
        min-block-size: max(32px, var(--sw-settings-row-h, 0px));
      }
    }
    /* a tablet gets the search row too (the shell stacks the column above the page up to 1100 px, the reference tablet width included) */
    @media (max-width: 1100px) {
      :host {
        position: static;
        inline-size: auto;
        max-block-size: none;
        overflow: visible;
        padding: 12px var(--sw-page-pad) 0;
        /* LOGOFIX-295: stacked above the page, the search row is the page's first row: it keeps the logos' width free at its start */
        padding-inline-start: calc(var(--sw-page-pad) + var(--sw-lead-reserve, 0px));
        gap: 0;
      }
      :host([compact]) {
        padding: 10px 12px 0;
      }
      nav {
        display: none;
      }
      .results,
      .none {
        margin-block-start: 6px;
        padding: 6px;
        border: 1px solid var(--sw-menu-border);
        border-radius: var(--sw-r-md);
        background: var(--sw-menu-surface);
        box-shadow: var(--sw-shadow-2);
      }
      .search {
        max-inline-size: 420px;
        margin-inline-start: auto;
      }
      :host([compact]) .search {
        max-inline-size: none;
      }
      /* the search row is a touch target on a phone and a tablet (the layout guard's 44 px) */
      .search input {
        min-block-size: 44px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
    this.offRoute = onRouteChange((r) => {
      this.route = r;
      this.opened = null; // a new page: the column follows it
    });
    this.offSession = onSession(() => this.refresh());
    this.offChip = onReadinessChip(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.offRoute?.();
    this.offSession?.();
    this.offChip?.();
  }

  private refresh() {
    this.groups = visibleGroups(isApi(), canNav);
    this.route = parseRoute();
  }

  private results() {
    return searchSettings(this.groups, this.q);
  }

  private onKey(e: KeyboardEvent) {
    const res = this.results();
    if (e.key === 'Escape') {
      this.q = '';
      this.cursor = -1;
      return;
    }
    if (!res.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      this.cursor = (this.cursor + d + res.length) % res.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = res[this.cursor < 0 ? 0 : this.cursor];
      if (pick) this.open(pick.entry);
    }
  }

  private open(entry: SettingsEntry) {
    this.q = '';
    this.cursor = -1;
    window.location.hash = entry.href;
  }

  private link(entry: SettingsEntry, active: SettingsEntry | null, cursor = false, where = '') {
    const on = !!active && active.href === entry.href;
    const chip = entry.href === '#/system/readiness' ? getReadinessChip() : null; // CR-READY96: the last recorded score, toned by its level
    return html`<a href=${entry.href} class=${entry.sub && !where ? 'sub' : ''} aria-current=${on ? 'page' : 'false'} data-settings-link=${entry.href} data-cursor=${cursor ? 'true' : 'false'} @click=${() => { this.q = ''; this.cursor = -1; }}>${entry.label}${where ? html`<span class="crumb">${where}</span>` : nothing}${chip ? html`<span class="score-chip" data-tone=${levelTone(chip.level)} data-readiness-chip dir="ltr">${chip.score}</span>` : nothing}</a>`;
  }

  render() {
    const active = activeEntry(this.groups, this.route);
    const res = this.q.trim() ? this.results() : null;
    return html`<div class="search" role="search">
        <sw-icon name="search" size=${15}></sw-icon>
        <input type="search" placeholder="חיפוש בהגדרות" aria-label="חיפוש בהגדרות" autocomplete="off" data-settings-search .value=${this.q} @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; this.cursor = -1; }} @keydown=${(e: KeyboardEvent) => this.onKey(e)} />
        ${this.q ? html`<button type="button" class="clear" aria-label="נקה חיפוש" @click=${() => { this.q = ''; this.cursor = -1; }}><sw-icon name="close" size=${13}></sw-icon></button>` : nothing}
      </div>
      ${res
        ? res.length
          ? html`<div class="results" role="list" aria-label="תוצאות" data-settings-results>${res.map(({ group, entry }, i) => this.link(entry, active, i === this.cursor, this.where(group, entry)))}</div>`
          : html`<div class="none" data-settings-no-results>לא נמצא דבר ב"${this.q}"</div>`
        : html`<nav aria-label="הגדרות" data-settings-nav>${this.groups.map((g) => {
            const open = this.isOpen(g, active);
            return html`<div class="grp" data-settings-group=${g.id} data-open=${open ? 'true' : 'false'}><b><button type="button" class="gh" aria-expanded=${open ? 'true' : 'false'} data-settings-group-toggle=${g.id} @click=${() => this.toggle(g, active)}><sw-icon name=${g.icon} size=${13}></sw-icon>${g.label}<sw-icon class="chev" name="chevronDown" size=${12}></sw-icon></button></b>${open ? this.tree(g, active).map((e) => this.link(e, active)) : nothing}</div>`;
          })}</nav>`}`;
  }

  private groupOf(active: SettingsEntry | null): SettingsGroup | undefined {
    return active ? this.groups.find((g) => g.entries.includes(active)) : undefined;
  }

  private isOpen(group: SettingsGroup, active: SettingsEntry | null): boolean {
    return this.opened === null ? this.groupOf(active)?.id === group.id : this.opened === group.id;
  }

  private toggle(group: SettingsGroup, active: SettingsEntry | null) {
    this.opened = this.isOpen(group, active) ? '' : group.id;
  }

  /** A group's entries with the sub-pages folded away except under the screen the user is on (the column stays one glance long). */
  private tree(group: SettingsGroup, active: SettingsEntry | null): SettingsEntry[] {
    const out: SettingsEntry[] = [];
    let open = false;
    for (const e of group.entries) {
      if (!e.sub) {
        open = !!active && (active === e || (!!active.sub && this.parentOf(group, active) === e));
        out.push(e);
      } else if (open) out.push(e);
    }
    return out;
  }

  private parentOf(group: SettingsGroup, entry: SettingsEntry): SettingsEntry | null {
    const i = group.entries.indexOf(entry);
    return i < 0 ? null : group.entries.slice(0, i).reverse().find((e) => !e.sub) ?? null;
  }

  /** Where a result lives: "<group> › <parent>" for a sub-page, the group alone for a screen. */
  private where(group: SettingsGroup, entry: SettingsEntry): string {
    if (!entry.sub) return group.label;
    const parent = this.parentOf(group, entry);
    return parent ? `${group.label} ‹ ${parent.label}` : group.label;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-nav': SystemNav;
  }
}
