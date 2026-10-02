import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { aIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import { cardChips, confirmLine, floorLine, areaLine, runLine } from './automations-logic';
import { mapAutomationError, runNeedsConfirm, runScriptNow, stopScriptNow, type AutomationsStatus, type Item } from '../api/automations';
import type { DrawerResult } from './automation-drawer';

/**
 * CR-017 `<scripts-panel .items .status .now>`: the script runner (CR §4.4). A big "הפעל" button per script; a script that has fields opens its sheet
 * (`open-script` {id}: the form and the run live in the detail drawer) instead of running at once; a running script shows "רץ עכשיו" and "עצור". A script
 * that touches something sensitive asks "להפעיל עכשיו?" with the one line of what it includes (the same confirmation manual control shows). The card body
 * opens the detail. Events: `result` {text, tone}, `changed` {id}, `open-script` {id}.
 */
@customElement('scripts-panel')
export class ScriptsPanel extends LitElement {
  @property({ attribute: false }) items: Item[] = [];
  @property({ attribute: false }) status: AutomationsStatus | null = null;
  @property({ attribute: false }) now: Date = new Date();
  /** The scripts that have fields (the list item does not say): `open-script` instead of a direct run. */
  @property({ attribute: false }) withFields: ReadonlySet<string> = new Set();
  @property({ attribute: false }) hrefOf: (id: string) => string = () => '#';
  @property({ type: Boolean }) sensitiveWarning = true;
  @state() private busy = new Set<string>();
  @state() private confirm: Item | null = null;

  static styles = [...automationsStyles, css`
    :host {
      display: block;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .pcard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 18px 14px;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: 24px;
      box-shadow: var(--dv-shadow-1);
    }
    .pcard.running {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 4px var(--dv-accent-soft);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.015em;
      line-height: 1.25;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .pcard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .where {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: 13.5px;
      color: var(--dv-text-2);
    }
    .where b {
      color: var(--dv-text);
      font-weight: 700;
    }
    .where .ic {
      font-size: 14px;
      color: var(--dv-text-3);
    }
    .go {
      position: relative;
      z-index: 2;
      flex: none;
    }
    .go .btn {
      min-inline-size: 96px;
      justify-content: center;
    }
    p {
      margin: 0;
      font-size: 14.5px;
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-block-size: 3.1em;
    }
    footer {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      font-size: 13px;
      color: var(--dv-text-2);
    }
    .runl {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .chip.live {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      min-block-size: 0;
      color: var(--dv-text-2);
      font-size: 14px;
      display: block;
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

  private fire<T>(name: string, detail?: T) {
    if (!this.isConnected) return; // a drawer closes itself while the screen is torn down (a route change): that is not the user's close
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
  private say(text: string, tone: 'ok' | 'error' = 'ok') {
    this.fire<DrawerResult>('result', { text, tone });
  }

  private async run(i: Item, confirmed = false) {
    if (this.busy.has(i.id)) return;
    if (this.withFields.has(i.id)) return void this.fire('open-script', { id: i.id });
    if (!confirmed && runNeedsConfirm(i)) { this.confirm = i; return; }
    this.confirm = null;
    this.busy = new Set([...this.busy, i.id]);
    try {
      await runScriptNow(i.id, {}, { confirm: confirmed || undefined });
      this.say('הסקריפט הופעל');
      this.fire('changed', { id: i.id });
    } catch (err) {
      const f = mapAutomationError(err);
      if (f.kind === 'confirm' && !confirmed) this.confirm = i;
      else this.say(f.message, 'error');
    } finally {
      this.busy = new Set([...this.busy].filter((x) => x !== i.id));
    }
  }

  private async stop(i: Item) {
    if (this.busy.has(i.id)) return;
    this.busy = new Set([...this.busy, i.id]);
    try {
      await stopScriptNow(i.id);
      this.say('הסקריפט נעצר');
      this.fire('changed', { id: i.id });
    } catch (err) {
      this.say(mapAutomationError(err).message, 'error');
    } finally {
      this.busy = new Set([...this.busy].filter((x) => x !== i.id));
    }
  }

  private card(i: Item): TemplateResult {
    const running = i.state === 'running';
    const run = runLine(i, this.now);
    const chips = cardChips(i, { sensitiveWarning: this.sensitiveWarning }).filter((c) => c.id !== 'read_only');
    const fields = this.withFields.has(i.id);
    const areas = areaLine(i);
    return html`<article class=${`pcard${running ? ' running' : ''}`} data-script=${i.id} data-state=${i.state}>
      <header>
        <div class="ttl">
          <h3><a class="name" href=${this.hrefOf(i.id)} data-script-open>${bidi(i.name)}</a>${running ? html`<span class="chip live" data-script-running>${aIcon('play')}רץ עכשיו</span>` : nothing}</h3>
          <div class="where">${aIcon('layers')}<b>${bidi(floorLine(i))}</b>${areas ? html`<span>${bidi(areas)}</span>` : nothing}</div>
        </div>
        <div class="go">
          ${running && i.can.run ? html`<button type="button" class="btn danger" data-script-stop ?disabled=${this.busy.has(i.id)} @click=${() => void this.stop(i)}>${aIcon('stop')}עצור</button>`
            : i.can.run ? html`<button type="button" class="btn primary" data-script-run ?disabled=${this.busy.has(i.id)} @click=${() => void this.run(i)}>${aIcon('play')}${fields ? 'הפעל…' : 'הפעל'}</button>` : nothing}
        </div>
      </header>
      ${i.sentence ? html`<p data-script-sentence>${i.sentence}</p>` : nothing}
      <footer>
        <span class="runl" data-script-runline><i class=${`dot ${run.tone === 'none' ? '' : run.tone}`}></i>${run.text}</span>
        ${chips.map((c) => html`<span class=${`chip ${c.id === 'sensitive' ? 'sens' : c.tone === 'bad' ? 'bad' : c.tone === 'warn' ? 'warn' : ''}`} data-chip=${c.id}>${aIcon(c.id === 'sensitive' ? 'shield' : c.id === 'locked' ? 'lock' : 'warning')}${c.label}</span>`)}
      </footer>
    </article>`;
  }

  render() {
    const c = this.confirm;
    return html`<div class="grid" data-scripts-panel>${this.items.map((i) => this.card(i))}</div>
      ${c ? html`<sw-dialog open heading="להפעיל עכשיו?" data-dialog="run-script" @close=${() => (this.confirm = null)}><div class="dlgform">${confirmLine(c) ? html`<p>${confirmLine(c)}</p>` : nothing}<div class="dlgrow"><button type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${() => void this.run(c, true)}>הפעל</button></div></div></sw-dialog>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scripts-panel': ScriptsPanel;
  }
}
