import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { canNav, isApi, onSession } from '../api/session';
import { onRouteChange, parseRoute, type RouteState } from '../router';
import { activeEntry, searchSettings, visibleGroups, type SettingsEntry, type SettingsGroup } from './system-index';
import { SkinController } from '../design/skin';

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
  private offRoute: (() => void) | null = null;
  private offSession: (() => void) | null = null;

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
    .search .clear:hover {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
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
    .grp > b {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 4px;
      padding-inline: 10px;
      font-size: var(--sw-fs-2xs);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--sw-text-3);
    }
    .grp > b sw-icon {
      color: var(--sw-text-3);
    }
    a {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      padding: 4px 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      line-height: 1.3;
    }
    a.sub {
      margin-inline-start: 14px;
      min-block-size: 28px;
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      border-inline-start: 2px solid var(--sw-border);
      border-radius: 0 var(--sw-r-sm) var(--sw-r-sm) 0;
      border-start-start-radius: 0;
      border-end-start-radius: 0;
    }
    a:hover {
      background: var(--sw-hover-wash);
      color: var(--sw-text);
    }
    a[aria-current='page'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
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
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-2);
    }
    :host([compact]) nav {
      display: none;
    }
    /* a tablet gets the search row too (the shell stacks the column above the page up to 1100 px, the reference tablet width included) */
    @media (max-width: 1100px) {
      :host {
        position: static;
        inline-size: auto;
        max-block-size: none;
        overflow: visible;
        padding: 12px var(--sw-page-pad) 0;
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
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-solid);
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
    this.offRoute = onRouteChange((r) => (this.route = r));
    this.offSession = onSession(() => this.refresh());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.offRoute?.();
    this.offSession?.();
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
    return html`<a href=${entry.href} class=${entry.sub && !where ? 'sub' : ''} aria-current=${on ? 'page' : 'false'} data-settings-link=${entry.href} data-cursor=${cursor ? 'true' : 'false'} @click=${() => { this.q = ''; this.cursor = -1; }}>${entry.label}${where ? html`<span class="crumb">${where}</span>` : nothing}</a>`;
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
        : html`<nav aria-label="הגדרות" data-settings-nav>${this.groups.map((g) => html`<div class="grp" data-settings-group=${g.id}><b><sw-icon name=${g.icon} size=${13}></sw-icon>${g.label}</b>${this.tree(g, active).map((e) => this.link(e, active))}</div>`)}</nav>`}`;
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
    return parent ? `${group.label} › ${parent.label}` : group.label;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-nav': SystemNav;
  }
}
