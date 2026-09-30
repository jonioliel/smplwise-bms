import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { describeError, get } from '../api/client';
import { isApi } from '../api/session';
import {
  DEFAULT_REMOTE, media,
  type DeviceRemoteBody, type Glyph, type MediaDeviceDetail, type RemoteConfig, type RemoteSection, type SourceItem,
} from '../api/media-screens';
import { ICON, SECTION_SHORT, glyphPath, tint } from '../components/media-remote-keys';
import { moveSection, setMore, toggleSection } from '../components/media-remote-logic';
import { remoteStyles } from '../components/media-remote-css';

/**
 * "עריכת השלט" (CR-015 §7.3): the remote's editor, drawn inside the open remote (media-remote.ts) instead of the pad. Reached from
 * the user menu (`registerScreenEdit` id `multimedia-remote`, media.layout - registered by the remote itself).
 *
 * Scope: "למסך הזה" (this screen's own remote, its sources and apps curation) or "ברירת מחדל לכל המסכים" (the installation
 * default: the sections only). Sections: on / off, order (drag or the arrow buttons), and whether a section sits behind
 * "עוד מקשים". Sources and apps: order, hide, rename (the TV's own string is what is sent - only the label changes) and the
 * neutral glyph. "חיבורים" (which integration answers what) is read-only and only for holders of system.configure.
 *
 * Saves with `media().saveDeviceRemote` / `saveRemoteDefault`; events: `editor-done` { detail?: MediaDeviceDetail } after a
 * save or a cancel (the remote then shows the pad again). Nothing is sent to a screen from here.
 */

/** One source / app row of the editor: `orig` is the item's own name (what an empty or unchanged name falls back to). */
const itemOf = (s: SourceItem): Item => ({ id: s.id, orig: s.default_label ?? s.label, label: s.label, hidden: s.hidden === true, kind: s.kind, glyph: s.glyph, hue: s.hue });

type Item = { id: string; orig: string; label: string; hidden: boolean; kind: SourceItem['kind']; glyph: Glyph; hue: number | null };

const GLYPH_NAMES: Partial<Record<Glyph, string>> = {
  antenna: 'טלוויזיה', hdmi: 'כניסה', gamepad: 'משחקים', speaker: 'שמע', image: 'תמונות', film: 'סרטים', playRect: 'וידאו', sparkle: 'כוכב', music: 'מוזיקה',
  ball: 'ספורט', news: 'חדשות', smile: 'ילדים', globe: 'רשת', app: 'כללי',
};

const CONTROL_LABEL: Record<string, string> = { power: 'הפעלה', volume: 'עוצמה', mute: 'השתקה', sources: 'מקורות', apps: 'אפליקציות', keys: 'מקשים', now_playing: 'מה מתנגן' };
const ROLE_LABEL: Record<string, string> = { vendor: 'חיבור ראשי', remote: 'שלט', cast: 'הקרנה', dlna: 'רשת ביתית', smartthings: 'ענן', ma_export: 'נגן מוזיקה', ma_import: 'נגן מוזיקה', ma_native: 'נגן מוזיקה', ma_universal: 'נגן מוזיקה', other: 'אחר' };

interface Conn {
  platform: string;
  role: string;
  hidden: boolean;
  primary_for: string[];
}

const ic = (name: string, svgInner?: string): TemplateResult => html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(svgInner ?? ICON[name] ?? '')}</svg>`;

@customElement('media-remote-editor')
export class MediaRemoteEditor extends LitElement {
  @property({ attribute: false }) device!: MediaDeviceDetail;
  /** The caller holds system.configure: the read-only "חיבורים" list. */
  @property({ type: Boolean }) canConfigure = false;
  @state() private scope: 'device' | 'default' = 'device';
  @state() private cfg: RemoteConfig = DEFAULT_REMOTE;
  @state() private sources: Item[] = [];
  @state() private apps: Item[] = [];
  @state() private busy = false;
  @state() private error = '';
  @state() private conns: Conn[] | null = null;
  private dragFrom: { list: 'sections' | 'sources' | 'apps'; index: number } | null = null;
  private defaultCfg: RemoteConfig | null = null;
  /** The source / app lists were changed by the user: a late curation read must not overwrite them. */
  private listsTouched = false;

  static styles = [
    remoteStyles,
    css`
      :host {
        display: block;
      }
      svg.ic {
        inline-size: 1em;
        block-size: 1em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex: none;
        vertical-align: middle;
      }
      .ed {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 10px 10px 10px 14px;
        border-radius: 20px;
        background: var(--mr-sheen), var(--mr-surface);
        border: 1px solid color-mix(in srgb, var(--mr-accent) 45%, transparent);
        box-shadow: 0 0 0 4px var(--mr-accent-soft);
      }
      .bar .t {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 15px;
      }
      .bar .t .ic {
        color: var(--mr-accent-text);
        font-size: 17px;
      }
      .grp {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .grp h4 {
        margin: 6px 4px 0;
        font-size: 12.5px;
        color: var(--mr-text-2);
        font-weight: 600;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        min-block-size: 52px;
        border-radius: 16px;
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
        font-size: 14px;
      }
      .row.off .nm,
      .row.off .gi {
        opacity: 0.5;
      }
      .row.drag {
        opacity: 0.5;
      }
      .grip {
        color: var(--mr-text-2);
        cursor: grab;
        font-size: 16px;
        display: grid;
        place-items: center;
        inline-size: 24px;
        flex: none;
      }
      .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ib {
        flex: none;
        inline-size: 36px;
        block-size: 36px;
        border-radius: 50%;
        border: 0;
        background: var(--mr-surface-3);
        color: var(--mr-text);
        display: grid;
        place-items: center;
      }
      .ib .ic {
        font-size: 15px;
      }
      .ib[disabled] {
        opacity: 0.35;
      }
      .tog {
        position: relative;
        flex: none;
        inline-size: 48px;
        block-size: 30px;
        border-radius: 999px;
        background: var(--mr-surface-3);
        border: 0;
        padding: 0;
        transition: background var(--mr-motion);
      }
      .tog::after {
        content: '';
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 24px;
        block-size: 24px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.28);
        transition: inset-inline-start var(--mr-motion) var(--mr-ease);
      }
      .tog[aria-checked='true'] {
        background: var(--mr-success);
      }
      .tog[aria-checked='true']::after {
        inset-inline-start: 21px;
      }
      .fold {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: var(--mr-text-2);
        min-block-size: 36px;
      }
      .fold input {
        inline-size: 18px;
        block-size: 18px;
        accent-color: var(--mr-accent);
      }
      .row .gi {
        inline-size: 34px;
        block-size: 34px;
        border-radius: 11px;
      }
      .row .gi .ic {
        font-size: 16px;
      }
      .row input[type='text'],
      .row select {
        flex: 1;
        min-inline-size: 0;
        block-size: 38px;
        border-radius: 12px;
        border: 1px solid var(--mr-border);
        background: var(--mr-surface);
        color: var(--mr-text);
        padding: 0 10px;
        font: inherit;
        font-size: 13.5px;
      }
      .row select {
        flex: none;
        inline-size: 92px;
      }
      .conn {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 14px;
        font-size: 13px;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--mr-surface-3);
      }
      .conn span:nth-child(odd) {
        color: var(--mr-text-2);
      }
      .conn bdi {
        direction: ltr;
        unicode-bidi: isolate;
        font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
        font-size: 12px;
      }
      .err {
        color: var(--mr-danger);
        font-size: 13px;
        font-weight: 600;
        padding: 0 4px;
      }
    `,
  ];

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('device') && this.device) {
      this.fromDevice();
      void this.loadCuration(this.device.key);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.canConfigure) void this.loadConns();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('canConfigure') && this.canConfigure && !this.conns) void this.loadConns();
  }

  private fromDevice() {
    const d = this.device;
    this.cfg = { sections: d.remote.sections.map((s) => ({ ...s })), more: [...d.remote.more], scope: d.remote.scope };
    this.scope = 'device';
    this.listsTouched = false;
    this.sources = d.sources.map(itemOf);
    this.apps = d.apps.map(itemOf);
  }

  /** The editor's own read of the lists: the items the administrator hid (so a save never un-hides them) and each item's default
   * name (so a save never drops a custom one). Anyone without media.layout gets the ordinary lists back and nothing changes. */
  private async loadCuration(key: string) {
    try {
      const full = await media().get(key, { curation: true });
      if (key !== this.device?.key || this.listsTouched) return;
      this.sources = full.sources.map(itemOf);
      this.apps = full.apps.map(itemOf);
    } catch {
      /* the lists of the ordinary read stay */
    }
  }

  /** What the admin route says answers what (system.configure only). Demo mode has no admin route: a sample per profile. */
  private async loadConns() {
    if (!isApi()) {
      const p = this.device?.profile ?? 'generic';
      this.conns = p === 'generic'
        ? [{ platform: 'media_player', role: 'vendor', hidden: false, primary_for: ['power', 'volume', 'mute', 'sources', 'now_playing'] }]
        : [{ platform: p === 'android_tv' ? 'androidtv_remote' : p === 'lg_webos' ? 'webostv' : 'samsungtv_smart', role: 'vendor', hidden: false, primary_for: ['power', 'keys', 'sources', 'apps'] }, { platform: 'cast', role: 'cast', hidden: true, primary_for: ['now_playing'] }];
      return;
    }
    try {
      const r = await get<{ devices: { key: string; endpoints: Conn[] }[] }>('multimedia/admin/devices');
      this.conns = r.devices.find((x) => x.key === this.device.key)?.endpoints ?? [];
    } catch {
      this.conns = [];
    }
  }

  private async setScope(scope: 'device' | 'default') {
    if (scope === this.scope) return;
    this.scope = scope;
    if (scope === 'default') {
      try {
        this.defaultCfg ??= await media().remoteDefault();
      } catch {
        this.defaultCfg = { ...DEFAULT_REMOTE, scope: 'default' };
      }
      this.cfg = { sections: this.defaultCfg.sections.map((s) => ({ ...s })), more: [...this.defaultCfg.more], scope: 'default' };
    } else {
      this.fromDevice();
    }
  }

  private available(id: RemoteSection): boolean {
    if (this.scope === 'default') return true;
    const c = this.device.caps;
    const has = (...keys: string[]) => keys.some((k) => (c.keys as string[]).includes(k));
    switch (id) {
      case 'recent': return c.sources || c.apps;
      case 'vol': return c.volume_set || c.volume_step || c.mute;
      case 'pbk': return c.transport.play || c.transport.pause;
      case 'text': return c.text;
      case 'touch': return c.touchpad;
      case 'nav': return has('back', 'home', 'menu');
      case 'dpad': return has('up', 'down', 'left', 'right', 'ok');
      case 'ch': return has('chup', 'chdown');
      case 'nums': return has('n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9');
      case 'colors': return has('red', 'green', 'yellow', 'blue');
      case 'xtra': return has('exit', 'info', 'guide', 'source', 'tools', 'settings', 'chlist', 'prech');
    }
  }

  // --- reorder helpers

  private move<T>(list: T[], from: number, to: number): T[] {
    const out = [...list];
    const [x] = out.splice(from, 1);
    out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
    return out;
  }

  private moveIn(list: 'sections' | 'sources' | 'apps', from: number, to: number) {
    if (from === to || to < 0) return;
    if (list === 'sections') this.cfg = moveSection(this.cfg, this.cfg.sections[from].id, to);
    else {
      this.listsTouched = true;
      if (list === 'sources') this.sources = this.move(this.sources, from, to);
      else this.apps = this.move(this.apps, from, to);
    }
  }

  private drag(list: 'sections' | 'sources' | 'apps', index: number) {
    return {
      start: (e: DragEvent) => {
        this.dragFrom = { list, index };
        e.dataTransfer?.setData('text/plain', `${list}:${index}`);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      },
      over: (e: DragEvent) => this.dragFrom?.list === list && e.preventDefault(),
      drop: (e: DragEvent) => {
        e.preventDefault();
        const f = this.dragFrom;
        this.dragFrom = null;
        if (f && f.list === list) this.moveIn(list, f.index, index);
      },
    };
  }

  // --- save

  private body(): DeviceRemoteBody {
    const toItems = (l: Item[]) => l.map((i) => ({ id: i.id, label: i.label.trim() && i.label.trim() !== i.orig ? i.label.trim().slice(0, 40) : null, hidden: i.hidden, kind: i.kind, glyph: i.glyph }));
    return {
      remote: { sections: this.cfg.sections, more: this.cfg.more },
      sources: toItems(this.sources),
      apps: toItems(this.apps).map(({ kind: _k, ...rest }) => rest),
    };
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      if (this.scope === 'default') {
        await media().saveRemoteDefault({ ...this.cfg, scope: 'default' });
        this.dispatchEvent(new CustomEvent('editor-done', { detail: {}, bubbles: true, composed: true }));
      } else {
        const detail = await media().saveDeviceRemote(this.device.key, this.body());
        this.dispatchEvent(new CustomEvent('editor-done', { detail: { detail }, bubbles: true, composed: true }));
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async resetDevice() {
    this.busy = true;
    this.error = '';
    try {
      const detail = await media().saveDeviceRemote(this.device.key, { remote: null });
      this.dispatchEvent(new CustomEvent('editor-done', { detail: { detail }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private cancel() {
    this.dispatchEvent(new CustomEvent('editor-done', { detail: {}, bubbles: true, composed: true }));
  }

  // --- render

  private sectionRows() {
    const rows = this.cfg.sections.map((s, index) => ({ s, index })).filter(({ s }) => this.available(s.id));
    return rows.map(({ s, index }, i) => {
      const d = this.drag('sections', index);
      const behind = this.cfg.more.includes(s.id);
      return html`<div class="row ${s.on ? '' : 'off'}" data-ed-section=${s.id} draggable="true" @dragstart=${d.start} @dragover=${d.over} @drop=${d.drop}>
        <span class="grip" aria-hidden="true">${ic('grip')}</span><span class="nm">${SECTION_SHORT[s.id]}</span>
        <label class="fold"><input type="checkbox" .checked=${behind} ?disabled=${!s.on} aria-label=${`מאחורי "עוד מקשים": ${SECTION_SHORT[s.id]}`} @change=${(e: Event) => (this.cfg = setMore(this.cfg, s.id, (e.target as HTMLInputElement).checked))} />מקופל</label>
        <button type="button" class="ib" aria-label=${`הקדם: ${SECTION_SHORT[s.id]}`} ?disabled=${i === 0} @click=${() => this.moveIn('sections', index, rows[i - 1].index)}>${ic('up')}</button>
        <button type="button" class="ib" aria-label=${`אחר: ${SECTION_SHORT[s.id]}`} ?disabled=${i === rows.length - 1} @click=${() => this.moveIn('sections', index, rows[i + 1].index)}>${ic('down')}</button>
        <button type="button" class="tog" role="switch" aria-checked=${String(s.on)} aria-label=${`הצג: ${SECTION_SHORT[s.id]}`} @click=${() => (this.cfg = toggleSection(this.cfg, s.id, !s.on))}></button>
      </div>`;
    });
  }

  private itemRows(list: 'sources' | 'apps') {
    const items = list === 'sources' ? this.sources : this.apps;
    const set = (next: Item[]) => {
      this.listsTouched = true;
      return list === 'sources' ? (this.sources = next) : (this.apps = next);
    };
    const patch = (i: number, p: Partial<Item>) => set(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
    return repeat(items, (x) => x.id, (x, i) => {
      const d = this.drag(list, i);
      const t = tint(x.hue);
      return html`<div class="row ${x.hidden ? 'off' : ''}" data-ed-item=${x.id} draggable="true" @dragstart=${d.start} @dragover=${d.over} @drop=${d.drop}>
        <span class="grip" aria-hidden="true">${ic('grip')}</span>
        <span class=${x.kind === 'app' ? 'gi' : 'gi src'} style=${x.kind === 'app' ? `--a1:${t.a1};--a2:${t.a2}` : ''}>${ic('', glyphPath(x.glyph))}</span>
        <input type="text" .value=${x.label} maxlength="40" placeholder=${x.orig} aria-label=${`שם: ${x.orig}`} @input=${(e: Event) => patch(i, { label: (e.target as HTMLInputElement).value })} />
        <select aria-label=${`סמל: ${x.orig}`} @change=${(e: Event) => patch(i, { glyph: (e.target as HTMLSelectElement).value as Glyph })}>${(Object.keys(GLYPH_NAMES) as Glyph[]).map((g) => html`<option value=${g} ?selected=${x.glyph === g}>${GLYPH_NAMES[g]}</option>`)}</select>
        <button type="button" class="ib" aria-label=${`הקדם: ${x.orig}`} ?disabled=${i === 0} @click=${() => this.moveIn(list, i, i - 1)}>${ic('up')}</button>
        <button type="button" class="ib" aria-label=${`אחר: ${x.orig}`} ?disabled=${i === items.length - 1} @click=${() => this.moveIn(list, i, i + 1)}>${ic('down')}</button>
        <button type="button" class="tog" role="switch" aria-checked=${String(!x.hidden)} aria-label=${`הצג: ${x.orig}`} @click=${() => patch(i, { hidden: !x.hidden })}></button>
      </div>`;
    });
  }

  render() {
    if (!this.device) return nothing;
    const dev = this.scope === 'device';
    return html`<div class="ed" data-mr-editor>
      <div class="bar"><span class="t">${ic('edit')}עריכת השלט</span>
        <button type="button" class="btn quiet" data-ed-cancel ?disabled=${this.busy} @click=${() => this.cancel()}>ביטול</button>
        <button type="button" class="btn primary" data-ed-save ?disabled=${this.busy} @click=${() => void this.save()}>${ic('check')}שמירה</button></div>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      <div class="seg sm" role="radiogroup" aria-label="היקף השינוי">
        <button type="button" role="radio" aria-checked=${String(dev)} data-ed-scope="device" @click=${() => void this.setScope('device')}>למסך הזה</button>
        <button type="button" role="radio" aria-checked=${String(!dev)} data-ed-scope="default" @click=${() => void this.setScope('default')}>ברירת מחדל לכל המסכים</button>
      </div>
      <div class="grp"><h4>חלקי השלט</h4>${this.sectionRows()}</div>
      ${dev && this.sources.length ? html`<div class="grp"><h4>מקורות · סדר, שם והצגה</h4>${this.itemRows('sources')}</div>` : nothing}
      ${dev && this.apps.length ? html`<div class="grp"><h4>אפליקציות · סדר, שם והצגה</h4>${this.itemRows('apps')}</div>` : nothing}
      ${dev && this.canConfigure && this.conns?.length
        ? html`<div class="grp"><h4>חיבורים</h4><div class="conn" data-ed-conns>${this.conns.map((c) => html`<span>${c.primary_for.map((p) => CONTROL_LABEL[p] ?? p).join(', ') || (c.hidden ? 'מוסתר' : '—')}</span><span>${ROLE_LABEL[c.role] ?? c.role} · <bdi>${c.platform}</bdi></span>`)}</div></div>`
        : nothing}
      ${dev && this.device.remote.scope === 'device' ? html`<button type="button" class="btn quiet" data-ed-reset ?disabled=${this.busy} @click=${() => void this.resetDevice()}>חזרה לברירת המחדל</button>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-remote-editor': MediaRemoteEditor;
  }
}
