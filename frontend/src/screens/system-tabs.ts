import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import '../components/sw-tabs';
import './system-tabs-mode';
import { getSettings, patchSettings, type TabsConfig, type TabStyle, type TabStyleDefaults } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { can, isApi } from '../api/session';
import { LOCKED_TABS, TAB_SECTIONS, TAB_STYLE_DEFAULTS, applyTabsConfig, normalizeTabStyles, normalizeTabsConfig, type TabSectionDef } from '../shell/nav';

/** The names of the bar styles (הגדרות › לשוניות › סגנון סרגל). */
const STYLE_LABEL: Record<TabStyle, string> = { pill: 'כמוסבה', underline: 'פס תחתון', 'underline-compact': 'פס תחתון קומפקטי' };
/** What each hierarchy level offers as its installation default (the owner's list; a section may still pick any of the three). */
const LEVEL_OPTIONS: Record<1 | 2, TabStyle[]> = { 1: ['pill', 'underline'], 2: ['underline-compact', 'underline', 'pill'] };
const LEVEL_KEY = { 1: 'level1', 2: 'level2' } as const;
const SAMPLE = [{ id: 'a', label: 'ראשון' }, { id: 'b', label: 'שני' }, { id: 'c', label: 'שלישי' }];

/**
 * הגדרות › כללי › לשוניות (owner 2026-09-30, setting `ui.tabs`): one card per navigation section that has tabs - the rail,
 * the security sections and their pages, the map, WisKey, the settings - listing that section's tabs from the registry in
 * shell/nav.ts (TAB_SECTIONS: the single source of ids, labels and default order; nothing is duplicated here). Per tab: a
 * switch to show or hide it, a drag handle (pointer events: mouse, touch, pen) and ▲/▼ buttons (the arrow keys on the handle
 * work too) to reorder. Rules the editor enforces: at least one tab per section stays visible (the last visible switch is
 * disabled) and the way back to this editor (הגדרות › כללי) cannot be hidden. "אפס לברירת המחדל" forgets one section.
 * Saved as ONE installation value through PATCH /settings `ui.tabs` (the whole object replaces the stored one); the shell
 * follows at once. Presentation only - hiding a tab removes no permission and closes no address.
 */
@customElement('system-tabs-config')
export class SystemTabsConfig extends LitElement {
  @state() private saved: TabsConfig = {};
  @state() private draft: TabsConfig = {};
  /** The bar style defaults per hierarchy level (`ui.tabs.styles`), as saved and as edited. */
  @state() private savedStyles: TabStyleDefaults = {};
  @state() private draftStyles: TabStyleDefaults = {};
  @state() private canEdit = false;
  @state() private loaded = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private announce = '';
  @state() private dragging: { section: string; id: string } | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .intro {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 6px;
      min-block-size: 48px;
      padding: 2px 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    li.dragging {
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
      transform: scale(1.01);
      position: relative;
      z-index: 1;
    }
    li.off .name {
      color: var(--sw-text-3);
      text-decoration: line-through;
    }
    .handle,
    .mv {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 8px;
      color: var(--sw-text-3);
      flex: none;
    }
    .handle {
      cursor: grab;
      touch-action: none;
    }
    .handle:active {
      cursor: grabbing;
    }
    .mv {
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .mv:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .mv[aria-disabled='true'] {
      opacity: 0.3;
      cursor: default;
    }
    .handle:focus-visible,
    .mv:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
    }
    .name {
      flex: 1;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .name .lock {
      color: var(--sw-text-3);
      vertical-align: middle;
      margin-inline-start: 6px;
    }
    .srow {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      margin-block-end: 8px;
      font-size: var(--sw-fs-sm);
    }
    .srow .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .srow .ctl {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .srow select {
      min-block-size: 40px;
      max-inline-size: 100%;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    @media (max-width: 767px) {
      .srow {
        flex-direction: column;
        align-items: stretch;
      }
      .srow .ctl {
        align-items: stretch;
      }
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 10px;
    }
    .foot .grow {
      flex: 1;
    }
    button.link {
      all: unset;
      box-sizing: border-box;
      min-block-size: 40px;
      padding: 0 4px;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    button.link:hover {
      text-decoration: underline;
    }
    button.link:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
      border-radius: 4px;
    }
    button.link[disabled] {
      opacity: 0.5;
      cursor: default;
      text-decoration: none;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
    }
    .err {
      color: var(--sw-danger);
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .savebar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    this.stopDrag();
    super.disconnectedCallback();
  }

  private async load() {
    if (!isApi()) {
      this.loaded = true;
      return;
    }
    try {
      const r = await getSettings();
      this.saved = normalizeTabsConfig(r.settings['ui.tabs']);
      this.draft = structuredClone(this.saved);
      this.savedStyles = normalizeTabStyles(r.settings['ui.tabs']);
      this.draftStyles = { ...this.savedStyles };
      this.canEdit = r.can_edit && can('system.configure');
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loaded = true;
    }
  }

  // ---- the model: a section's tabs in the configured order, and what is hidden ----

  /** The registry's ids in the draft's order for this section: the ones the order names first, then the rest by default. */
  private orderedIds(def: TabSectionDef): string[] {
    const reg = def.tabs().map((t) => t.id);
    const named = (this.draft[def.id]?.order ?? []).filter((id, i, a) => reg.includes(id) && a.indexOf(id) === i);
    return [...named, ...reg.filter((id) => !named.includes(id))];
  }

  private hiddenSet(def: TabSectionDef): Set<string> {
    return new Set((this.draft[def.id]?.hidden ?? []).filter((id) => def.tabs().some((t) => t.id === id)));
  }

  private isLocked(def: TabSectionDef, id: string): boolean {
    return (LOCKED_TABS[def.id] ?? []).includes(id);
  }

  /** Write one section's state back into the draft; a section equal to the defaults is dropped, and ids of tabs this
   * browser does not know right now (WisKey's catalog before the panel loaded) keep their stored place. */
  private commit(def: TabSectionDef, ids: string[], hidden: Set<string>) {
    const reg = def.tabs().map((t) => t.id);
    const prev = this.draft[def.id] ?? { order: [], hidden: [] };
    const extraOrder = prev.order.filter((id) => !reg.includes(id));
    const extraHidden = prev.hidden.filter((id) => !reg.includes(id));
    const isDefault = ids.every((id, i) => id === reg[i]);
    const next = { ...this.draft };
    if (isDefault && !hidden.size && !extraOrder.length && !extraHidden.length && !prev.style) delete next[def.id];
    else {
      next[def.id] = { order: isDefault && !extraOrder.length ? [] : [...ids, ...extraOrder], hidden: [...reg.filter((id) => hidden.has(id)), ...extraHidden] };
      if (prev.style) next[def.id].style = prev.style; // the section's own bar style survives an order / visibility edit
    }
    this.draft = next;
    this.message = '';
  }

  /** This section's own bar style (`''` = follow the default of its level). */
  private setSectionStyle(def: TabSectionDef, style: TabStyle | '') {
    const next = { ...this.draft };
    const cur = next[def.id] ?? { order: [], hidden: [] };
    const { style: _old, ...rest } = cur;
    void _old;
    if (style) next[def.id] = { ...rest, style };
    else if (rest.order.length || rest.hidden.length) next[def.id] = rest;
    else delete next[def.id];
    this.draft = next;
    this.message = '';
    this.announce = style ? `${def.label}: סגנון ${STYLE_LABEL[style]}` : `${def.label}: הסגנון לפי ברירת המחדל של הרמה`;
  }

  /** The installation's default style of one hierarchy level; the built-in choice is stored as nothing (easy to flip back). */
  private setLevelStyle(level: 1 | 2, style: TabStyle) {
    const next = { ...this.draftStyles };
    if (style === TAB_STYLE_DEFAULTS[LEVEL_KEY[level]]) delete next[LEVEL_KEY[level]];
    else next[LEVEL_KEY[level]] = style;
    this.draftStyles = next;
    this.message = '';
    this.announce = `רמה ${level}: סגנון ${STYLE_LABEL[style]}`;
  }

  private label(def: TabSectionDef, id: string): string {
    return def.tabs().find((t) => t.id === id)?.label ?? id;
  }

  private move(def: TabSectionDef, id: string, to: number, focus: 'handle' | 'up' | 'down' | null = null) {
    const ids = this.orderedIds(def);
    const from = ids.indexOf(id);
    const target = Math.max(0, Math.min(ids.length - 1, to));
    if (from < 0 || from === target) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(target, 0, id);
    this.commit(def, next, this.hiddenSet(def));
    this.announce = `${this.label(def, id)} הועבר למקום ${target + 1} מתוך ${next.length}`;
    if (focus) {
      void this.updateComplete.then(() => {
        const row = this.renderRoot.querySelector<HTMLElement>(`li[data-sec="${def.id}"][data-tab="${id}"]`);
        const want = row?.querySelector<HTMLElement>(focus === 'handle' ? '.handle' : `.mv[data-move="${focus}"]`);
        (want && want.getAttribute('aria-disabled') !== 'true' ? want : row?.querySelector<HTMLElement>('.handle'))?.focus();
      });
    }
  }

  private setVisible(def: TabSectionDef, id: string, visible: boolean) {
    const hidden = this.hiddenSet(def);
    if (visible) hidden.delete(id);
    else hidden.add(id);
    this.commit(def, this.orderedIds(def), hidden);
    this.announce = `${this.label(def, id)} ${visible ? 'מוצגת' : 'מוסתרת'}`;
  }

  private resetSection(def: TabSectionDef) {
    const next = { ...this.draft };
    delete next[def.id];
    this.draft = next;
    this.message = '';
    this.announce = `${def.label}: ברירת המחדל שוחזרה`;
  }

  private get dirty(): boolean {
    const canon = (c: TabsConfig, s: TabStyleDefaults) => JSON.stringify([Object.keys(c).sort().map((k) => [k, c[k].order, c[k].hidden, c[k].style ?? null]), s.level1 ?? null, s.level2 ?? null]);
    return canon(this.draft, this.draftStyles) !== canon(this.saved, this.savedStyles);
  }

  /** The whole `ui.tabs` value as it is sent: the sections, plus the reserved `styles` key when a level default is set. */
  private payload(): Record<string, unknown> {
    const styles = this.draftStyles;
    return styles.level1 || styles.level2 ? { ...this.draft, styles } : { ...this.draft };
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.tabs': this.payload() });
      invalidateSettings();
      applyTabsConfig(r.settings as unknown as Record<string, unknown>); // the shell follows at once, no reload
      this.saved = normalizeTabsConfig(r.settings['ui.tabs']);
      this.draft = structuredClone(this.saved);
      this.savedStyles = normalizeTabStyles(r.settings['ui.tabs']);
      this.draftStyles = { ...this.savedStyles };
      this.message = 'הלשוניות נשמרו';
      window.setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private discard() {
    this.draft = structuredClone(this.saved);
    this.draftStyles = { ...this.savedStyles };
    this.message = '';
    this.error = '';
  }

  // ---- drag (pointer events: mouse, touch and pen alike) ----
  // window listeners, not pointer capture: the dragged row's DOM node moves while it is dragged (keyed repeat)

  private onPointerDown(e: PointerEvent, def: TabSectionDef, id: string) {
    if (e.button !== 0 || !this.canEdit) return;
    e.preventDefault();
    this.dragging = { section: def.id, id };
    window.addEventListener('pointermove', this.onWindowMove);
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('pointercancel', this.onWindowUp);
  }

  private onWindowMove = (e: PointerEvent) => {
    const d = this.dragging;
    const def = d ? TAB_SECTIONS.find((s) => s.id === d.section) : undefined;
    if (!d || !def) return;
    // the slot whose middle the pointer passed: rows above the pointer's y count, the dragged row itself does not
    let to = 0;
    for (const row of this.renderRoot.querySelectorAll<HTMLElement>(`li[data-sec="${d.section}"]`)) {
      if (row.dataset.tab === d.id) continue;
      const r = row.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) to += 1;
    }
    if (to !== this.orderedIds(def).indexOf(d.id)) this.move(def, d.id, to);
  };

  private onWindowUp = () => {
    this.dragging = null;
    this.stopDrag();
  };

  private stopDrag() {
    window.removeEventListener('pointermove', this.onWindowMove);
    window.removeEventListener('pointerup', this.onWindowUp);
    window.removeEventListener('pointercancel', this.onWindowUp);
  }

  private onHandleKey(e: KeyboardEvent, def: TabSectionDef, id: string) {
    const ids = this.orderedIds(def);
    const i = ids.indexOf(id);
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : null;
    if (to === null || !this.canEdit) return;
    e.preventDefault();
    this.move(def, id, to, 'handle');
  }

  // ---- render ----

  /** "סגנון סרגל" (0.1.148): the installation's default look per hierarchy level - level 1 the first bar of an area (home, the
   * security sections, map, WisKey, settings), level 2 the sub-tabs below it (the pages of לייב / חקירה) - with a preview. */
  private renderStyleDefaults() {
    const level = (lv: 1 | 2, title: string, hint: string) => {
      const current = this.draftStyles[LEVEL_KEY[lv]] ?? TAB_STYLE_DEFAULTS[LEVEL_KEY[lv]];
      return html`<div class="srow" data-style-level=${lv}>
        <span class="lbl">${title}<span class="muted">${hint}</span></span>
        <span class="ctl">
          <select data-style-default=${lv} aria-label=${title} ?disabled=${!this.canEdit} @change=${(e: Event) => this.setLevelStyle(lv, (e.target as HTMLSelectElement).value as TabStyle)}>
            ${LEVEL_OPTIONS[lv].map((s) => html`<option value=${s} ?selected=${s === current}>${STYLE_LABEL[s]}${s === TAB_STYLE_DEFAULTS[LEVEL_KEY[lv]] ? ' (ברירת מחדל)' : ''}</option>`)}
          </select>
          <sw-tabs class="preview" .items=${SAMPLE} active="a" .variant=${current} data-style-preview=${lv}></sw-tabs>
        </span>
      </div>`;
    };
    return html`<sw-card heading="סגנון סרגל" subheading="איך נראים סרגלי הלשוניות; אפשר לקבוע סגנון אחר לכל מקטע בכרטיס שלו" data-tabs-styles>
      ${level(1, 'רמה 1: הסרגל הראשון של האזור', 'המסך הראשי, הבחירה באבטחה, המפה, WisKey וההגדרות')}
      ${level(2, 'רמה 2: תת־לשוניות', 'הדפים של לייב ושל חקירה, ואבטחה בהגדרות')}
    </sw-card>`;
  }

  private renderSection(def: TabSectionDef) {
    const ids = this.orderedIds(def);
    const hidden = this.hiddenSet(def);
    const visibleCount = ids.filter((id) => !hidden.has(id)).length;
    const n = ids.length;
    const configured = !!this.draft[def.id];
    const own = this.draft[def.id]?.style ?? '';
    return html`<sw-card heading=${def.label} subheading=${def.where} data-tabs-section=${def.id}>
      ${def.bar === false
        ? nothing
        : html`<div class="srow" data-style-row=${def.id}>
            <span class="lbl">סגנון סרגל<span class="muted">רמה ${def.level}</span></span>
            <span class="ctl">
              <select data-style-section=${def.id} aria-label=${`סגנון סרגל: ${def.label}`} ?disabled=${!this.canEdit} @change=${(e: Event) => this.setSectionStyle(def, (e.target as HTMLSelectElement).value as TabStyle | '')}>
                <option value="" ?selected=${own === ''}>לפי ברירת המחדל של הרמה</option>
                ${(['pill', 'underline', 'underline-compact'] as TabStyle[]).map((s) => html`<option value=${s} ?selected=${own === s}>${STYLE_LABEL[s]}</option>`)}
              </select>
            </span>
          </div>`}
      <ol aria-label=${`הלשוניות של ${def.label} לפי הסדר`}>
        ${repeat(
          ids,
          (id) => id,
          (id, i) => {
            const label = this.label(def, id);
            const off = hidden.has(id);
            const locked = this.isLocked(def, id);
            // the last visible tab cannot be hidden; a locked one is never hidden
            const cannotHide = locked || (!off && visibleCount <= 1);
            return html`<li data-sec=${def.id} data-tab=${id} class=${`${this.dragging?.id === id && this.dragging.section === def.id ? 'dragging' : ''} ${off ? 'off' : ''}`}>
              <button type="button" class="handle" data-drag=${id} ?disabled=${!this.canEdit} aria-label=${`גרור את ${label}`} aria-roledescription="ידית גרירה"
                @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, def, id)} @keydown=${(e: KeyboardEvent) => this.onHandleKey(e, def, id)}><sw-icon name="grip" size=${20}></sw-icon></button>
              <span class="name">${label}${locked ? html`<sw-icon class="lock" name="lock" size=${13} title="הדרך חזרה לעורך הזה: אי אפשר להסתיר"></sw-icon>` : nothing}</span>
              <button type="button" class="mv" data-move="up" aria-label=${`הזז למעלה: ${label}`} aria-disabled=${!this.canEdit || i === 0 ? 'true' : 'false'} @click=${() => this.canEdit && i > 0 && this.move(def, id, i - 1, 'up')}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
              <button type="button" class="mv" data-move="down" aria-label=${`הזז למטה: ${label}`} aria-disabled=${!this.canEdit || i === n - 1 ? 'true' : 'false'} @click=${() => this.canEdit && i < n - 1 && this.move(def, id, i + 1, 'down')}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
              <sw-toggle data-visible=${id} .checked=${!off} ?disabled=${!this.canEdit || cannotHide} label=${`הצגת ${label}`} labelHidden @change=${(e: CustomEvent<{ checked: boolean }>) => this.setVisible(def, id, e.detail.checked)}></sw-toggle>
            </li>`;
          },
        )}
      </ol>
      ${def.id === 'wiskey' ? html`<div class="muted" style="margin-block-start:8px">רשימת הלשוניות נלקחת מ־WisKey; לשונית שעוד לא נטענה בדפדפן הזה שומרת את ההגדרה שלה.</div>` : nothing}
      <div class="foot">
        <button type="button" class="link" data-tabs-reset=${def.id} ?disabled=${!this.canEdit || !configured} @click=${() => this.resetSection(def)}>אפס לברירת המחדל</button>
      </div>
    </sw-card>`;
  }

  render() {
    if (!this.loaded) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const api = isApi();
    return html`<div class="sections" data-tabs-config>
      <p class="intro">בחרו אילו לשוניות מוצגות בכל אזור ובאיזה סדר. השינוי חל על כל המשתמשים והלשונית הראשונה המוצגת היא זו שהאזור נפתח עליה. הסדר של הניווט הראשי הוא ברירת המחדל: כל משתמש יכול לסדר אותו לעצמו. הסתרת לשונית אינה מבטלת הרשאות והכתובת שלה ממשיכה לעבוד למי שמורשה; בכל אזור נשארת לפחות לשונית אחת.</p>
      <system-tabs-mode></system-tabs-mode>
      ${this.renderStyleDefaults()}
      ${TAB_SECTIONS.map((def) => this.renderSection(def))}
      <div class="savebar">
        <sw-button variant="primary" icon="check" data-tabs-save ?disabled=${!this.canEdit || !this.dirty || this.busy || !api} @click=${() => void this.save()}>שמור</sw-button>
        <sw-button variant="ghost" data-tabs-discard ?disabled=${!this.dirty || this.busy} @click=${() => this.discard()}>בטל שינויים</sw-button>
        ${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
        ${!api ? html`<span class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</span>` : !this.canEdit ? html`<span class="muted">נדרשת הרשאת מנהל מערכת.</span>` : nothing}
      </div>
      <span class="sr" role="status" aria-live="polite" data-tabs-announce>${this.announce}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-tabs-config': SystemTabsConfig;
  }
}
