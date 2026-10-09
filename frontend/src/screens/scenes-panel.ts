import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import '../components/scene-capture';
import { aIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass, autoApi } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import {
  activateScene, createItem, deleteItem, mapAutomationError, replaceItem,
  type AutomationCatalog, type AutomationsStatus, type CatalogEntity, type Item, type ItemDetail, type SceneDraft, type SceneMember,
} from '../api/automations';
import { groupScenes, hiddenScenes, isIntegrationScene, sceneLine } from './automations-logic';
import type { DrawerResult } from './automation-drawer';
import type { SceneCapture } from '../components/scene-capture';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/**
 * CR-017 `<scenes-panel .items .status .now .sceneId>`: the scenes of the installation (CR §4.3, owner decision 7א). The grid is grouped by area with
 * "מועדפות" first; every card activates its scene ("הפעל"; the answer is a short confirmation, never a paragraph), a star keeps it among the favourites,
 * and the scenes the product created ("ניתנת לעריכה") open the capture editor: `<scene-capture>` in a sheet - pick the devices, "צלם מצב נוכחי", correct
 * any value in the table, save. Scenes of a device or hub are "הפעלה בלבד". An administrator can hide a scene of a device (a count shows the hidden ones).
 * `sceneId` is the address's id: `new` = the capture editor of a new scene, an id of an editable scene = its editor. The panel writes through the typed
 * client and reports with events: `result` {text, tone, action?}, `changed`, `open-scene` {id} / `close-scene`.
 */
@customElement('scenes-panel')
export class ScenesPanel extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) items: Item[] = [];
  /** The scenes an administrator hid (not part of the filtered list): shown on demand under "מוסתרות". */
  @property({ attribute: false }) hiddenItems: Item[] = [];
  @property({ attribute: false }) status: AutomationsStatus | null = null;
  @property({ attribute: false }) now: Date = new Date();
  @property() sceneId = '';
  @property({ type: Boolean }) filtered = false;
  @state() private done = new Set<string>();
  @state() private busy = new Set<string>();
  @state() private showHidden = false;
  @state() private detail: ItemDetail | null = null;
  @state() private entities: CatalogEntity[] = [];
  @state() private phase: 'idle' | 'busy' | 'done' | 'error' = 'idle';
  @state() private capError = '';
  @state() private saving = false;
  @state() private editorError = '';
  @state() private conflict = false;
  @state() private confirmDelete = false;
  @state() private members: SceneMember[] = [];
  @state() private editorName = '';
  @query('scene-capture') private capture?: SceneCapture;
  private loadedId = '__none__';

  static styles = [bubbleChrome, ...automationsStyles, css`
    :host {
      display: block;
    }
    sw-drawer {
      --sw-drawer-modal-w: 560px;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .groups {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .sh {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding-inline: 4px;
      margin-block-end: 12px;
    }
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .sh small {
      display: block;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .scard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px 16px;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-1);
    }
    .scard.hid {
      opacity: 0.7;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
    }
    .ico {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .ico.mine {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .ico .ic {
      font-size: var(--sw-fs-2xl);
    }
    .badge {
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      white-space: nowrap;
    }
    .badge.mine {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .badge .ic {
      font-size: var(--sw-fs-sm);
    }
    .star,
    .eyeb {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-3);
    }
    .star:hover,
    .eyeb:hover {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .star[aria-pressed='true'] {
      color: #ff9f0a;
    }
    .star[aria-pressed='true'] .ic {
      fill: currentColor;
    }
    .star .ic,
    .eyeb .ic {
      font-size: var(--sw-fs-xl);
    }
    /* hiding a scene of a device is an administrator's chore: with a mouse the control shows on hover or focus, not on every card;
       a touch screen has no hover, so it stays reachable there (quiet, like the star) - otherwise nobody could unhide a scene on a phone */
    @media (hover: hover) and (pointer: fine) {
      .eyeb {
        opacity: 0;
      }
      .scard:hover .eyeb,
      .eyeb:focus-visible,
      .scard.hid .eyeb {
        opacity: 1;
      }
    }
    h3 {
      margin: 6px 0 0;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    .sub {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-block-size: 1.3em;
    }
    .acts {
      display: flex;
      gap: 8px;
      margin-block-start: 10px;
      flex-wrap: wrap;
    }
    .acts .btn.primary {
      min-inline-size: 104px;
      justify-content: center;
    }
    .acts .btn.ok {
      background: var(--dv-success);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
    }
    .hid-row {
      display: flex;
      justify-content: center;
      margin-block-start: 6px;
    }
    .sheetbody {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(c: PropertyValues<this>) {
    if (c.has('sceneId') && this.sceneId !== this.loadedId) {
      this.loadedId = this.sceneId;
      this.conflict = false;
      this.editorError = '';
      this.phase = 'idle';
      this.confirmDelete = false;
      if (this.sceneId) void this.openEditor();
      else this.detail = null;
    }
  }

  private fire<T>(name: string, detail?: T) {
    if (!this.isConnected) return; // a drawer closes itself while the screen is torn down (a route change): that is not the user's close
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  private say(text: string, tone: 'ok' | 'error' = 'ok', action?: DrawerResult['action']) {
    this.fire<DrawerResult>('result', { text, tone, action });
  }

  // ------------------------------------------------------------------------------------------------ cards

  private async activate(i: Item) {
    if (this.busy.has(i.id)) return;
    this.busy = new Set([...this.busy, i.id]);
    try {
      await activateScene(i.id);
      this.done = new Set([...this.done, i.id]);
      window.setTimeout(() => (this.done = new Set([...this.done].filter((x) => x !== i.id))), 2200);
      this.fire('changed', { id: i.id });
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    } finally {
      this.busy = new Set([...this.busy].filter((x) => x !== i.id));
    }
  }

  private async meta(i: Item, patch: { favourite?: boolean; hidden?: boolean }) {
    try {
      await autoApi().setMeta('scene', i.id, patch);
      this.fire('changed', { id: i.id });
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    }
  }

  private card(i: Item, hidden = false): TemplateResult {
    const native = !isIntegrationScene(i);
    const done = this.done.has(i.id);
    const admin = this.status?.counts.hidden !== null && this.status?.counts.hidden !== undefined;
    return html`<article class=${`scard${hidden ? ' hid' : ''}`} data-scene=${i.id} data-scene-kind=${native ? 'native' : 'device'}>
      <div class="top">
        <span class=${`ico${native ? ' mine' : ''}`}>${aIcon(native ? 'camera' : 'sparkle')}</span>
        ${native ? html`<span class="badge mine" data-scene-badge>${aIcon('edit')}ניתנת לעריכה</span>` : html`<span class="badge" data-scene-badge>הפעלה בלבד</span>`}
        <span style="flex:1"></span>
        ${admin && !native ? html`<button type="button" class="eyeb" aria-label=${`${hidden ? 'הצגה' : 'הסתרה'} · ${i.name}`} title=${hidden ? 'הצגה' : 'הסתרה'} data-scene-hide @click=${() => void this.meta(i, { hidden: !hidden })}>${aIcon(hidden ? 'eye' : 'eyeOff')}</button>` : nothing}
        <button type="button" class="star" aria-pressed=${String(i.favourite)} aria-label=${`מועדף · ${i.name}`} title="מועדף" data-scene-fav @click=${() => void this.meta(i, { favourite: !i.favourite })}>${aIcon('star')}</button>
      </div>
      <h3>${bidi(i.name)}</h3>
      <div class="sub" data-scene-sub>${sceneLine(i, this.now, undefined, native ? i.targets.length || undefined : undefined)}</div>
      <div class="acts">
        <button type="button" class=${`btn primary${done ? ' ok' : ''}`} data-scene-activate ?disabled=${this.busy.has(i.id) || hidden} @click=${() => void this.activate(i)}>${done ? aIcon('check') : aIcon('play')}${done ? 'הופעלה' : 'הפעל'}</button>
        ${native && i.can.edit ? html`<button type="button" class="btn" data-scene-edit @click=${() => this.fire('open-scene', { id: i.id })}>${aIcon('edit')}עריכה</button>` : nothing}
      </div>
    </article>`;
  }

  // ------------------------------------------------------------------------------------------------ the editor

  private async openEditor() {
    this.members = [];
    this.editorName = '';
    this.detail = null;
    try {
      const cat: AutomationCatalog = await autoApi().catalog();
      this.entities = cat.entities;
    } catch {
      this.entities = [];
    }
    if (this.sceneId === 'new') return;
    try {
      const d = await autoApi().get('scene', this.sceneId);
      this.detail = d;
      const draft = d.draft as SceneDraft;
      this.members = draft.members ?? [];
      this.editorName = draft.name || d.name;
      if (!this.entities.length) this.entities = draft.members.map((m) => ({ entity_id: m.entity_id, name: m.entity_id, domain: m.entity_id.split('.')[0], floor: null, area: null, class: null, state: null, missing: false, triggers: [], actions: [] }));
    } catch (err) {
      const f = mapAutomationError(err);
      this.say(f.message, 'error');
      this.fire('close-scene');
    }
  }

  private async onCapture(e: CustomEvent<{ entity_ids: string[]; merge: boolean }>) {
    const { entity_ids, merge } = e.detail;
    this.phase = 'busy';
    this.capError = '';
    try {
      const r = await autoApi().capture({ entity_ids });
      if (merge) { this.capture?.merge(r.members); this.phase = 'done'; }
      else { this.members = r.members; this.phase = 'done'; }
    } catch (err) {
      this.capError = mapAutomationError(err).message;
      this.phase = 'error';
    }
  }

  private async onSave(e: CustomEvent<{ name: string; members: SceneMember[] }>) {
    if (this.saving) return;
    this.saving = true;
    this.editorError = '';
    const draft: SceneDraft = { name: e.detail.name, icon: this.detail ? (this.detail.draft as SceneDraft).icon : null, members: e.detail.members };
    try {
      if (this.detail) await replaceItem('scene', this.detail.id, draft, this.detail.revision);
      else await createItem('scene', draft, { enabled: true });
      this.say('נשמר');
      this.fire('changed', {});
      this.fire('close-scene');
    } catch (err) {
      const f = mapAutomationError(err);
      if (f.kind === 'conflict') this.conflict = true;
      this.editorError = f.message;
    } finally {
      this.saving = false;
    }
  }

  private async doDelete() {
    const d = this.detail;
    if (!d) return;
    try {
      const r = await deleteItem('scene', d.id, d.revision, { confirm: true });
      this.confirmDelete = false;
      this.fire('changed', {});
      this.fire('close-scene');
      this.say(`"${d.name}" נמחקה`, 'ok', { label: 'שחזור', run: () => void autoApi().restoreTrash(r.trash_id, { client_request_id: `undo-${r.trash_id}` }).then(() => this.fire('changed', {})).catch((er) => this.say(mapAutomationError(er).message, 'error')) });
    } catch (err) {
      this.confirmDelete = false;
      this.editorError = mapAutomationError(err).message;
    }
  }

  private editor(): TemplateResult {
    const open = !!this.sceneId;
    const heading = this.detail ? bidi(this.detail.name) : 'סצנה חדשה';
    return html`<sw-drawer modal .open=${open} heading=${heading} subheading=${this.detail ? 'ניתנת לעריכה' : 'סצנה חדשה'} @close=${() => this.fire('close-scene')}>
      ${open ? html`<div class="sheetbody">
        ${this.conflict ? html`<div class="banner warn" role="alert">${aIcon('warning')}<div><b>הסצנה שונתה במקום אחר</b></div><button type="button" class="btn sm" @click=${() => { this.conflict = false; void this.openEditor(); }}>טען מחדש</button></div>` : nothing}
        ${this.editorError && !this.conflict ? html`<div class="banner bad" role="alert">${aIcon('warning')}${this.editorError}</div>` : nothing}
        <scene-capture .name=${this.editorName} .members=${this.members} .entities=${this.entities} .phase=${this.phase} .error=${this.capError} .saving=${this.saving} .deletable=${!!this.detail && !!this.detail.can.delete} .readOnly=${!!this.detail && !this.detail.can.edit}
          @capture=${(e: CustomEvent<{ entity_ids: string[]; merge: boolean }>) => void this.onCapture(e)} @save=${(e: CustomEvent<{ name: string; members: SceneMember[] }>) => void this.onSave(e)} @cancel=${() => this.fire('close-scene')} @delete=${() => (this.confirmDelete = true)}></scene-capture>
      </div>` : nothing}
      ${this.confirmDelete && this.detail ? html`<sw-dialog open heading=${`למחוק את "${this.detail.name}"?`} data-dialog="delete-scene" @close=${() => (this.confirmDelete = false)}><div class="dlgform"><p>הסצנה תישמר בסל המחזור וניתן לשחזר אותה.</p><div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirmDelete = false)}>ביטול</button><button type="button" class="btn danger" data-dialog-ok @click=${() => void this.doDelete()}>מחיקה</button></div></div></sw-dialog>` : nothing}
    </sw-drawer>`;
  }

  render() {
    const groups = groupScenes(this.items);
    const hid = this.hiddenItems.length ? this.hiddenItems : hiddenScenes(this.items);
    return html`<div class="groups" data-scenes-panel>
      ${groups.map((g) => html`<section data-scene-group=${g.id}>
        <header class="sh"><div><h2>${bidi(g.title)}</h2>${g.sub ? html`<small>${g.sub}</small>` : nothing}</div></header>
        <div class="grid">${g.items.map((i) => this.card(i))}</div>
      </section>`)}
      ${hid.length && this.status?.counts.hidden !== null ? html`<section data-scene-group="hidden">
        <div class="hid-row"><button type="button" class="btn sm quiet" data-scene-hidden-toggle aria-expanded=${String(this.showHidden)} @click=${() => (this.showHidden = !this.showHidden)}>${aIcon('eyeOff')}מוסתרות <span>${hid.length}</span></button></div>
        ${this.showHidden ? html`<div class="grid" style="margin-block-start:12px">${hid.map((i) => this.card(i, true))}</div>` : nothing}
      </section>` : nothing}
    </div>
    ${this.editor()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenes-panel': ScenesPanel;
  }
}
